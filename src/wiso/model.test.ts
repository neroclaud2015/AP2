import {expect,test} from 'vitest';
import {DEFAULT_WISO_CONFIG,deriveWiso,reconcileWisoClassifications,type WisoDataset} from './model';
import type {InventoryQuestion} from '../bank/model';
import type {DashboardSnapshot} from '../dashboard/analytics';
import type {Attempt} from '../learning/model';
import type {TestSession} from '../exams/model';
const now=new Date('2026-10-21');
const empty=():DashboardSnapshot=>({attempts:[],testSessions:[],wrongQuestions:[],questionUncertainty:[],learningSessions:[],trainingRuns:[]});
const inventory=Array.from({length:4},(_,i)=>({question_id:`q${i}`,examId:i<2?'2024-sommer':i===2?'2024-winter':'2025-sommer',module:'wiso',kind:i===3?'multi_part':'multiple_choice',question_source_revision:'v1'} as InventoryQuestion));
const data=():WisoDataset=>({schema_version:1,version:'1',taxonomy:{version:'1',nodes:[{id:'p',label:'Parent',parent_id:null,active:true},...['a','b'].map(id=>({id,label:id,parent_id:'p',active:true}))]},texts:[],summaries:[],classifications:inventory.map(q=>({question_id:q.question_id,question_source_revision:'v1',topic_ids:q.question_id==='q0'?['a','b']:['a'],confidence:.9,source:'machine_suggested',locked:false,review_reasons:[],evidence:[]}))});
const attempt=(id:string,q:string,correctness:Attempt['correctness']='richtig'):Attempt=>({userId:'u',attempt_id:id,question_id:q,timestamp:'2026-10-20',correctness,user_answer:{choice:1},auto_scored:true,self_assessed:false,partial_status:false,unsure:false,confidence:'sure',hints_used:[],error_reason:'',note:'',subparts:[]});
test('distinct questions and seasons, parent union and mixed kinds; inputs remain pure',()=>{
 const d=data(),before=JSON.stringify(d),r=deriveWiso([...inventory,inventory[0]],d,empty(),'u',now),p=r.topics.find(t=>t.id==='p')!;
 expect(p).toMatchObject({count:4,seasonCount:3,mc:3,u:1,firstSeen:'2024-sommer',lastSeen:'2025-sommer'});expect(r.total).toBe(4);expect(r.classified).toBe(4);expect(r.topics.reduce((n,t)=>n+t.count,0)).toBeGreaterThan(4);expect(JSON.stringify(d)).toBe(before);expect(r.nextFocus?.reasons).toContain('Noch nicht bearbeitet');expect(r.weakTopics).toEqual([]);
});
test('add, remove, changed source and missing classification remain visible',()=>{
 const d=data(),added={...inventory[0],question_id:'new'};
 expect(deriveWiso([...inventory,added],d,empty(),'u',now)).toMatchObject({total:5,classified:4,unclassified:1});
 expect(deriveWiso(inventory.slice(1),d,empty(),'u',now)).toMatchObject({total:3,classified:3});
 expect(deriveWiso([{...inventory[0],question_source_revision:'v2'}],d,empty(),'u',now)).toMatchObject({total:1,classified:0,unclassified:1});
 d.classifications[0]={...d.classifications[0],source:'human_confirmed',locked:true};
 const rows=reconcileWisoClassifications([{...inventory[0],question_source_revision:'v2'}],d.classifications,d.taxonomy);
 expect(rows[0]).toMatchObject({topic_ids:['a','b'],review_reasons:['source_changed_since_confirmation'],question_source_revision:'v1'});expect(rows[1].active).toBe(false);
});
test('accuracy requires three distinct valid questions; latest partial is not correct',()=>{
 const s=empty();s.attempts=[attempt('1','q0'),attempt('2','q0'),attempt('3','q1')];
 expect(deriveWiso(inventory,data(),s,'u',now).topics[1].accuracy).toBeNull();
 s.attempts.push(attempt('4','q2','teilweise'),{...attempt('5','q0','falsch'),timestamp:'2026-10-21'});
 expect(deriveWiso(inventory,data(),s,'u',now).topics[1]).toMatchObject({answered:3,correct:1,accuracy:100/3});
});
test('invalid and deleted tests, mirrored attempts, solution visits and other users excluded',()=>{
 const s=empty(),testSession={userId:'u',test_id:'t',status:'completed',completed_at:'2026-10-20',result:{byQuestion:{q0:'richtig'}}} as unknown as TestSession;
 s.testSessions=[testSession,testSession];s.attempts=[{...attempt('mirror','q0'),test_id:'t'},{...attempt('view','q1'),auto_scored:false},{...attempt('other','q2'),userId:'other'},{...attempt('invalid','q3'),valid:false} as Attempt];
 expect(deriveWiso(inventory,data(),s,'u',now).answered).toBe(1);
 for(const extra of [{status:'discarded'},{deleted_at:'2026-10-21'},{invalidated:true},{status:'active'}]){s.testSessions=[{...testSession,...extra} as TestSession];expect(deriveWiso(inventory,data(),s,'u',now).answered).toBe(0);}
});
test('wrong/uncertain union does not double count and pure solution sessions cannot affect priority',()=>{
 const s=empty();s.attempts=[attempt('wrong','q0','falsch')];s.questionUncertainty=['q0','q1'].map(question_id=>({userId:'u',question_id,active:true,entered_at:'2026-10-20',updated_at:'2026-10-20',revision:1}));
 const r=deriveWiso(inventory,data(),s,'u',now),topic=r.topics.find(t=>t.id==='a')!;expect(topic.wrongIds).toEqual(['q0']);expect(topic.unsureIds).toEqual(['q1']);expect(topic.needIds).toEqual(['q0','q1']);
 s.learningSessions=[{userId:'u',question_id:'q2',draft:{},revealed:true}];expect(deriveWiso(inventory,data(),s,'u',now).nextFocus).toEqual(r.nextFocus);
});
test('priority is ordinal with transparent configurable thresholds',()=>{
 const d=data();d.config={priority:{...DEFAULT_WISO_CONFIG.priority,high:100,medium:50}};
 expect(deriveWiso(inventory,d,empty(),'u',now).topics[1].priorityLabel).toBe('Niedrig');
 d.config.priority!.medium=0;expect(deriveWiso(inventory,d,empty(),'u',now).topics[1].priorityLabel).toBe('Mittel');
 d.config.priority!.high=0;expect(deriveWiso(inventory,d,empty(),'u',now).topics[1].priorityLabel).toBe('Hoch');
});
test('parent-only weak questions remain candidates while fully covered parents are not duplicated',()=>{
 const d=data(),s=empty();
 expect(deriveWiso(inventory,d,s,'u',now).frequentTopics.some(t=>t.id==='p')).toBe(false);
 d.classifications=d.classifications.map(c=>({...c,topic_ids:c.question_id==='q0'?['a']:['p']}));
 s.attempts=['q1','q2','q3'].map((q,i)=>attempt('parent-wrong-'+i,q,'falsch'));
 const r=deriveWiso(inventory,d,s,'u',now);
 expect(r.frequentTopics.some(t=>t.id==='p')).toBe(true);
 expect(r.weakTopics.map(t=>t.id)).toContain('p');
 expect(r.nextFocus?.id).toBe('p');
 expect(r.topics.find(t=>t.id==='p')?.questionIds).toHaveLength(4);
});
