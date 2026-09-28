import {describe,it,expect} from 'vitest';
import {reviewExport,makeConfirmation,type ReviewItem} from './model';
import {resolveReviewScope} from './scopes';
describe('exam-scoped review queues',()=>{
 it('keeps legacy links and selects only registered scopes',()=>{
  expect(resolveReviewScope(null).scope).toBe('winter-2018-19-ap-fa');
  expect(resolveReviewScope('winter-2019-20').path).toBe('data/manual_answer_review_winter2019_20.json');
  expect(()=>resolveReviewScope('../../untrusted')).toThrow();
 });
 it('exports the selected season without leaking another seasons confirmations',()=>{
  const item={question_id:'2019-20-fa-p12-21',question_number:21,exam:'2019_20_winter',module:'Funktionsanalyse',official_answer:null,parser_revision:'v1',source_pdf_sha256:'a',source_crop:'q.png',source_crop_sha256:'b',evidence_hash:'c'} as ReviewItem;
  const r=makeConfirmation(item,'local',3);
  const exported=reviewExport([item],[r,{...r,question_id:'2018-19-fa-p12-27'}],'winter-2019-20');
  expect(exported.scope).toBe('winter-2019-20');expect(exported.confirmations).toHaveLength(1);
  expect(reviewExport([item],[r]).scope).toBe('winter-2018-19-ap-fa');
 });
});
