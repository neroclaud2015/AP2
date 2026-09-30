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
