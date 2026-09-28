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
    this.syncStore=new SyncPersistence(this.db);
    this.records = this.db.table('records');
  }
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
      await this.syncStore.put('attempts',{...a,note:values.note,error_reason:values.error_reason,unsure:values.unsure,confidence:values.confidence});});
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
    const names=[...PERSONAL_STORES];
    return this.db.transaction('r',names,async()=>({schema_version:1 as const,userId,records:await this.getRecords(userId),reviews:await this.getReviews(userId),answerReviews:await this.getAnswerReviews(userId),attempts:await this.getAttempts(userId),learningSessions:await this.getLearningSessions(userId),testSessions:await this.getTestSessions(userId),settings:await this.getSettings(userId)}));
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
    for(const entity of PERSONAL_STORES){const list=entity==='settings'?(snapshot.settings??[]):snapshot[entity];if(!Array.isArray(list))throw Error('Ungültige Sicherung.');for(const row of list){if(!row||typeof row!=='object'||typeof (row as unknown as Record<string,unknown>)[ID_FIELDS[entity]]!=='string'||row.userId!==snapshot.userId)throw Error('Ungültige Datensatzidentität.');}}
    await this.db.transaction('rw',this.syncStore.tables(),async()=>{
      for(const entity of PERSONAL_STORES)for(const row of snapshot[entity]??[]){const value={...row,userId} as unknown as Record<string,unknown>,id=String(value[ID_FIELDS[entity]]),existing=await this.db.table(entity).get([userId,id]);
        if(existing&&canonical(existing)!==canonical(value))throw Error('Gleiche ID mit anderem Inhalt. Import wurde ohne Änderungen abgebrochen.');
        validateEntity(entity,id,userId,value);if(!existing){if(sync)await this.syncStore.put(entity,value);else await this.db.table(entity).put(value);}else if(sync&&!(await this.db.table('syncMeta').get([userId,entity,id])))await this.syncStore.mark(entity,userId,id,value);
      }
    });
  }
  close() { this.db.close(); }
}
