import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import { IndexedDBProgressRepository } from './storage';

test('complete review persists atomically and stays independent of generated question revisions', async () => {
  const name = 'review-' + crypto.randomUUID();
  const repo = new IndexedDBProgressRepository(name);
  const review = { question_id: 'doc-A-4', userId: 'local', source_revision: '1.5.1', question_number: '4a',
    bounding_box: [50, 290, 300, 530], regions: [[50, 290, 300, 530]], extracted_text: 'Edited text',
    tags: ['Sicherheit'], solution_page: 3, solution_confirmed: true, review_status: 'confirmed' as const,
    updated_at: '2026-09-26T12:00:00Z' };
  expect(typeof repo.saveReview).toBe('function');
  await repo.saveReview(review);
  repo.close();
  const next = new IndexedDBProgressRepository(name);
  expect(await next.getReviews('local')).toEqual([review]);
  expect(await next.getReviews('other-user')).toEqual([]);
  await next.saveMachineValue('local', 'doc-A-4', 'question_text', 'Regenerated text');
  expect((await next.getReviews('local'))[0].extracted_text).toBe('Edited text');
  next.close();
});
