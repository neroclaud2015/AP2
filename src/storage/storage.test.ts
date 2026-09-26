import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import { IndexedDBProgressRepository } from './storage';

test('manual correction survives machine updates and repository reopen', async () => {
  const name = `test-${crypto.randomUUID()}`;
  const repo = new IndexedDBProgressRepository(name);
  await repo.saveCorrection('local', 'q1', 'question_text', 'My correction');
  await repo.saveMachineValue('local', 'q1', 'question_text', 'OCR replacement');
  repo.close();
  const reopened = new IndexedDBProgressRepository(name);
  const record = await reopened.get('local', 'q1');
  expect(record?.fields.question_text).toEqual({ value: 'My correction', locked: true, origin: 'user' });
  expect(await reopened.get('another-user', 'q1')).toBeUndefined();
  reopened.close();
});
