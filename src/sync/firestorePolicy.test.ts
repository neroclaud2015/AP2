import {describe,it,expect} from 'vitest';
import {planMutation,validateMutation} from './firestorePolicy';
import {FirebaseAuthProvider,firebaseConfig} from './FirebaseAuthProvider';
import type {SyncEnvelope,PushMutation} from './protocol';
const mutation=(baseRevision=0):PushMutation=>({entity:'attempts',id:'a',mutationId:'m',baseRevision,deleted:false,value:{userId:'u',attempt_id:'a',answer:{choice:'1'},source_revision:'r1',note:'one'}});
const envelope:SyncEnvelope={...mutation(),revision:1,cursor:1,updatedAt:'t',deviceId:'d'};
describe('Firestore transaction policy (pure tests, no hosted or emulator claim)',()=>{
 it('requires current uid ownership and valid tombstones',()=>{expect(()=>validateMutation({...mutation(),value:{userId:'other'}},'u')).toThrow();expect(()=>validateMutation({...mutation(),deleted:true},'u')).toThrow();});
 it('retains both sides on CAS conflict and blocks historical rewrites',()=>{
  expect(planMutation(mutation(),envelope,envelope.value)).toEqual({reason:'revision_mismatch'});
  const changed={...mutation(1),value:{...mutation().value,source_revision:'r2'}};
  expect(planMutation(changed,envelope,envelope.value)).toEqual({reason:'immutable_history'});
  expect(planMutation({...mutation(1),value:{...mutation().value,note:'two'}},envelope,envelope.value)).toEqual({});
 });
 it('tombstone cannot be used to rewrite immutable attempt on resurrection',()=>{
  const deleted={...envelope,revision:2,deleted:true,value:null};
  expect(planMutation({...mutation(2),value:{...mutation().value,answer:{choice:'5'}}},deleted,envelope.value)).toEqual({reason:'immutable_history'});
 });
 it('keeps missing configuration local and refuses fake login',async()=>{expect(firebaseConfig({})).toBeNull();const auth=new FirebaseAuthProvider(null);expect(auth.configured).toBe(false);expect(await auth.restoreSession()).toEqual({id:'local',mode:'local'});await expect(auth.login({})).rejects.toThrow('konfiguriert');});
});

describe('completed U assessment remains editable without changing submitted answers',()=>{
 it('allows assessment/result and discard/restore but freezes answers and provenance',()=>{
  const old={userId:'u',test_id:'t',status:'completed',completed_at:'2026-01-01',answers:{U1:{'1':'mine'}},source_mix:[{revision:'r1'}],subpart_assessments:{},result:{pending:1},revision:2};
  const current={...envelope,entity:'testSessions' as const,id:'t',value:old};
  const m={...mutation(1),entity:'testSessions' as const,id:'t',value:{...old,subpart_assessments:{U1:{'1':'richtig'}},result:{pending:0,richtig:1},revision:3}};
  expect(planMutation(m,current,old)).toEqual({});
  expect(planMutation({...m,value:{...m.value,status:'discarded',previous_status:'completed'}},current,old)).toEqual({});
  expect(planMutation({...m,value:{...m.value,answers:{U1:{'1':'changed'}}}},current,old)).toEqual({reason:'immutable_history'});
 });
});
