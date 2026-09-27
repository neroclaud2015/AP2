import 'fake-indexeddb/auto';
import {expect,test} from 'vitest';
import {IndexedDBProgressRepository} from './storage';
test('attempt history and active learning session persist independently of machine answers',async()=>{
 const name='learning-'+crypto.randomUUID();const repo=new IndexedDBProgressRepository(name);
 expect(typeof repo.saveAttempt).toBe('function');
 const attempt={attempt_id:'one',userId:'local',question_id:'q1',timestamp:new Date().toISOString(),user_answer:{choice:3},correctness:'falsch' as const,partial_status:false,unsure:true,confidence:'unsure' as const,hints_used:[],error_reason:'Misread',note:'Practice',self_assessed:false,auto_scored:true,subparts:[],official_answer_snapshot:4};
 await repo.saveAttempt(attempt);await repo.saveLearningSession({userId:'local',question_id:'q1',draft:{choice:'3'},revealed:true,attempt_id:'one'});repo.close();
 const next=new IndexedDBProgressRepository(name);expect(await next.getAttempts('local')).toEqual([attempt]);expect((await next.getLearningSessions('local'))[0].revealed).toBe(true);
 await expect(next.saveAttempt({...attempt,user_answer:{choice:4}})).rejects.toThrow();
 expect(await next.getAttempts('other')).toEqual([]);expect((await next.getAttempts('local'))[0].correctness).toBe('falsch');next.close();
});
