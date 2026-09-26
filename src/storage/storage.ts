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
  async importReviews(reviews: QuestionReview[]) {
    const table = this.db.table<QuestionReview>('reviews');
    await this.db.transaction('rw', table, () => table.bulkPut(reviews));
  }
  close() { this.db.close(); }
}
