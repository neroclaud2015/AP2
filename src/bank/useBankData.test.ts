import {expect,it} from 'vitest';
import {mergeClassificationEdits} from './useBankData';
import {confirmClassification} from './review';
import type {InventoryQuestion} from './model';
const q={question_id:'q',question_source_revision:'r1'} as InventoryQuestion;
const original=confirmClassification(q,['topic'],'type',[],'v1','2026-09-30T10:00:00Z');
it('rejects a stale editor instead of overwriting a newer human lock',()=>{
 const incoming={...original,knowledge_topic_ids:['my-edit']},newer={...original,knowledge_topic_ids:['newer-edit']};
 expect(()=>mergeClassificationEdits([newer],[original],[incoming])).toThrow(/geändert/);
 expect(()=>mergeClassificationEdits([newer],[],[incoming])).toThrow(/geändert/);
});
it('merges edits with unrelated concurrent confirmations',()=>{
 const other={...original,question_id:'other'},edited={...original,knowledge_topic_ids:['edited']};
 expect(mergeClassificationEdits([original,other],[original],[edited])).toEqual([edited,other]);
});
