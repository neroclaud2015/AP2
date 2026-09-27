import {describe,it,expect} from 'vitest';
import {createSession,reduceSession,elapsedMs,sessionResult} from './model';
import {MODULES} from '../learning/modules';
import ap from '../../public/data/2017_sommer_arbeitsplanung_segmented.json';
import keys from '../../public/data/2017_sommer_arbeitsplanung_answers.json';
import u from '../../public/data/2017_sommer_arbeitsplanung_u_solutions.json';
import type {SegmentedExam} from '../segmented/types';
import type {OfficialAnswer} from '../segmented/answers';
import type {USolution} from '../learning/model';
const input={config:MODULES[0],exam:ap as unknown as SegmentedExam,officialAnswers:keys.answers as OfficialAnswer[],solutions:u.solutions as USolution[],now:1000};
const make=()=>createSession({...input,type:'original'});
describe('isolated exam sessions',()=>{
 it('keeps unknown official timing unconfirmed',()=>{const s=createSession({...input,type:'original',config:{...input.config,durationMinutes:null}});expect(s.duration_minutes).toBeNull();});
 it('keeps completed results and key snapshots immutable across Review changes',()=>{const copied=input.officialAnswers.map(a=>({...a}));let s=createSession({...input,type:'original',officialAnswers:copied});const id=s.question_ids[0],key=s.official_answers[id];copied[0].official_answer=1;s=reduceSession(s,{type:'answer',questionId:id,answer:{choice:String(key)}});s=reduceSession(s,{type:'submit'});expect(s.result?.richtig).toBe(1);expect(s.official_answers[id]).toBe(key);expect(()=>reduceSession(s,{type:'resume'})).toThrow();});
 it('rejects incomplete or ambiguous original papers before starting',()=>{
  expect(()=>createSession({...input,type:'original',exam:{...input.exam,questions:input.exam.questions.slice(1)}})).toThrow();
  const questions=[...input.exam.questions];questions[1]={...questions[1],question_number:questions[0].question_number};
  expect(()=>createSession({...input,type:'original',exam:{...input.exam,questions}})).toThrow();
 });
 it('uses every original question in registered order and starts blank',()=>{const s=make();expect(s.question_ids.length).toBe(36);expect(s.question_ids.map(id=>s.question_models[id].number)).toEqual([...Array.from({length:28},(_,i)=>String(i+1)),...Array.from({length:8},(_,i)=>'U'+(i+1))]);expect(s.answers).toEqual({});expect(s.subpart_assessments).toEqual({});});
 it('seeded tests are repeatable, unique and proportionate',()=>{for(const [mode,a,b] of [['kurz',6,2],['standard',12,4]] as const){const x=createSession({...input,type:'module',mode,seed:'same'}),y=createSession({...input,type:'module',mode,seed:'same'});expect(x.question_ids).toEqual(y.question_ids);expect(new Set(x.question_ids).size).toBe(a+b);expect(x.question_ids.filter(id=>x.question_models[id].kind==='multiple_choice')).toHaveLength(a);expect(x.duration_minutes).toBeNull();expect(x.source_mix.every(q=>q.exam==='2017-sommer')).toBe(true);}});
 it('counts elapsed time across refresh, excluding explicit pause; timeout never submits',()=>{let s=make();expect(elapsedMs(s,6000)).toBe(5000);s=reduceSession(s,{type:'pause'},6000);expect(elapsedMs(s,10000)).toBe(5000);s=reduceSession(s,{type:'resume'},20000);expect(elapsedMs(s,22000)).toBe(7000);expect(s.status).toBe('active');expect(elapsedMs(s,9999999)).toBeGreaterThan(105*60000);expect(s.status).toBe('active');});
 it('hides result until submission and does not count unassessed U as false',()=>{let s=make();const mc=s.question_ids[0],uid=s.question_ids[28];s=reduceSession(s,{type:'answer',questionId:mc,answer:{choice:String(s.official_answers[mc])}});s=reduceSession(s,{type:'answer',questionId:uid,answer:{'1':'my answer'}});expect(s.result).toBeNull();s=reduceSession(s,{type:'submit'},5000);expect(sessionResult(s)).toMatchObject({beantwortet:2,richtig:1,falsch:0,unbeantwortet:34,pending:1,vorlaeufig:true});const a=Object.fromEntries(s.question_models[uid].subpart_ids.map((id,i)=>[id,i?'falsch':'richtig'])) as Record<string,'richtig'|'falsch'>;s=reduceSession(s,{type:'assess',questionId:uid,assessments:a});expect(s.result).toMatchObject({teilweise:1,pending:0,vorlaeufig:false});});
 it('rejects out-of-session answers, early assessments and edits after submission',()=>{let s=make();expect(()=>reduceSession(s,{type:'answer',questionId:'foreign',answer:{choice:'3'}})).toThrow();expect(()=>reduceSession(s,{type:'assess',questionId:s.question_ids[28],assessments:{'1':'richtig'}})).toThrow();s=reduceSession(s,{type:'submit'});expect(()=>reduceSession(s,{type:'answer',questionId:s.question_ids[0],answer:{choice:'2'}})).toThrow();});
 it('keeps unsupported or missing official keys pending rather than guessing',()=>{let s=make();const q=s.question_ids[0];s={...s,official_answers:{...s.official_answers,[q]:null}};s=reduceSession(s,{type:'answer',questionId:q,answer:{choice:'3'}});s=reduceSession(s,{type:'submit'});expect(s.result).toMatchObject({pending:1,falsch:0,vorlaeufig:true});});
});
