import type Dexie from 'dexie';
import type {SyncPersistence} from '../sync/persistence';
import {validAttempt,type Attempt,type LearningSession} from '../learning/model';
import {canonicalTrainingDefinition,trainingDefinitionKey,validTrainingSnapshot,TRAINING_STORES,type TrainingDefinition,type TrainingRun,type TrainingProgress,type TrainingQuestionSnapshot,type TrainingStartOptions} from './model';

/** Run snapshots stay local; only ordinary small attempt records use existing sync. */
export class TrainingStore {
 constructor(private db:Dexie,private sync:SyncPersistence){}
 private tables(){return [...this.sync.tables(),...TRAINING_STORES];}
 runs(userId:string):Promise<TrainingRun[]>{return this.db.table('trainingRuns').where('userId').equals(userId).toArray();}
 progress(userId:string):Promise<TrainingProgress[]>{return this.db.table('trainingProgress').where('userId').equals(userId).toArray();}
 get(userId:string,runId:string):Promise<TrainingRun|undefined>{return this.db.table('trainingRuns').get([userId,runId]);}
 private async current(userId:string,runId:string,revision:number,qid?:string){const run=await this.get(userId,runId);if(!run||run.revision!==revision||qid&&!run.question_ids.includes(qid))throw Error('Training wurde geändert. Bitte neu laden.');return run;}
 private draft(run:TrainingRun,s:LearningSession):LearningSession {
  if(s.userId!==run.userId||!run.question_ids.includes(s.question_id)||!s.draft||typeof s.draft!=='object'||Array.isArray(s.draft)||Object.values(s.draft).some(v=>typeof v!=='string')||typeof s.revealed!=='boolean')throw Error('Ungültiger Trainingsentwurf.');
  const snapshot=run.snapshots[s.question_id];return {userId:run.userId,question_id:s.question_id,exam:snapshot.config.examId,module:snapshot.config.slug,draft:{...s.draft},revealed:s.revealed,...(s.attempt_id?{attempt_id:s.attempt_id}:{}),updated_at:new Date().toISOString()};
 }
 private async save(run:TrainingRun){const next={...run,revision:run.revision+1,updated_at:new Date().toISOString()};await this.db.table('trainingRuns').put(next);return next;}
 async start(userId:string,definition:TrainingDefinition,snapshots:TrainingQuestionSnapshot[],options:TrainingStartOptions={}):Promise<TrainingRun>{
  const normalized=canonicalTrainingDefinition(definition),key=trainingDefinitionKey(normalized);if(!userId.trim()||options.uncertainty&&options.stage!==undefined||options.stage!==undefined&&![1,2,3,'mastered'].includes(options.stage))throw Error('Ungültiges Training.');
  return this.db.transaction('rw',this.tables(),async()=>{
   const p=await this.db.table<TrainingProgress>('trainingProgress').get([userId,key]);
   if(options.stage===undefined&&!options.uncertainty&&!options.restart&&p){const existing=await this.get(userId,p.run_id);if(!existing)throw Error('Gespeichertes Training fehlt.');return existing;}
   if(!snapshots.length||snapshots.some(s=>!validTrainingSnapshot(s))||new Set(snapshots.map(s=>s.question.question_id)).size!==snapshots.length)throw Error('Keine gültige eindeutige Trainingsauswahl.');
   const now=new Date().toISOString(),ids=snapshots.map(s=>s.question.question_id);
   const run:TrainingRun={userId,run_id:crypto.randomUUID(),definition_key:key,definition:normalized,kind:options.uncertainty?'uncertainty':options.stage===undefined?'bank':'stage',...(options.stage===undefined?{}:{stage:options.stage}),question_ids:ids,snapshots:structuredClone(Object.fromEntries(snapshots.map(s=>[s.question.question_id,s]))),current_question:ids[0],drafts:{},attempt_ids:{},created_at:now,updated_at:now,revision:1};
   await this.db.table('trainingRuns').add(run);
   if(run.kind==='bank')await this.db.table('trainingProgress').put({userId,definition_key:key,run_id:run.run_id,revision:(p?.revision??0)+1,updated_at:now} satisfies TrainingProgress);
   return run;
  });
 }
 async saveDraft(userId:string,runId:string,revision:number,session:LearningSession){return this.db.transaction('rw',this.tables(),async()=>{const run=await this.current(userId,runId,revision,session.question_id),draft=this.draft(run,session);if(draft.attempt_id&&!run.attempt_ids[session.question_id]?.includes(draft.attempt_id))throw Error('Versuch gehört nicht zu diesem Training.');return this.save({...run,drafts:{...run.drafts,[session.question_id]:draft}});});}
 async move(userId:string,runId:string,revision:number,questionId:string){return this.db.transaction('rw',this.tables(),async()=>{const run=await this.current(userId,runId,revision,questionId);return this.save({...run,current_question:questionId});});}
 async saveAttempt(userId:string,runId:string,revision:number,attempt:Attempt,session:LearningSession):Promise<{run:TrainingRun;attempt:Attempt}>{return this.db.transaction('rw',this.tables(),async()=>{
  const run=await this.current(userId,runId,revision,attempt.question_id);
  if(!validAttempt(attempt)||attempt.userId!==userId||session.question_id!==attempt.question_id||attempt.test_id||attempt.progress_run_id||(attempt.training_run_id&&attempt.training_run_id!==runId))throw Error('Ungültiger Trainingsversuch.');
  const snapshot=run.snapshots[attempt.question_id],draft=this.draft(run,session);
  const saved:Attempt={...attempt,...snapshot.provenance,training_run_id:runId,exam:snapshot.config.examId,module:snapshot.config.slug,source_revision:snapshot.question.segmentation_revision,question_source_revision:snapshot.provenance?.question_source_revision??snapshot.question.segmentation_revision,...(snapshot.answer?{official_answer_snapshot:snapshot.answer.official_answer,official_answer_revision:snapshot.answer.parser_revision}:{})};
  await this.sync.put('attempts',saved as unknown as Record<string,unknown>,true);
  const next=await this.save({...run,drafts:{...run.drafts,[attempt.question_id]:{...draft,attempt_id:attempt.attempt_id}},attempt_ids:{...run.attempt_ids,[attempt.question_id]:[...(run.attempt_ids[attempt.question_id]??[]),attempt.attempt_id]}});return {run:next,attempt:saved};
 });}
 async deleteAttempt(userId:string,runId:string,revision:number,attemptId:string){return this.db.transaction('rw',this.tables(),async()=>{
  const run=await this.current(userId,runId,revision),attempt=await this.db.table<Attempt>('attempts').get([userId,attemptId]);
  if(!attempt||attempt.training_run_id!==runId||!run.attempt_ids[attempt.question_id]?.includes(attemptId))throw Error('Versuch gehört nicht zu diesem Training.');
  await this.sync.remove('attempts',userId,attemptId);const drafts={...run.drafts};if(drafts[attempt.question_id]?.attempt_id===attemptId)drafts[attempt.question_id]={userId,question_id:attempt.question_id,draft:{},revealed:false};
  return this.save({...run,drafts,attempt_ids:{...run.attempt_ids,[attempt.question_id]:run.attempt_ids[attempt.question_id].filter(id=>id!==attemptId)}});
 });}
}
