import type Dexie from 'dexie';
import type {SyncPersistence} from '../sync/persistence';
import {validAttempt,type Attempt,type LearningSession} from '../learning/model';
import {emptyStates,eligibleAttempt,isFreeAttempt,latestInRun,progressId,stateFor,validDescriptor,type ModuleDescriptor,type ModuleProgress,type ModuleRun} from '../learning/moduleProgress';

/** Only free-practice mutations enter this store; exam/test sessions never do. */
export class ModuleProgressStore {
 constructor(private db:Dexie,private sync:SyncPersistence){}
 private put(entity:'moduleProgress'|'moduleRuns'|'attempts'|'learningSessions',value:object,add=false){return this.sync.put(entity,value as Record<string,unknown>,add);}
 list(userId:string):Promise<ModuleProgress[]>{return this.db.table('moduleProgress').where('userId').equals(userId).toArray();}
 runs(userId:string):Promise<ModuleRun[]>{return this.db.table('moduleRuns').where('userId').equals(userId).toArray();}
 private async current(userId:string,id:string,runId:string,qid?:string):Promise<ModuleProgress>{const p=await this.db.table<ModuleProgress>('moduleProgress').get([userId,id]);if(!p||p.run_id!==runId||qid&&!p.question_ids.includes(qid))throw Error('Die Lernrunde wurde geändert. Bitte neu laden.');return p;}
 async ensure(userId:string,d:ModuleDescriptor):Promise<ModuleProgress>{if(!userId||!validDescriptor(d))throw Error('Ungültiges Modul.');return this.db.transaction('rw',this.sync.tables(),async()=>{
  const id=progressId(d),existing=await this.db.table<ModuleProgress>('moduleProgress').get([userId,id]);if(existing){if(JSON.stringify(existing.question_ids)!==JSON.stringify(d.question_ids))throw Error('Modulidentität geändert.');return existing;}
  const stamp=new Date().toISOString(),attempts=await this.db.table<Attempt>('attempts').where('userId').equals(userId).toArray();
  const legacy=attempts.filter(a=>d.question_ids.includes(a.question_id)&&(!a.exam||a.exam===d.exam)&&(!a.module||a.module===d.module)&&!a.progress_run_id&&eligibleAttempt(a));
  const run:ModuleRun={...d,userId,progress_id:id,run_id:id+'/'+crypto.randomUUID(),generation:1,started_at:stamp,legacy_attempt_ids:legacy.map(a=>a.attempt_id)};
  const questionStates=emptyStates(d.question_ids);for(const qid of d.question_ids)questionStates[qid]=stateFor(latestInRun(legacy,run,qid));
  const p:ModuleProgress={...d,id,userId,generation:1,run_id:run.run_id,questionStates,started_at:stamp,reset_at:null,updated_at:stamp,revision:1};await this.put('moduleRuns',run,true);await this.put('moduleProgress',p,true);return p;
 });}
 async saveSession(s:LearningSession,id:string,runId:string){await this.db.transaction('rw',this.sync.tables(),async()=>{const p=await this.current(s.userId,id,runId,s.question_id);await this.put('learningSessions',{...s,exam:p.exam,module:p.module,progress_run_id:runId,progress_generation:p.generation});});}
 async saveAttempt(a:Attempt,s:LearningSession,id:string,runId:string):Promise<Attempt>{if(!isFreeAttempt(a)||!validAttempt(a)||a.userId!==s.userId||a.question_id!==s.question_id)throw Error('Ungültiger Versuch.');return this.db.transaction('rw',this.sync.tables(),async()=>{
  const p=await this.current(a.userId,id,runId,a.question_id);const result={...a,exam:p.exam,module:p.module,progress_run_id:runId,progress_generation:p.generation,progress_order:p.revision+1};
  await this.put('attempts',result,true);await this.put('learningSessions',{...s,exam:p.exam,module:p.module,progress_run_id:runId,progress_generation:p.generation,attempt_id:a.attempt_id});
  const questionStates={...p.questionStates};if(eligibleAttempt(result))questionStates[a.question_id]=stateFor(result);await this.put('moduleProgress',{...p,questionStates,updated_at:new Date().toISOString(),revision:p.revision+1});return result;
 });}
 async reset(userId:string,id:string,revision:number,runId:string):Promise<ModuleProgress>{return this.db.transaction('rw',this.sync.tables(),async()=>{
  const p=await this.current(userId,id,runId);if(p.revision!==revision)throw Error('Fortschritt inzwischen geändert. Bitte erneut prüfen.');const stamp=new Date().toISOString(),generation=p.generation+1;
  const run:ModuleRun={userId,progress_id:id,exam:p.exam,module:p.module,question_ids:p.question_ids,run_id:id+'/'+crypto.randomUUID(),generation,started_at:stamp,legacy_attempt_ids:[]};await this.put('moduleRuns',run,true);
  const next={...p,run_id:run.run_id,generation,questionStates:emptyStates(p.question_ids),started_at:stamp,reset_at:stamp,updated_at:stamp,revision:p.revision+1};await this.put('moduleProgress',next);
  for(const question_id of p.question_ids)await this.put('learningSessions',{userId,question_id,exam:p.exam,module:p.module,progress_run_id:run.run_id,progress_generation:generation,draft:{},revealed:false,updated_at:stamp});return next;
 });}
 async deleteAttempt(userId:string,id:string,attemptId:string,runId:string){await this.db.transaction('rw',this.sync.tables(),async()=>{
  const p=await this.current(userId,id,runId),a=await this.db.table<Attempt>('attempts').get([userId,attemptId]);if(!a||!isFreeAttempt(a)||!p.question_ids.includes(a.question_id)||a.exam&&a.exam!==p.exam||a.module&&a.module!==p.module)throw Error('Versuch nicht in diesem Modul.');
  await this.sync.remove('attempts',userId,attemptId);
  if(p.questionStates[a.question_id]?.attempt_id===attemptId){const run=await this.db.table<ModuleRun>('moduleRuns').get([userId,p.run_id]);if(!run)throw Error('Lernrunde nicht verfügbar.');const remaining=await this.db.table<Attempt>('attempts').where('userId').equals(userId).toArray();await this.put('moduleProgress',{...p,questionStates:{...p.questionStates,[a.question_id]:stateFor(latestInRun(remaining,run,a.question_id))},revision:p.revision+1,updated_at:new Date().toISOString()});}
  const s=await this.db.table<LearningSession>('learningSessions').get([userId,a.question_id]);if(s?.attempt_id===attemptId)await this.put('learningSessions',{userId,question_id:a.question_id,exam:p.exam,module:p.module,progress_run_id:p.run_id,progress_generation:p.generation,draft:{},revealed:false,updated_at:new Date().toISOString()});
 });}
}
