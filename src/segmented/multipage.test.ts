import {describe,it,expect} from 'vitest';
import {questionSources,effectiveQuestion,type SegmentedQuestion,type QuestionReview} from './types';
const question={question_id:'wiso-u6',question_number:'U6',source_pdf:'q.pdf',source_page:5,source_page_image:'p5.png',source_size:[600,800],bounding_box:[10,20,300,400],regions:[[10,20,300,400]],source_regions:[{page:5,source_page_image:'p5.png',source_size:[600,800],bbox:[10,20,300,400],role:'primary',owner:'U6',evidence:'heading'},{page:4,source_page_image:'p4.png',source_size:[600,800],bbox:[300,400,500,700],role:'continuation',owner:'U6',evidence:'continuation'}]} as SegmentedQuestion;
describe('multipage question source rendering',()=>{
 it('keeps the continuation while applying a legacy primary-only review',()=>{
  const review={question_number:'U6',bounding_box:[20,30,310,410],regions:[[20,30,310,410]],tags:[]} as unknown as QuestionReview;
  const current=effectiveQuestion(question,review);const regions=questionSources(current);
  expect(regions.map(r=>r.source_page)).toEqual([5,4]);expect(regions[0].bounding_box).toEqual(review.bounding_box);expect(regions[1].regions).toEqual([question.source_regions![1].bbox]);expect(regions[1].source_page_image).toBe('p4.png');
  expect(question.source_regions![0].bbox).toEqual([10,20,300,400]);
 });
 it('preserves the exact legacy single-page source contract',()=>{
  const {source_regions:_,...legacy}=question;const sources=questionSources(legacy);
  expect(sources).toHaveLength(1);expect(sources[0].source_page).toBe(5);expect(sources[0].regions).toEqual(legacy.regions);
 });
});
