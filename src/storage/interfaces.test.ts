import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import Dexie from 'dexie';
import {IndexedDBProgressRepository,LocalUserProvider} from './storage';
it('supports isolated non-local attempts and rejects mismatched paired session ownership',async()=>{
 const name='users-'+crypto.randomUUID(),repo=new IndexedDBProgressRepository(name);
 const a={attempt_id:'same',userId:'alice',question_id:'q',timestamp:new Date().toISOString(),user_answer:{choice:2},correctness:'richtig' as const,partial_status:false,unsure:false,confidence:'sure' as const,hints_used:[],error_reason:'',note:'Alice',self_assessed:false,auto_scored:true,subparts:[]};
 await repo.saveAttempt(a);await repo.saveAttempt({...a,userId:'bob',note:'Bob'});
 expect((await repo.getAttempts('alice'))[0].note).toBe('Alice');expect((await repo.getAttempts('bob'))[0].note).toBe('Bob');
 await expect(repo.saveAttempt({...a,attempt_id:'bad'},{userId:'bob',question_id:'q',draft:{},revealed:false})).rejects.toThrow();
 expect(await repo.getLearningSessions('bob')).toEqual([]);repo.close();await Dexie.delete(name);
});
it('local auth restores identity and explicitly rejects real login',async()=>{
 const auth=new LocalUserProvider();expect(await auth.restoreSession()).toEqual({id:'local',mode:'local'});await expect(auth.login({})).rejects.toThrow();await auth.logout();expect((await auth.currentUser()).id).toBe('local');
});
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppServicesProvider,useAppServices,type AppServices} from '../services/context';
import {NoopSyncProvider} from '../services/composition';
import type {TestSession} from '../exams/model';
import type {QuestionReview} from '../segmented/types';
import type {ProgressRepository} from '../types';
it('isolates all personal tables, exports one owner, and confines review imports',async()=>{
 const name='all-users-'+crypto.randomUUID(),repo:ProgressRepository=new IndexedDBProgressRepository(name);
 const review:QuestionReview={userId:'alice',question_id:'q',source_revision:'old',question_number:'1',bounding_box:[0,0,2,2],regions:[[0,0,2,2]],extracted_text:'Alice',tags:[],solution_page:null,solution_confirmed:false,review_status:'confirmed',updated_at:'old'};
 for(const userId of ['alice','bob']){
  await repo.saveCorrection(userId,'q','note',userId);await repo.saveReview({...review,userId,extracted_text:userId});await repo.saveAnswerReview({userId,question_id:'q',official_answer:2,official_answer_status:'confirmed',user_corrected:true,locked:true,parser_revision:'old',updated_at:'old'});
  await repo.saveLearningSession({userId,question_id:'q',draft:{note:userId},revealed:false});
  await repo.createTestSession({test_id:'same',exam_session_id:'same',userId,test_type:'original',exam:'exam',module:'module',mode:'kurz',seed:'x',question_ids:['q'],question_models:{q:{kind:'multiple_choice',number:'1',part:'A',subpart_ids:[]}},source_mix:[],answers:{},subpart_assessments:{},official_answers:{q:2},started_at:new Date().toISOString(),completed_at:null,status:'active',current_question:'q',elapsed_time:0,active_since:Date.now(),revision:0,duration_minutes:null,result:null} as TestSession);
 }
 await expect(repo.importReviews([review],[],'bob')).rejects.toThrow();await expect(repo.importReviews([review,{...review,userId:'bob'}])).rejects.toThrow();
 const bob=await repo.exportSnapshot('bob');await repo.discardTestSession('alice','same',0);await repo.deleteTestSession('alice','same',1);expect(await repo.exportSnapshot('bob')).toEqual(bob);
 const alice=await repo.exportSnapshot('alice');for(const records of [alice.records,alice.reviews,alice.answerReviews,alice.learningSessions])expect(records.every(r=>r.userId==='alice')).toBe(true);expect(alice.testSessions).toEqual([]);
 (repo as IndexedDBProgressRepository).close();await Dexie.delete(name);
});
it('injects interface-only services and exposes explicitly inert sync operations',async()=>{
 const auth=new LocalUserProvider(),sync=new NoopSyncProvider();const repository={getRecords:async()=>[]} as unknown as ProgressRepository;
 const services:AppServices={repository,auth,sync,user:{id:'injected-user',mode:'remote'}};
 function Probe(){const value=useAppServices();expect(value.repository).toBe(repository);return createElement('span',null,value.user.id);}
 expect(renderToStaticMarkup(createElement(AppServicesProvider,{services,children:createElement(Probe)}))).toContain('injected-user');
 for(const result of [await sync.pull(services.user),await sync.push(services.user),await sync.sync(services.user),await sync.resolveConflict(services.user,{entity:'attempt',id:'x',local:{},remote:{}},'local')])expect(result.status).toBe('noop');
});
