import {reduceSession,isEligibleForAnalysis,type TestSession,type SessionAction} from '../exams/model';
import {validAttempt, type Attempt, type LearningSession} from '../learning/model';
import { validAnswerReview, type AnswerReview } from '../segmented/answers';
import type { QuestionReview } from '../segmented/types';
import Dexie, { type Table } from 'dexie';
import type { AuthProvider, LocalField, ProgressRecord, ProgressRepository, UserContext } from '../types';
export class LocalUserProvider implements AuthProvider {
  async currentUser(): Promise<UserContext> { return { id: 'local', mode: 'local' }; }
}
export class IndexedDBProgressRepository implements ProgressRepository {
  private db: Dexie;
  private records: Table<ProgressRecord, [string, string]>;
  constructor(name = 'ap2-private-learning') {
    this.db = new Dexie(name);
    this.db.version(1).stores({ records: '[userId+questionId],userId' });
    this.db.version(2).stores({ reviews: '[userId+question_id],userId' });
    this.db.version(3).stores({ answerReviews: '[userId+question_id],userId' });
    this.db.version(4).stores({ attempts: '[userId+attempt_id],userId,[userId+question_id]', learningSessions: '[userId+question_id],userId' });
    this.db.version(5).stores({testSessions:'[userId+test_id],userId,[userId+module],[userId+status]'});
    this.db.version(6).stores({testSessions:'[userId+test_id],userId,[userId+module],[userId+status]'}).upgrade(tx=>tx.table('testSessions').toCollection().modify(record=>{if(record.status==='submitted')record.status='completed';}));
    this.records = this.db.table('records');
  }
  async get(userId: string, questionId: string) { return this.records.get([userId, questionId]); }
  private async write(userId: string, questionId: string, field: string, value: LocalField) {
    await this.db.transaction('rw', this.records, async () => {
      const record = await this.get(userId, questionId) ?? {
        schema_version: 1, userId, questionId, fields: {}, updatedAt: new Date().toISOString()
      };
      if (record.fields[field]?.locked && value.origin === 'machine') return;
      record.fields[field] = value;
      record.updatedAt = new Date().toISOString();
      await this.records.put(record);
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
    await this.db.table<QuestionReview>('reviews').put(review);
  }
  async importReviews(reviews: QuestionReview[], answers: AnswerReview[] = []) {
    if(!answers.every(validAnswerReview)) throw new Error('Invalid answer review');
    const table = this.db.table<QuestionReview>('reviews');
    const answerTable=this.db.table<AnswerReview>('answerReviews');
    await this.db.transaction('rw', table, answerTable, async () => {
      await table.bulkPut(reviews); await answerTable.bulkPut(answers);
    });
  }
  async getAnswerReviews(userId: string): Promise<AnswerReview[]> {
    return this.db.table<AnswerReview>('answerReviews').where('userId').equals(userId).toArray();
  }
  async saveAnswerReview(review: AnswerReview) {
    if(!validAnswerReview(review)) throw new Error('Invalid answer review');
    await this.db.table<AnswerReview>('answerReviews').put(review);
  }
  async getAttempts(userId:string):Promise<Attempt[]> {return this.db.table<Attempt>('attempts').where('userId').equals(userId).toArray();}
  async getLearningSessions(userId:string):Promise<LearningSession[]> {return this.db.table<LearningSession>('learningSessions').where('userId').equals(userId).toArray();}
  async saveLearningSession(session:LearningSession) {await this.db.table<LearningSession>('learningSessions').put(session);}
  async saveAttempt(attempt:Attempt, session?:LearningSession) {
    if(!validAttempt(attempt))throw new Error('Invalid attempt');
    const attempts=this.db.table<Attempt>('attempts'),sessions=this.db.table<LearningSession>('learningSessions');
    await this.db.transaction('rw',attempts,sessions,async()=>{await attempts.add(attempt);if(session)await sessions.put(session);});
  }
  async annotateAttempt(userId:string,id:string,values:Pick<Attempt,'note'|'error_reason'|'unsure'|'confidence'>) {
    const table=this.db.table<Attempt>('attempts');
    await this.db.transaction('rw',table,async()=>{const a=await table.get([userId,id]);if(!a)throw Error('Missing attempt');
      await table.put({...a,note:values.note,error_reason:values.error_reason,unsure:values.unsure,confidence:values.confidence});});
  }
  async getTestSessions(userId:string):Promise<TestSession[]> {return this.db.table<TestSession>('testSessions').where('userId').equals(userId).toArray();}
  async getAnalysisTestSessions(userId:string):Promise<TestSession[]> {return (await this.getTestSessions(userId)).filter(isEligibleForAnalysis);}
  async getTestSession(userId:string,id:string):Promise<TestSession|undefined> {return this.db.table<TestSession>('testSessions').get([userId,id]);}
  async createTestSession(session:TestSession,replace?:{id:string;revision:number}):Promise<TestSession> {
    if(session.userId!=='local'||session.status!=='active'||session.revision!==0||!session.question_ids.length||Object.keys(session.answers).length)throw Error('Ungültiger neuer Versuch.');
    const table=this.db.table<TestSession>('testSessions');
    return this.db.transaction('rw',table,async()=>{
      const existing=(await table.where('userId').equals(session.userId).toArray()).filter(s=>(session.test_type==='module'||s.exam===session.exam)&&s.module===session.module&&s.test_type===session.test_type&&['active','paused'].includes(s.status));
      if(existing.length){
        if(existing.length!==1||existing[0].test_id!==replace?.id||existing[0].revision!==replace?.revision)throw Error('Ein offener Versuch besteht bereits. Bitte fortsetzen oder ausdrücklich abbrechen.');
        await table.put(reduceSession(existing[0],{type:'discard'}));
      }else if(replace)throw Error('Der vorherige Versuch wurde bereits verändert. Bitte neu laden.');
      await table.add(session);return session;
    });
  }
  async updateTestSession(userId:string,id:string,revision:number,action:SessionAction):Promise<TestSession> {
    const table=this.db.table<TestSession>('testSessions');
    return this.db.transaction('rw',table,async()=>{
      const current=await table.get([userId,id]);if(!current)throw Error('Versuch nicht gefunden.');
      if(current.revision!==revision)throw Error('Dieser Versuch wurde in einem anderen Fenster verändert. Der aktuelle Stand wird geladen.');
      const updated=reduceSession(current,action);await table.put(updated);return updated;
    });
  }
  async discardTestSession(userId:string,id:string,revision:number):Promise<TestSession> {
    return this.updateTestSession(userId,id,revision,{type:'discard'});
  }
  async deleteTestSession(userId:string,id:string,revision:number):Promise<void> {
    const table=this.db.table<TestSession>('testSessions');
    await this.db.transaction('rw',table,async()=>{
      const current=await table.get([userId,id]);if(!current)throw Error('Versuch nicht gefunden.');
      if(current.revision!==revision)throw Error('Dieser Versuch wurde in einem anderen Fenster verändert. Bitte erneut prüfen.');
      // Test answers, assessments, snapshots and results are embedded in this record.
      // Ordinary attempts/reviews are independent and must never be deleted by test ID.
      await table.delete([userId,id]);
    });
  }
  close() { this.db.close(); }
}
