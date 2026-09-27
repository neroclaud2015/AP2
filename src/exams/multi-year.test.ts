import {describe,it,expect} from 'vitest';
import {createSession,type SessionPool} from './model';
import {MODULES} from '../learning/modules';
import ap from '../../public/data/2017_sommer_arbeitsplanung_segmented.json';
import keys from '../../public/data/2017_sommer_arbeitsplanung_answers.json';
import u from '../../public/data/2017_sommer_arbeitsplanung_u_solutions.json';
import type {SegmentedExam} from '../segmented/types';
import type {OfficialAnswer} from '../segmented/answers';
import type {USolution} from '../learning/model';
const summer:SessionPool={config:MODULES[0],exam:ap as unknown as SegmentedExam,officialAnswers:keys.answers as OfficialAnswer[],solutions:u.solutions as USolution[]};
const winter:SessionPool={config:{...summer.config,examId:'2017-18-winter'},exam:{...summer.exam,exam:'2017_18_winter',questions:summer.exam.questions.map(q=>({...q,question_id:'winter-fixture-'+q.question_id,exam:'2017_18_winter'}))},officialAnswers:summer.officialAnswers.map(a=>({...a,question_id:'winter-fixture-'+a.question_id})),solutions:summer.solutions.map(a=>({...a,question_id:'winter-fixture-'+a.question_id}))};
describe('cross-season module selection',()=>{
 it('balances each kind over two seasons deterministically without duplicate identities',()=>{
  for(const mode of ['kurz','standard'] as const){const a=createSession({...summer,type:'module',pools:[summer,winter],mode,seed:'acceptance'});const b=createSession({...summer,type:'module',pools:[summer,winter],mode,seed:'acceptance'});
   expect(a.question_ids).toEqual(b.question_ids);expect(new Set(a.question_ids).size).toBe(a.question_ids.length);
   expect(new Set(a.source_mix.map(s=>s.exam))).toEqual(new Set(['2017-sommer','2017-18-winter']));
   for(const kind of ['multiple_choice','multi_part']){const sources=a.source_mix.filter(s=>a.question_models[s.question_id].kind===kind);expect(sources.filter(s=>s.exam==='2017-sommer').length).toBe(sources.length/2);}
  }
 });
 it('keeps the original paper complete and source-specific even with extra pools',()=>{const s=createSession({...winter,type:'original',pools:[summer,winter]});expect(s.question_ids).toEqual(winter.exam.questions.map(q=>q.question_id));expect(s.source_mix.every(q=>q.exam==='2017-18-winter')).toBe(true);});
 it('fails closed on wrong-season dataset association',()=>{expect(()=>createSession({...summer,type:'original',config:winter.config})).toThrow(/Prüfungsquelle/);});
 it('fails closed on shared IDs across source seasons',()=>{expect(()=>createSession({...summer,type:'module',pools:[summer,{...winter,exam:{...winter.exam,questions:winter.exam.questions.map((q,i)=>({...q,question_id:summer.exam.questions[i].question_id}))}}]})).toThrow(/identität/);});
});
