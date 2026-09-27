import {describe,it,expect} from 'vitest';
import {readRoute,routeUrl,moduleProgress,moduleParts,questionPart,MODULES} from './modules';
import type {Attempt,LearningSession} from './model';

describe('module routes',()=>{
 it('keeps old AP links compatible',()=>{
  expect(readRoute('?q=U3')).toEqual({view:'study',examId:'2017-sommer',module:'arbeitsplanung',number:'U3'});
  expect(readRoute('?view=review').module).toBe('arbeitsplanung');
 });
 it('round trips explicit module and Review question through URLs',()=>{
  const route=readRoute('?view=review&exam=2017-sommer&module=funktionsanalyse&q=9');
  expect(readRoute(routeUrl(route,'https://example.test/app/').search)).toEqual(route);
  expect(route.module).toBe('funktionsanalyse');
 });
 it('normalizes unavailable exams and modules without opening another archive',()=>{
  expect(readRoute('?exam=2018-winter&module=wiso').module).toBe('arbeitsplanung');
  expect(MODULES.map(m=>m.slug)).toEqual(['arbeitsplanung','funktionsanalyse']);
 });
});
describe('module progress isolation',()=>{
 it('filters by stable IDs and resumes the latest draft within each module',()=>{
  const questions=[{question_id:'ap-q1',question_number:'1'},{question_id:'ap-u1',question_number:'U1'}];
  const attempts=[{question_id:'ap-q1',timestamp:'2026-01-01',correctness:'falsch'},{question_id:'ap-q1',timestamp:'2026-01-02',correctness:'richtig'},{question_id:'fa-q1',timestamp:'2026-01-03',correctness:'richtig'}] as Attempt[];
  const sessions=[{question_id:'ap-u1',updated_at:'2026-01-04'},{question_id:'fa-q1',updated_at:'2026-01-05'}] as LearningSession[];
  expect(moduleProgress(questions,attempts,sessions)).toMatchObject({practiced:1,attempts:2,correct:1,lastActivity:'2026-01-04',resumeNumber:'U1'});
 });
});
import 'fake-indexeddb/auto';
import {IndexedDBProgressRepository} from '../storage/storage';
it('retains separate drafts and results for equally numbered AP/FA questions after reopen',async()=>{
 const name='modules-'+crypto.randomUUID();const repo=new IndexedDBProgressRepository(name);
 const make=(id:string,choice:number):Attempt=>({attempt_id:id+'-attempt',question_id:id,userId:'local',timestamp:'2026-01-01T10:00:00Z',user_answer:{choice},correctness:'richtig',partial_status:false,unsure:false,confidence:'sure',hints_used:[],error_reason:'',note:id,self_assessed:false,auto_scored:true,subparts:[]});
 await repo.saveAttempt(make('ap-q1',2),{userId:'local',question_id:'ap-q1',draft:{choice:'2',note:'AP'},revealed:true,attempt_id:'ap-q1-attempt'});
 await repo.saveAttempt(make('fa_2017-p2-h1',4),{userId:'local',question_id:'fa_2017-p2-h1',draft:{choice:'4',note:'FA'},revealed:true,attempt_id:'fa_2017-p2-h1-attempt'});
 repo.close();const reopened=new IndexedDBProgressRepository(name);const sessions=await reopened.getLearningSessions('local');const attempts=await reopened.getAttempts('local');
 expect(sessions.find(s=>s.question_id==='ap-q1')?.draft).toEqual({choice:'2',note:'AP'});
 expect(sessions.find(s=>s.question_id==='fa_2017-p2-h1')?.draft).toEqual({choice:'4',note:'FA'});
 expect(moduleProgress([{question_id:'ap-q1',question_number:'1'}],attempts,sessions).attempts).toBe(1);
 expect(moduleProgress([{question_id:'fa_2017-p2-h1',question_number:'1'}],attempts,sessions).attempts).toBe(1);
 reopened.close();
});

it('derives parts and answer kind from registered question membership, not label prefixes',()=>{
 const config={...MODULES[0],parts:[{id:'reasoning',title:'Begründung',kind:'multi_part' as const,label:'Offene Aufgaben',questionNumbers:['9','X']},{id:'choice',title:'Auswahl',kind:'multiple_choice' as const,label:'Auswahlaufgaben',questionNumbers:['U99']}]};
 const parts=moduleParts(config,[{question_number:'U99'},{question_number:'X'},{question_number:'9'}]);
 expect(parts[0].questions.map(q=>q.question_number)).toEqual(['9','X']);
 expect(questionPart(config,'9')?.kind).toBe('multi_part');
 expect(questionPart(config,'U99')?.kind).toBe('multiple_choice');
});

it('round-trips independent session routes and registers the official duration source',()=>{
 const r=readRoute('?view=session&exam=2017-sommer&module=funktionsanalyse&session=test-one');
 expect(r.view).toBe('session');expect(r.sessionId).toBe('test-one');
 expect(readRoute(routeUrl(r,'https://example.test/').search)).toEqual(r);
 for(const config of MODULES){expect(config.durationMinutes).toBe(105);expect(config.durationSource?.page).toBe(2);expect(config.durationSource?.pdf).toMatch(/assets\/pdfs\//);}
});
