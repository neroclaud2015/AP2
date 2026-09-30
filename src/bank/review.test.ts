import {it,expect} from 'vitest';
import {confirmClassification,mergeClassifications} from './review';
import type {QuestionClassification,InventoryQuestion} from './model';
it('binds confirmations to source revision and preserves unrelated locked records',()=>{const q={question_id:'q1',question_source_revision:'r2'} as InventoryQuestion;const c=confirmClassification(q,['mechanik'],'rechnen',[],'v1','2026-09-30T10:00:00Z');expect(c).toMatchObject({source:'human_confirmed',locked:true,question_source_revision:'r2'});const other={...c,question_id:'q2'};expect(mergeClassifications([other],[c])).toEqual([other,c]);});
it('keeps unclassified human decisions in review rather than falsely complete',()=>{const c=confirmClassification({question_id:'q1',question_source_revision:'r1'} as InventoryQuestion,[],null,[],'v1','2026-09-30T10:00:00Z');expect(c.review_reasons.length).toBeGreaterThan(0);});
