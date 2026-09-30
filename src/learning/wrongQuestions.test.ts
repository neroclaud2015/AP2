import {expect,test} from 'vitest';
import {wrongResults,reconcileWrongQuestions} from './wrongQuestions';
import type {Attempt} from './model';
import type {TestSession} from '../exams/model';
const a={userId:'u',question_id:'q',attempt_id:'a',timestamp:'2026-01-01',correctness:'falsch',auto_scored:true,self_assessed:false,subparts:[]} as unknown as Attempt;
const t={userId:'u',test_id:'t',status:'completed',completed_at:'2026-01-02',question_ids:['q'],result:{byQuestion:{q:'teilweise'}}} as unknown as TestSession;
test('test identities deduplicate mirrored attempts, all invalid lifecycle states and pending U are excluded',()=>{
 expect(wrongResults('u',[{...a,test_id:'t'},{...a,test_session_id:'t'} as Attempt,{...a,exam_session_id:'t'} as Attempt],[t,t])).toHaveLength(1);
 for(const status of ['active','paused','abandoned','discarded'] as const)expect(wrongResults('u',[],[{...t,status}])).toEqual([]);
 for(const extra of [{deleted_at:'2026-01-03'},{discarded_at:'2026-01-03'}])expect(wrongResults('u',[],[{...t,...extra}])).toEqual([]);
 expect(wrongResults('u',[],[{...t,result:{...t.result!,byQuestion:{q:'pending'}}}])).toEqual([]);
 expect(wrongResults('u',[{...a,self_assessed:true,auto_scored:false,subparts:[]}],[])).toEqual([]);
});
test('rebuild removes invalidated sources, restores them once and keeps replay stable',()=>{
 const results=wrongResults('u',[a],[t]),first=reconcileWrongQuestions('u',results,[],'2026-01-03');
 expect(first[0]).toMatchObject({active:true,wrong_count:2});
 expect(reconcileWrongQuestions('u',results,first,'2026-01-04')).toEqual(first);
 const removed=reconcileWrongQuestions('u',[],first,'2026-01-04');expect(removed[0]).toMatchObject({active:false,wrong_count:0});
 expect(reconcileWrongQuestions('u',results,removed,'2026-01-05')[0]).toMatchObject({active:true,wrong_count:2});
});
import {reduceSession} from '../exams/model';
test('late U self-assessment uses actual result time and cannot be healed by earlier answers',()=>{
 const pending={...t,completed_at:'2026-01-02T00:00:00Z',revision:0,answers:{q:{part:'answer'}},question_models:{q:{kind:'multi_part',subpart_ids:['part']}},subpart_assessments:{},result:null} as unknown as TestSession;
 const later=reduceSession(pending,{type:'assess',questionId:'q',assessments:{part:'falsch'}},Date.parse('2026-01-05T00:00:00Z'));
 const correct=[{...a,attempt_id:'a2',timestamp:'2026-01-03',correctness:'richtig' as const},{...a,attempt_id:'a3',timestamp:'2026-01-04',correctness:'richtig' as const}];
 expect(reconcileWrongQuestions('u',wrongResults('u',correct,[later]),[],'2026-01-06')[0]).toMatchObject({active:true,consecutive_correct:0,last_wrong_at:'2026-01-05T00:00:00.000Z'});
 const same=reduceSession(later,{type:'assess',questionId:'q',assessments:{part:'falsch'}},Date.parse('2026-01-06'));expect(same.assessment_updated_at).toEqual(later.assessment_updated_at);
});
import type {WrongQuestionState,WrongResult} from './wrongQuestions';
const event=(id:string,correctness:WrongResult['correctness']):WrongResult=>({id,question_id:'q',timestamp:`2026-02-0${id}`,correctness});
const replay=(rows:WrongResult[],old:WrongQuestionState[]=[])=>reconcileWrongQuestions('u',rows,old,'2026-03-01');
test('four stages advance only after a wrong, master on third correct, demote on partial and retain history',()=>{
 expect(replay([event('1','richtig')])).toEqual([]);
 const rows=[event('1','falsch'),event('2','richtig'),event('3','richtig'),event('4','richtig'),event('5','teilweise')];
 for(const [count,stage] of [[1,1],[2,2],[3,3],[4,'mastered'],[5,1]] as const)expect(replay(rows.slice(0,count))[0]).toMatchObject({stage,stage_version:2,active:stage!=='mastered'});
 const mastered=replay(rows.slice(0,4));expect(replay(rows.slice(0,4),mastered)).toEqual(mastered);
 expect(replay(rows.slice(0,3),mastered)[0].stage).toBe(3);
 expect(replay([],mastered)[0]).toMatchObject({stage:null,active:false,wrong_count:0});
});
test('legacy migration caps all old corrects at stage3, preserves audit and needs a new final correct',()=>{
 const rows=[event('1','falsch'),event('2','richtig'),event('3','richtig'),event('4','richtig')];
 const legacy:WrongQuestionState={userId:'u',question_id:'q',active:false,entered_at:'2026-02-01',last_wrong_at:'2026-02-01',wrong_count:1,consecutive_correct:3,dismissed_at:null,dismissed_result_ids:[],updated_at:'2026-02-04',revision:4};
 const before=JSON.stringify(legacy),migrated=replay(rows,[legacy]);expect(migrated[0]).toMatchObject({stage:3,active:true,migration:{legacy_snapshot:legacy}});expect(JSON.stringify(legacy)).toBe(before);
 expect(replay(rows,migrated)).toEqual(migrated);expect(replay([...rows,event('5','richtig')],migrated)[0].stage).toBe('mastered');
 expect(replay(rows.slice(0,2),migrated)[0].stage).toBe(2);expect(replay([],migrated)[0].stage).toBeNull();
});
import {validWrongQuestionState,resultKey} from './wrongQuestions';
test('legacy active stages and manual dismissal survive migration, while new wrong reactivates',()=>{
 const rows=[event('1','falsch'),event('2','richtig'),event('3','richtig')];
 for(const [count,stage] of [[1,1],[2,2],[3,3]] as const){const current=replay(rows.slice(0,count))[0];const {stage_version:_v,stage:_s,...legacy}=current;expect(replay(rows.slice(0,count),[legacy])[0].stage).toBe(stage);}
 const current=replay(rows)[0],{stage_version:_v,stage:_s,...legacy}=current;
 const hidden={...legacy,active:false,dismissed_at:'2026-02-04',dismissed_result_ids:rows.map(resultKey)};
 const migrated=replay(rows,[hidden]);expect(migrated[0]).toMatchObject({stage:null,active:false});expect(replay(rows,migrated)).toEqual(migrated);
 expect(replay([...rows,event('5','falsch')],migrated)[0]).toMatchObject({stage:1,active:true});
 expect(replay(rows,[{...hidden,dismissed_result_ids:rows.map(r=>r.id+':'+r.correctness)}])[0].stage).toBeNull();
});
test('validation accepts legacy and version2 records and rejects invalid stages or audit metadata',()=>{
 const state=replay([event('1','falsch')])[0],{stage_version:_v,stage:_s,...legacy}=state;
 expect(validWrongQuestionState(legacy)).toBe(true);expect(validWrongQuestionState(state)).toBe(true);
 const migrated=replay([event('1','falsch')],[legacy])[0];expect(validWrongQuestionState(migrated)).toBe(true);
 expect(validWrongQuestionState({...state,stage:4})).toBe(false);expect(validWrongQuestionState({...state,stage_version:3})).toBe(false);
 expect(validWrongQuestionState({...migrated,migration:{...migrated.migration,cutover_result_ids:[1]}})).toBe(false);
 expect(validWrongQuestionState({...migrated,userId:'imported-profile'})).toBe(true);
});
