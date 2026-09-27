import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import Dexie from 'dexie';
import { effectiveAnswer, type OfficialAnswer } from '../segmented/answers';
import { IndexedDBProgressRepository } from './storage';

test('numeric official answer correction survives reopen and stays isolated from machine fields', async()=>{
  const name='answers-'+crypto.randomUUID();
  const repo=new IndexedDBProgressRepository(name);
  expect(typeof repo.saveAnswerReview).toBe('function');
  const correction={userId:'local',question_id:'stable-q3',official_answer:5,official_answer_status:'confirmed' as const,
    user_corrected:true,locked:true as const,parser_revision:'v1',updated_at:new Date().toISOString()};
  await repo.saveAnswerReview(correction);
  repo.close();
  const next=new IndexedDBProgressRepository(name);
  await next.saveMachineValue('local','stable-q3','official_answer','2');
  expect(await next.getAnswerReviews('local')).toEqual([correction]);
  expect(await next.getAnswerReviews('other')).toEqual([]);
  await expect(next.saveAnswerReview({...correction,official_answer:6})).rejects.toThrow();
  expect(await next.getAnswerReviews('local')).toEqual([correction]);
  next.close();
});


test('schema-2 database upgrades without losing reviews and invalid answer backup writes nothing',async()=>{
  const name='answer-migration-'+crypto.randomUUID();
  const old=new Dexie(name);old.version(1).stores({records:'[userId+questionId],userId'});old.version(2).stores({reviews:'[userId+question_id],userId'});
  const review={userId:'local',question_id:'q1',source_revision:'1.5',question_number:'1',bounding_box:[1,1,2,2],regions:[[1,1,2,2]],extracted_text:'original user text',tags:[],solution_page:null,solution_confirmed:false,review_status:'confirmed' as const,updated_at:'now'};
  await old.table('reviews').put(review);old.close();
  const repo=new IndexedDBProgressRepository(name);
  expect(await repo.getReviews('local')).toEqual([review]);
  const saved={userId:'local',question_id:'q1',official_answer:4,official_answer_status:'confirmed' as const,user_corrected:true,locked:true as const,parser_revision:'1.6',updated_at:'now'};
  await repo.saveAnswerReview(saved);
  await expect(repo.importReviews([{...review,extracted_text:'bad backup'}],[{...saved,official_answer:0}])).rejects.toThrow();
  expect(await repo.getReviews('local')).toEqual([review]);expect(await repo.getAnswerReviews('local')).toEqual([saved]);
  await repo.importReviews([review]);expect(await repo.getAnswerReviews('local')).toEqual([saved]);
  const machine={question_id:'q1',official_answer:1,parser_revision:'future'} as OfficialAnswer;
  expect(effectiveAnswer(machine,saved).official_answer).toBe(4);
  expect(effectiveAnswer({...machine,question_id:'q2'},saved).official_answer).toBe(1);
  repo.close();
});
