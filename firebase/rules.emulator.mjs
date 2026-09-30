/** Run only with Firestore emulator: firebase emulators:exec --only firestore --project demo-ap2-sync "node --test firebase/rules.emulator.mjs" */
import {readFile} from 'node:fs/promises';
import {before,after,beforeEach,test} from 'node:test';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,deleteDoc,runTransaction} from 'firebase/firestore';
let env,alice,bob,anonymous;
before(async()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required; never run rules tests against a live project');env=await initializeTestEnvironment({projectId:'demo-ap2-sync',firestore:{rules:await readFile('firestore.rules','utf8')}});alice=env.authenticatedContext('alice').firestore();bob=env.authenticatedContext('bob').firestore();anonymous=env.unauthenticatedContext().firestore();});
after(async()=>{await env?.cleanup();});beforeEach(async()=>{await env.clearFirestore();});
const key='a'.repeat(64);
function value(entity='attempts'){return entity==='attempts'?{userId:'alice',attempt_id:'a',answer:{choice:'1'},source_revision:'r1',note:'old'}:{userId:'alice',test_id:'a',status:'completed',completed_at:'2026-01-01',answers:{U1:{'1':'submitted'}},source_mix:[{revision:'r1'}],subpart_assessments:{},result:{pending:1}};}
async function write(db,entity,data,deleted=false){return runTransaction(db,async tx=>{const rp=doc(db,'users','alice','records',key),sp=doc(db,'users','alice','sync','state');const [r,s]=await Promise.all([tx.get(rp),tx.get(sp)]);const old=r.data();const e={entity,id:'a',revision:(old?.envelope.revision??0)+1,cursor:(s.data()?.cursor??0)+1,deviceId:'device',updatedAt:'2026-01-01',deleted,value:deleted?null:data};tx.set(sp,{userId:'alice',cursor:e.cursor});tx.set(rp,{userId:'alice',envelope:e,history:deleted?old?.history??null:['attempts','testSessions','moduleRuns','moduleProgress'].includes(entity)?data:null});return e;});}
test('anonymous and foreign uid cannot read or write any personal collection',async()=>{
 await assertSucceeds(write(alice,'attempts',value()));
 for(const db of [bob,anonymous]){await assertFails(getDoc(doc(db,'users','alice','records',key)));await assertFails(write(db,'attempts',value()));for(const name of ['sync','devices','mutations','conflicts'])await assertFails(setDoc(doc(db,'users','alice',name,'x'),{userId:'alice'}));}
});
test('CAS revision and cursor transaction required; physical deletion denied',async()=>{
 await write(alice,'attempts',value());const rp=doc(alice,'users','alice','records',key),old=(await getDoc(rp)).data();
 await assertFails(setDoc(rp,{...old,envelope:{...old.envelope,revision:5}}));await assertFails(setDoc(rp,{...old,envelope:{...old.envelope,revision:2,cursor:2}}));await assertFails(deleteDoc(rp));
 await assertSucceeds(write(alice,'attempts',{...value(),note:'updated'}));
});
test('attempt provenance cannot change through normal update or tombstone resurrection',async()=>{
 await write(alice,'attempts',value());await assertFails(write(alice,'attempts',{...value(),source_revision:'replacement'}));
 await assertSucceeds(write(alice,'attempts',null,true));await assertFails(write(alice,'attempts',{...value(),answer:{choice:'5'}}));await assertSucceeds(write(alice,'attempts',{...value(),note:'restored annotation'}));
});
test('completed U self-assessment and lifecycle allowed; original answer/source stay immutable',async()=>{
 const old=value('testSessions');await write(alice,'testSessions',old);const assessed={...old,subpart_assessments:{U1:{'1':'richtig'}},result:{pending:0,richtig:1}};
 await assertSucceeds(write(alice,'testSessions',assessed));await assertSucceeds(write(alice,'testSessions',{...assessed,status:'discarded',previous_status:'completed'}));await assertSucceeds(write(alice,'testSessions',{...assessed,status:'completed'}));
 await assertFails(write(alice,'testSessions',{...assessed,answers:{U1:{'1':'changed'}}}));await assertFails(write(alice,'testSessions',{...assessed,source_mix:[{revision:'r2'}]}));
});
test('mutation receipt must match resulting record and is immutable',async()=>{
 const record=await write(alice,'attempts',value());const rp=doc(alice,'users','alice','mutations','b'.repeat(64));const receipt={userId:'alice',recordKey:key,createdAt:'now',mutation:{mutationId:'m',entity:'attempts',id:'a',baseRevision:0,deleted:false,value:value()},result:{mutationId:'m',status:'applied',record}};
 await assertSucceeds(setDoc(rp,receipt));await assertFails(setDoc(rp,{...receipt,createdAt:'changed'}));await assertFails(deleteDoc(rp));await assertFails(setDoc(doc(alice,'users','alice','mutations','c'.repeat(64)),{...receipt,result:{...receipt.result,record:{...record,revision:9}}}));
});

test('question notes accept owned updates and reject foreign UID or malformed content',async()=>{
 const note={userId:'alice',question_id:'a',text:'Persistent',created_at:'2026-01-01',updated_at:'2026-01-01',revision:1};
 await assertSucceeds(write(alice,'questionNotes',note));await assertSucceeds(write(alice,'questionNotes',{...note,text:'Edited',revision:2}));
 await assertFails(write(bob,'questionNotes',note));await assertFails(getDoc(doc(bob,'users','alice','records',key)));await assertFails(write(alice,'questionNotes',{...note,text:7}));await assertFails(write(alice,'questionNotes',{...note,userId:'bob'}));
});

test('module progress cannot roll back a reset generation; runs are immutable',async()=>{
 const progress={userId:'alice',id:'a',exam:'exam',module:'ap',run_id:'run-2',generation:2,question_ids:['q'],questionStates:{q:{state:'unanswered'}},revision:1,started_at:'now',updated_at:'now',reset_at:'now'};
 await assertSucceeds(write(alice,'moduleProgress',progress));await assertFails(write(alice,'moduleProgress',{...progress,generation:1,run_id:'old'}));await assertSucceeds(write(alice,'moduleProgress',{...progress,generation:3,run_id:'new'}));await assertFails(write(alice,'moduleProgress',null,true));
});
test('learning run metadata cannot be edited or deleted',async()=>{
 const run={userId:'alice',run_id:'a',progress_id:'exam/ap',exam:'exam',module:'ap',question_ids:['q'],generation:1,started_at:'now',legacy_attempt_ids:[]};await assertSucceeds(write(alice,'moduleRuns',run));await assertFails(write(alice,'moduleRuns',{...run,legacy_attempt_ids:['fake']}));await assertFails(write(alice,'moduleRuns',null,true));
});
test('wrong question state supports ownership, shape validation and durable dismissal',async()=>{
 const state={userId:'alice',question_id:'a',active:false,entered_at:null,last_wrong_at:'2026-01-01',wrong_count:1,consecutive_correct:0,dismissed_at:'2026-01-02',dismissed_result_ids:['practice:1:falsch'],updated_at:'2026-01-02',revision:1};
 await assertSucceeds(write(alice,'wrongQuestions',state));
 await assertFails(write(bob,'wrongQuestions',state));
 await assertFails(write(alice,'wrongQuestions',{...state,wrong_count:-1}));
 await assertSucceeds(write(alice,'wrongQuestions',{...state,active:true,revision:2}));
});
