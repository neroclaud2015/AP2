import {legacyQuestionUncertainty,validQuestionUncertainty,type QuestionUncertaintyState} from '../learning/questionUncertainty';
import {wrongResults,reconcileWrongQuestions,resultKey,type WrongQuestionState} from '../learning/wrongQuestions';
import {TrainingStore} from '../training/store';
import {TRAINING_STORES,validTrainingRun,validTrainingProgress,type TrainingDefinition,type TrainingQuestionSnapshot,type TrainingStartOptions,type TrainingRun,type TrainingProgress} from '../training/model';
import {ModuleProgressStore} from './moduleProgressStore';
import {inRun,stateFor,type ModuleDescriptor} from '../learning/moduleProgress';
import {legacyQuestionNotes,validQuestionNote,type QuestionNote} from '../learning/questionNotes';
import {validateEntity,canonical} from '../sync/validation';
import {SyncPersistence} from '../sync/persistence';
import {PERSONAL_STORES,ID_FIELDS,type OutboxItem} from '../sync/localTypes';
import type {EntityType,SyncEnvelope} from '../sync/protocol';
import {LOCAL_USER_ID} from '../services/identity';
import {reduceSession,isEligibleForAnalysis,type TestSession,type SessionAction} from '../exams/model';
import {validAttempt, type Attempt, type LearningSession} from '../learning/model';
import { validAnswerReview, type AnswerReview } from '../segmented/answers';
import type { QuestionReview } from '../segmented/types';
import Dexie, { type Table } from 'dexie';
import type { AuthProvider, LocalField, ProgressRecord, ProgressRepository, UserContext } from '../types';
export class LocalUserProvider implements AuthProvider {
  async currentUser(): Promise<UserContext> { return { id: LOCAL_USER_ID, mode: 'local' }; }
  async restoreSession(){return this.currentUser();}
  async login(_credentials:Readonly<Record<string,unknown>>):Promise<UserContext>{throw Error('Login is unsupported in local mode.');}
  async logout():Promise<void>{ /* Local identity remains available; no remote session exists. */ }
}
export class IndexedDBProgressRepository implements ProgressRepository {
  private db: Dexie;
  private syncStore:SyncPersistence;
  private moduleStore:ModuleProgressStore;
  private trainingStore:TrainingStore;
  private records: Table<ProgressRecord, [string, string]>;
  constructor(name = 'ap2-private-learning') {
    this.db = new Dexie(name);
    this.db.version(1).stores({ records: '[userId+questionId],userId' });
    this.db.version(2).stores({ reviews: '[userId+question_id],userId' });
    this.db.version(3).stores({ answerReviews: '[userId+question_id],userId' });
    this.db.version(4).stores({ attempts: '[userId+attempt_id],userId,[userId+question_id]', learningSessions: '[userId+question_id],userId' });
    this.db.version(5).stores({testSessions:'[userId+test_id],userId,[userId+module],[userId+status]'});
    this.db.version(6).stores({testSessions:'[userId+test_id],userId,[userId+module],[userId+status]'}).upgrade(tx=>tx.table('testSessions').toCollection().modify(record=>{if(record.status==='submitted')record.status='completed';}));
    this.db.version(7).stores({settings:'[userId+id],userId',syncMeta:'[userId+entity+id],userId',outbox:'[userId+entity+id],userId',tombstones:'[userId+entity+id],userId',syncConflicts:'[userId+entity+id],userId',deviceState:'key'});
    this.db.version(8).stores({questionNotes:'[userId+question_id],userId'});
    this.db.version(9).stores({moduleProgress:'[userId+id],userId',moduleRuns:'[userId+run_id],userId,[userId+progress_id]'});
    this.db.version(10).stores({wrongQuestions:'[userId+question_id],userId'});
    this.db.version(11).stores({trainingRuns:'[userId+run_id],userId',trainingProgress:'[userId+definition_key],userId'});
    this.db.version(12).stores({questionUncertainty:'[userId+question_id],userId'});
    this.syncStore=new SyncPersistence(this.db);
    this.moduleStore=new ModuleProgressStore(this.db,this.syncStore);
    this.trainingStore=new TrainingStore(this.db,this.syncStore);
    this.records = this.db.table('records');
  }
  private async migrateQuestionUncertainty(userId:string){
    await this.db.transaction('rw',['questionUncertainty','attempts','testSessions'],async()=>{
      const table=this.db.table<QuestionUncertaintyState>('questionUncertainty');
      const states=legacyQuestionUncertainty(userId,await table.where('userId').equals(userId).toArray(),await this.getAttempts(userId),await this.getTestSessions(userId),new Date().toISOString());
      if(states.length)await table.bulkPut(states);
    });
  }
  async getDashboardSnapshot(userId:string):Promise<import('../dashboard/analytics').DashboardSnapshot>{
    const stores=['attempts','testSessions','learningSessions','trainingRuns','wrongQuestions','questionUncertainty'];
    return this.db.transaction('r',stores,async()=>Object.fromEntries(await Promise.all(stores.map(async name=>[name,await this.db.table(name).where('userId').equals(userId).toArray()]))) as unknown as import('../dashboard/analytics').DashboardSnapshot);
  }
  async getQuestionUncertainties(userId:string):Promise<QuestionUncertaintyState[]>{await this.migrateQuestionUncertainty(userId);return this.db.table<QuestionUncertaintyState>('questionUncertainty').where('userId').equals(userId).toArray();}
  async getQuestionUncertainty(userId:string,questionId:string):Promise<QuestionUncertaintyState|undefined>{await this.migrateQuestionUncertainty(userId);return this.db.table<QuestionUncertaintyState>('questionUncertainty').get([userId,questionId]);}
  async saveQuestionUncertainty(userId:string,questionId:string,active:boolean,expectedRevision:number):Promise<QuestionUncertaintyState>{
    await this.migrateQuestionUncertainty(userId);
    return this.db.transaction('rw','questionUncertainty',async()=>{
      const table=this.db.table<QuestionUncertaintyState>('questionUncertainty'),old=await table.get([userId,questionId]);
      if((old?.revision??0)!==expectedRevision)throw Error('Die Markierung wurde inzwischen geändert. Bitte neu laden.');
      const now=new Date().toISOString(),state:QuestionUncertaintyState={...old,userId,question_id:questionId,active,entered_at:active?(old?.active?old.entered_at:now):null,updated_at:now,revision:(old?.revision??0)+1};
      if(!validQuestionUncertainty(state))throw Error('Ungültige Unsicher-Markierung.');
      await table.put(state);return state;
    });
  }
  async getWrongQuestions(userId:string):Promise<WrongQuestionState[]>{
    return this.db.transaction('rw',this.syncStore.tables(),async()=>{
      const previous=await this.db.table<WrongQuestionState>('wrongQuestions').where('userId').equals(userId).toArray();
      const results=wrongResults(userId,await this.getAttempts(userId),await this.getTestSessions(userId));
      const states=reconcileWrongQuestions(userId,results,previous,new Date().toISOString());
      for(const state of states)if(previous.find(s=>s.question_id===state.question_id)?.revision!==state.revision)await this.syncStore.put('wrongQuestions',state as unknown as Record<string,unknown>);
      return states;
    });
  }
  async hideWrongQuestion(userId:string,questionId:string):Promise<void>{
    await this.db.transaction('rw',this.syncStore.tables(),async()=>{
      const state=(await this.getWrongQuestions(userId)).find(s=>s.question_id===questionId);if(!state)return;
      const stamp=new Date().toISOString(),ids=wrongResults(userId,await this.getAttempts(userId),await this.getTestSessions(userId)).filter(r=>r.question_id===questionId).map(resultKey);
      await this.syncStore.put('wrongQuestions',{...state,active:false,stage:null,entered_at:null,dismissed_at:stamp,dismissed_result_ids:[...new Set([...state.dismissed_result_ids,...ids])],updated_at:stamp,revision:state.revision+1});
    });
  }
  getModuleProgress(userId:string){return this.moduleStore.list(userId);}
  startTraining(userId:string,definition:TrainingDefinition,snapshots:TrainingQuestionSnapshot[],options?:TrainingStartOptions){return this.trainingStore.start(userId,definition,snapshots,options);}
  getTrainingRun(userId:string,runId:string){return this.trainingStore.get(userId,runId);}
  getTrainingRuns(userId:string){return this.trainingStore.runs(userId);}
  getTrainingProgress(userId:string){return this.trainingStore.progress(userId);}
  saveTrainingDraft(userId:string,runId:string,revision:number,session:LearningSession){return this.trainingStore.saveDraft(userId,runId,revision,session);}
  moveTraining(userId:string,runId:string,revision:number,questionId:string){return this.trainingStore.move(userId,runId,revision,questionId);}
  saveTrainingAttempt(userId:string,runId:string,revision:number,attempt:Attempt,session:LearningSession){return this.trainingStore.saveAttempt(userId,runId,revision,attempt,session);}
  async deleteTrainingAttempt(userId:string,runId:string,revision:number,attemptId:string){await this.migrateQuestionUncertainty(userId);return this.trainingStore.deleteAttempt(userId,runId,revision,attemptId);}
  getModuleRuns(userId:string){return this.moduleStore.runs(userId);}
  ensureModuleProgress(userId:string,d:ModuleDescriptor){return this.moduleStore.ensure(userId,d);}
  savePracticeSession(session:LearningSession,id:string,runId:string){return this.moduleStore.saveSession(session,id,runId);}
  savePracticeAttempt(attempt:Attempt,session:LearningSession,id:string,runId:string){return this.moduleStore.saveAttempt(attempt,session,id,runId);}
  async resetModuleProgress(userId:string,id:string,revision:number,runId:string){await this.migrateQuestionUncertainty(userId);await this.migrateQuestionNotes(userId);return this.moduleStore.reset(userId,id,revision,runId);}
  async deletePracticeAttempt(userId:string,id:string,attemptId:string,runId:string){await this.migrateQuestionUncertainty(userId);await this.migrateQuestionNotes(userId);return this.moduleStore.deleteAttempt(userId,id,attemptId,runId);}
  async get(userId: string, questionId: string) { return this.records.get([userId, questionId]); }
  private async write(userId: string, questionId: string, field: string, value: LocalField) {
    await this.db.transaction('rw', this.syncStore.tables(), async () => {
      const record = await this.get(userId, questionId) ?? {
        schema_version: 1, userId, questionId, fields: {}, updatedAt: new Date().toISOString()
      };
      if (record.fields[field]?.locked && value.origin === 'machine') return;
      record.fields[field] = value;
      record.updatedAt = new Date().toISOString();
      await this.syncStore.put('records',record as unknown as Record<string,unknown>);
    });
  }
  async saveCorrection(userId: string, questionId: string, field: string, value: string) {
    await this.write(userId, questionId, field, { value, locked: true, origin: 'user' });
  }
  async saveMachineValue(userId: string, questionId: string, field: string, value: string) {
    await this.write(userId, questionId, field, { value, locked: false, origin: 'machine' });
  }
  async getReviews(userId: string): Promise<QuestionReview[]> {
    return this.db.table<QuestionReview>('reviews').where('userId').equals(userId).toArray();
  }
  async saveReview(review: QuestionReview) {
    await this.syncStore.put('reviews',review as unknown as Record<string,unknown>);
  }
  async importReviews(reviews: QuestionReview[], answers: AnswerReview[] = [], userId?:string) {
    const owner=userId??reviews[0]?.userId??answers[0]?.userId;
    if([...reviews,...answers].some(r=>!r.userId.trim()||r.userId!==owner))throw Error('Review ownership mismatch');
    if(!answers.every(validAnswerReview)) throw new Error('Invalid answer review');
    const table = this.db.table<QuestionReview>('reviews');
    const answerTable=this.db.table<AnswerReview>('answerReviews');
    await this.db.transaction('rw', this.syncStore.tables(), async () => {
      for(const r of reviews)await this.syncStore.put('reviews',r as unknown as Record<string,unknown>);for(const a of answers)await this.syncStore.put('answerReviews',a as unknown as Record<string,unknown>);
    });
  }
  async getAnswerReviews(userId: string): Promise<AnswerReview[]> {
    return this.db.table<AnswerReview>('answerReviews').where('userId').equals(userId).toArray();
  }
  async saveAnswerReview(review: AnswerReview) {
    if(!validAnswerReview(review)) throw new Error('Invalid answer review');
    await this.syncStore.put('answerReviews',review as unknown as Record<string,unknown>);
  }
  private async migrateQuestionNotes(userId:string,enqueue=true,force=false){
    await this.db.transaction('rw',this.syncStore.tables(),async()=>{
      const key='question-notes-migration-v1:'+userId;
      if(!force&&await this.db.table('deviceState').get(key))return;
      const existing=await this.db.table<QuestionNote>('questionNotes').where('userId').equals(userId).toArray();
      const deleted=(await this.db.table('tombstones').where('userId').equals(userId).toArray()).filter(r=>r.entity==='questionNotes').map(r=>r.id);
      const migrated=legacyQuestionNotes(userId,existing,await this.getAttempts(userId),await this.getLearningSessions(userId),new Date().toISOString(),deleted);
      for(const note of migrated){if(enqueue)await this.syncStore.put('questionNotes',note as unknown as Record<string,unknown>);else await this.db.table('questionNotes').put(note);}
      await this.db.table('deviceState').put({key,value:true});
    });
  }
  async getQuestionNotes(userId:string):Promise<QuestionNote[]>{await this.migrateQuestionNotes(userId);return this.db.table<QuestionNote>('questionNotes').where('userId').equals(userId).toArray();}
  async getQuestionNote(userId:string,questionId:string):Promise<QuestionNote|undefined>{await this.migrateQuestionNotes(userId);return this.db.table<QuestionNote>('questionNotes').get([userId,questionId]);}
  async saveQuestionNote(userId:string,questionId:string,text:string,expectedRevision:number,expectedText:string):Promise<QuestionNote>{
    await this.migrateQuestionNotes(userId);
    return this.db.transaction('rw',this.syncStore.tables(),async()=>{
      const old=await this.db.table<QuestionNote>('questionNotes').get([userId,questionId]);
      if((old?.revision??0)!==expectedRevision||(old?.text??'')!==expectedText)throw Error('Die Notiz wurde inzwischen geändert. Bitte neu laden und beide Texte vergleichen.');
      const stamp=new Date().toISOString();const note={userId,question_id:questionId,text,created_at:old?.created_at??stamp,updated_at:stamp,revision:(old?.revision??0)+1};
      if(!validQuestionNote(note))throw Error('Ungültige Notiz.');
      await this.syncStore.put('questionNotes',note as unknown as Record<string,unknown>);return note;
    });
  }
  async getAttempts(userId:string):Promise<Attempt[]> {return this.db.table<Attempt>('attempts').where('userId').equals(userId).toArray();}
  async getLearningSessions(userId:string):Promise<LearningSession[]> {return this.db.table<LearningSession>('learningSessions').where('userId').equals(userId).toArray();}
  async saveLearningSession(session:LearningSession) {await this.syncStore.put('learningSessions',session as unknown as Record<string,unknown>);}
  async saveAttempt(attempt:Attempt, session?:LearningSession) {
    if(session&&(session.userId!==attempt.userId||session.question_id!==attempt.question_id))throw Error('Attempt session ownership mismatch');
    if(!validAttempt(attempt))throw new Error('Invalid attempt');
    const attempts=this.db.table<Attempt>('attempts'),sessions=this.db.table<LearningSession>('learningSessions');
    await this.db.transaction('rw',this.syncStore.tables(),async()=>{await this.syncStore.put('attempts',attempt as unknown as Record<string,unknown>,true);if(session)await this.syncStore.put('learningSessions',session as unknown as Record<string,unknown>);});
  }
  async annotateAttempt(userId:string,id:string,values:Pick<Attempt,'note'|'error_reason'|'unsure'|'confidence'>) {
    const table=this.db.table<Attempt>('attempts');
    await this.db.transaction('rw',this.syncStore.tables(),async()=>{const a=await table.get([userId,id]);if(!a)throw Error('Missing attempt');
      await this.syncStore.put('attempts',{...a,note:values.note,error_reason:values.error_reason});});
  }
  async getTestSessions(userId:string):Promise<TestSession[]> {return this.db.table<TestSession>('testSessions').where('userId').equals(userId).toArray();}
  async getAnalysisTestSessions(userId:string):Promise<TestSession[]> {return (await this.getTestSessions(userId)).filter(isEligibleForAnalysis);}
  async getTestSession(userId:string,id:string):Promise<TestSession|undefined> {return this.db.table<TestSession>('testSessions').get([userId,id]);}
  async createTestSession(session:TestSession,replace?:{id:string;revision:number}):Promise<TestSession> {
    if(!session.userId?.trim()||session.status!=='active'||session.revision!==0||!session.question_ids.length||Object.keys(session.answers).length)throw Error('Ungültiger neuer Versuch.');
    const table=this.db.table<TestSession>('testSessions');
    return this.db.transaction('rw',this.syncStore.tables(),async()=>{
      const existing=(await table.where('userId').equals(session.userId).toArray()).filter(s=>(session.test_type==='module'||s.exam===session.exam)&&s.module===session.module&&s.test_type===session.test_type&&['active','paused'].includes(s.status));
      if(existing.length){
        if(existing.length!==1||existing[0].test_id!==replace?.id||existing[0].revision!==replace?.revision)throw Error('Ein offener Versuch besteht bereits. Bitte fortsetzen oder ausdrücklich abbrechen.');
        await this.syncStore.put('testSessions',reduceSession(existing[0],{type:'discard'}) as unknown as Record<string,unknown>);
      }else if(replace)throw Error('Der vorherige Versuch wurde bereits verändert. Bitte neu laden.');
      await this.syncStore.put('testSessions',session as unknown as Record<string,unknown>,true);return session;
    });
  }
  async updateTestSession(userId:string,id:string,revision:number,action:SessionAction):Promise<TestSession> {
    if(action.type==='discard')await this.migrateQuestionUncertainty(userId);
    const table=this.db.table<TestSession>('testSessions');
    return this.db.transaction('rw',this.syncStore.tables(),async()=>{
      const current=await table.get([userId,id]);if(!current)throw Error('Versuch nicht gefunden.');
      if(current.revision!==revision)throw Error('Dieser Versuch wurde in einem anderen Fenster verändert. Der aktuelle Stand wird geladen.');
      const updated=reduceSession(current,action);
      if((action.type==='restore'||action.type==='resume')&&['active','paused'].includes(updated.status)){
        const competing=(await table.where('userId').equals(userId).toArray()).some(s=>s.test_id!==id&&s.module===updated.module&&s.test_type===updated.test_type&&(updated.test_type==='module'||s.exam===updated.exam)&&['active','paused'].includes(s.status));
        if(competing)throw Error('Ein offener Versuch besteht bereits. Bitte zuerst abschließen oder verwerfen.');
      }
      await this.syncStore.put('testSessions',updated as unknown as Record<string,unknown>);return updated;
    });
  }
  async discardTestSession(userId:string,id:string,revision:number):Promise<TestSession> {
    return this.updateTestSession(userId,id,revision,{type:'discard'});
  }
  async deleteTestSession(userId:string,id:string,revision:number):Promise<void> {
    await this.migrateQuestionUncertainty(userId);
    const table=this.db.table<TestSession>('testSessions');
    await this.db.transaction('rw',this.syncStore.tables(),async()=>{
      const current=await table.get([userId,id]);if(!current)throw Error('Versuch nicht gefunden.');
      if(current.revision!==revision)throw Error('Dieser Versuch wurde in einem anderen Fenster verändert. Bitte erneut prüfen.');
      // Test answers, assessments, snapshots and results are embedded in this record.
      // Ordinary attempts/reviews are independent and must never be deleted by test ID.
      await this.syncStore.remove('testSessions',userId,id);
    });
  }
  async getRecords(userId:string):Promise<ProgressRecord[]>{return this.records.where('userId').equals(userId).toArray();}
  async exportSnapshot(userId:string){
    await this.migrateQuestionUncertainty(userId);
    await this.migrateQuestionNotes(userId);
    await this.getWrongQuestions(userId);
    const names=[...PERSONAL_STORES,...TRAINING_STORES,'questionUncertainty'];
    return this.db.transaction('r',names,async()=>({schema_version:1 as const,userId,questionUncertainty:await this.db.table<QuestionUncertaintyState>('questionUncertainty').where('userId').equals(userId).toArray(),trainingRuns:await this.getTrainingRuns(userId),trainingProgress:await this.db.table<TrainingProgress>('trainingProgress').where('userId').equals(userId).toArray(),records:await this.getRecords(userId),reviews:await this.getReviews(userId),answerReviews:await this.getAnswerReviews(userId),attempts:await this.getAttempts(userId),learningSessions:await this.getLearningSessions(userId),testSessions:await this.getTestSessions(userId),wrongQuestions:await this.db.table<WrongQuestionState>('wrongQuestions').where('userId').equals(userId).toArray(),settings:await this.getSettings(userId),moduleProgress:await this.getModuleProgress(userId),moduleRuns:await this.getModuleRuns(userId),questionNotes:await this.db.table<QuestionNote>('questionNotes').where('userId').equals(userId).toArray()}));
  }
  getOutbox(userId:string){return this.syncStore.outbox(userId);}
  getSyncConflicts(userId:string){return this.syncStore.conflicts(userId);}
  acknowledge(userId:string,item:OutboxItem,remote:SyncEnvelope){return this.syncStore.ack(userId,item,remote);}
  receiveRemote(userId:string,remote:SyncEnvelope){return this.syncStore.receive(userId,remote);}
  recordSyncConflict(userId:string,item:OutboxItem,remote:SyncEnvelope){return this.syncStore.conflict(userId,item,remote);}
  resolveSyncConflict(userId:string,entity:EntityType,id:string,choice:'local'|'remote',expected?:{mutationId:string;revision:number}){return this.syncStore.resolve(userId,entity,id,choice,expected);}
  async getDeviceState<T>(key:string):Promise<T|undefined>{return (await this.db.table('deviceState').get(key))?.value;}
  async setDeviceState(key:string,value:unknown){if(value===undefined)await this.db.table('deviceState').delete(key);else await this.db.table('deviceState').put({key,value});}
  async getSettings(userId:string):Promise<Array<{userId:string;id:string;value:unknown}>>{return this.db.table('settings').where('userId').equals(userId).toArray();}
  async saveSetting(userId:string,id:string,value:unknown){await this.syncStore.put('settings',{userId,id,value});}
  async importSnapshot(snapshot:import('../types').PersonalDataSnapshot,userId:string,sync:boolean){
    if(snapshot.schema_version!==1||!snapshot.userId||!userId)throw Error('Ungültige Sicherung.');
    for(const entity of PERSONAL_STORES){const list=['settings','questionNotes','moduleProgress','moduleRuns','wrongQuestions'].includes(entity)?(snapshot[entity]??[]):snapshot[entity];if(!Array.isArray(list))throw Error('Ungültige Sicherung.');for(const row of list){if(!row||typeof row!=='object'||typeof (row as unknown as Record<string,unknown>)[ID_FIELDS[entity]]!=='string'||row.userId!==snapshot.userId)throw Error('Ungültige Datensatzidentität.');}}
    await this.db.transaction('rw',[...this.syncStore.tables(),...TRAINING_STORES,'questionUncertainty'],async()=>{
      for(const entity of PERSONAL_STORES)for(const row of snapshot[entity]??[]){const value={...row,userId} as unknown as Record<string,unknown>,id=String(value[ID_FIELDS[entity]]),existing=await this.db.table(entity).get([userId,id]);
        if(existing&&canonical(existing)!==canonical(value))throw Error('Gleiche ID mit anderem Inhalt. Import wurde ohne Änderungen abgebrochen.');
        validateEntity(entity,id,userId,value);if(!existing){if(sync)await this.syncStore.put(entity,value);else await this.db.table(entity).put(value);}else if(sync&&!(await this.db.table('syncMeta').get([userId,entity,id])))await this.syncStore.mark(entity,userId,id,value);
      }
      const uncertainty=snapshot.questionUncertainty??[];
      if(!Array.isArray(uncertainty))throw Error('Ungültige Unsicher-Sicherung.');
      for(const row of uncertainty){
        if(!validQuestionUncertainty(row)||row.userId!==snapshot.userId)throw Error('Ungültige Unsicher-Sicherung.');
        const value={...row,userId},existing=await this.db.table('questionUncertainty').get([userId,row.question_id]);
        if(existing&&canonical(existing)!==canonical(value))throw Error('Markierung mit gleicher ID hat anderen Inhalt.');
        if(!existing)await this.db.table('questionUncertainty').put(value);
      }
      for(const entity of TRAINING_STORES){
        const rows=snapshot[entity]??[];if(!Array.isArray(rows))throw Error('Ungültige Trainingssicherung.');
        for(const row of rows){
          if(row.userId!==snapshot.userId||(entity==='trainingRuns'?!validTrainingRun(row):!validTrainingProgress(row)))throw Error('Ungültige Trainingssicherung.');
          const value={...row,userId};
          if(entity==='trainingRuns')(value as TrainingRun).drafts=Object.fromEntries(Object.entries((row as TrainingRun).drafts).map(([id,draft])=>[id,{...draft,userId}]));
          const id=entity==='trainingRuns'?(row as TrainingRun).run_id:(row as TrainingProgress).definition_key,existing=await this.db.table(entity).get([userId,id]);
          if(existing&&canonical(existing)!==canonical(value))throw Error('Training mit gleicher ID hat anderen Inhalt.');
          if(!existing)await this.db.table(entity).put(value);
        }
      }
      const trainingRuns=await this.getTrainingRuns(userId),trainingProgress=await this.db.table<TrainingProgress>('trainingProgress').where('userId').equals(userId).toArray();
      for(const p of trainingProgress)if(!trainingRuns.some(r=>r.run_id===p.run_id&&r.definition_key===p.definition_key&&r.kind==='bank'))throw Error('Trainingsfortschritt ohne passende Runde.');
      const runs=await this.getModuleRuns(userId),attempts=await this.getAttempts(userId);
      for(const r of trainingRuns)for(const [qid,ids] of Object.entries(r.attempt_ids))for(const id of ids)if(!attempts.some(a=>a.attempt_id===id&&a.question_id===qid&&a.training_run_id===r.run_id))throw Error('Trainingsrunde enthält einen ungültigen Versuch.');
      for(const p of await this.getModuleProgress(userId)){
        const run=runs.find(r=>r.run_id===p.run_id);
        if(!run||run.progress_id!==p.id||run.generation!==p.generation||canonical(run.question_ids)!==canonical(p.question_ids))throw Error('Sicherung enthält eine unvollständige Lernrunde.');
        for(const [qid,state] of Object.entries(p.questionStates))if(state.attempt_id){const a=attempts.find(a=>a.attempt_id===state.attempt_id);if(!a||a.question_id!==qid||!inRun(a,run)||stateFor(a).state!==state.state)throw Error('Sicherung enthält eine ungültige Fortschrittsquelle.');}
      }
      await this.migrateQuestionNotes(userId,sync,true);
      await this.migrateQuestionUncertainty(userId);
    });
  }
  close() { this.db.close(); }
}
