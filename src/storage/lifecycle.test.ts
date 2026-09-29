import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {it,expect} from 'vitest';
import {IndexedDBProgressRepository} from './storage';
import {isEligibleForAnalysis,reduceSession,type TestSession} from '../exams/model';
const fixture=():TestSession=>({test_id:crypto.randomUUID(),exam_session_id:'session',userId:'local',test_type:'original',exam:'2017-sommer',module:'arbeitsplanung',mode:'kurz',seed:'seed',question_ids:['q'],question_models:{q:{kind:'multiple_choice',subpart_ids:[],number:'1',part:'A'}},source_mix:[],answers:{q:{choice:'2'}},subpart_assessments:{},official_answers:{q:2},started_at:'2026-01-01T00:00:00Z',completed_at:null,status:'active',current_question:'q',elapsed_time:0,active_since:1000,revision:0,duration_minutes:105,result:null});
it('normalizes submitted to completed losslessly in v6 and preserves ordinary tables',async()=>{
 const name='lifecycle-migration-'+crypto.randomUUID(),old=new Dexie(name);
 old.version(5).stores({records:'[userId+questionId],userId',reviews:'[userId+question_id],userId',answerReviews:'[userId+question_id],userId',attempts:'[userId+attempt_id],userId,[userId+question_id]',learningSessions:'[userId+question_id],userId',testSessions:'[userId+test_id],userId,[userId+module],[userId+status]'});
 const legacy={...fixture(),status:'submitted',completed_at:'2026-01-01T00:02:00Z',custom_old_field:{retain:true}};await old.table('testSessions').put(legacy);const ordinary={userId:'local',attempt_id:'keep',question_id:'q',test_id:legacy.test_id,note:'ordinary attempt must stay'};await old.table('attempts').put(ordinary);old.close();
 const repo=new IndexedDBProgressRepository(name);expect(await repo.getTestSession('local',legacy.test_id)).toEqual({...legacy,status:'completed'});expect(await repo.getAttempts('local')).toEqual([ordinary]);repo.close();await Dexie.delete(name);
});
it('discards completed results without erasing them and excludes all ineligible statuses',()=>{
 const complete=reduceSession(fixture(),{type:'submit'},2000);expect(complete.status).toBe('completed');expect(isEligibleForAnalysis(complete)).toBe(true);
 const discarded=reduceSession(complete,{type:'discard'},3000);expect(discarded.status).toBe('discarded');expect(discarded.answers).toEqual(complete.answers);expect(discarded.result).toEqual(complete.result);expect(discarded.completed_at).toBe(complete.completed_at);expect(isEligibleForAnalysis(discarded)).toBe(false);
 for(const status of ['active','paused','abandoned','discarded'] as const)expect(isEligibleForAnalysis({...complete,status})).toBe(false);
 expect(()=>reduceSession(discarded,{type:'resume'})).toThrow();expect(()=>reduceSession(discarded,{type:'answer',questionId:'q',answer:{choice:'3'}})).toThrow();
});
it('revision checks serialize discard/delete and never delete free attempts or another session',async()=>{
 const name='lifecycle-delete-'+crypto.randomUUID(),repo=new IndexedDBProgressRepository(name);const created=await repo.createTestSession({...fixture(),answers:{}});const other=await repo.createTestSession({...fixture(),answers:{},module:'funktionsanalyse'});
 const note=await repo.saveQuestionNote('local','q','Keep after test deletion',0,'');
 const answered=await repo.updateTestSession('local',created.test_id,0,{type:'answer',questionId:'q',answer:{choice:'2'}});await expect(repo.discardTestSession('local',created.test_id,0)).rejects.toThrow();await expect(repo.deleteTestSession('local',created.test_id,0)).rejects.toThrow();
 const completed=await repo.updateTestSession('local',created.test_id,answered.revision,{type:'submit'});expect((await repo.getAnalysisTestSessions('local')).map(s=>s.test_id)).toEqual([created.test_id]);
 const discarded=await repo.discardTestSession('local',created.test_id,completed.revision);expect(await repo.getAnalysisTestSessions('local')).toEqual([]);expect(discarded.result?.richtig).toBe(1);expect(await repo.getQuestionNote('local','q')).toEqual(note);
 const raw=new Dexie(name);await raw.open();const ordinary={userId:'local',attempt_id:'same-id',question_id:'q',test_id:created.test_id};await raw.table('attempts').put(ordinary);
 await expect(repo.deleteTestSession('other-user',created.test_id,discarded.revision)).rejects.toThrow();await repo.deleteTestSession('local',created.test_id,discarded.revision);expect(await repo.getTestSession('local',created.test_id)).toBeUndefined();expect(await repo.getQuestionNote('local','q')).toEqual(note);expect(await repo.getTestSession('local',other.test_id)).toEqual(other);expect(await repo.getAttempts('local')).toEqual([ordinary]);raw.close();repo.close();await Dexie.delete(name);
});
it('allows only one mixed module session across seasons while keeping originals separate',async()=>{
 const name='lifecycle-crossyear-'+crypto.randomUUID(),repo=new IndexedDBProgressRepository(name);const summer={...fixture(),test_type:'module' as const,answers:{}};await repo.createTestSession(summer);
 await expect(repo.createTestSession({...fixture(),test_type:'module',answers:{},exam:'2017-winter'})).rejects.toThrow();
 await repo.createTestSession({...fixture(),answers:{},exam:'2017-winter'});await repo.createTestSession({...fixture(),answers:{},exam:'2017-sommer'});expect(await repo.getTestSessions('local')).toHaveLength(3);repo.close();await Dexie.delete(name);
});
it('an answer racing permanent deletion cannot resurrect a session',async()=>{
 const name='lifecycle-delete-race-'+crypto.randomUUID(),repo=new IndexedDBProgressRepository(name);const s=await repo.createTestSession({...fixture(),answers:{}});
 const result=await Promise.allSettled([repo.deleteTestSession('local',s.test_id,0),repo.updateTestSession('local',s.test_id,0,{type:'answer',questionId:'q',answer:{choice:'2'}})]);
 expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);const remaining=await repo.getTestSession('local',s.test_id);expect(remaining===undefined||remaining.revision===1).toBe(true);repo.close();await Dexie.delete(name);
});
