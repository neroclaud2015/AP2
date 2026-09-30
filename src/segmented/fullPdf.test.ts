import {expect,test} from 'vitest';
import {questionSourceUrl,questionSources,type SegmentedExam} from './types';
import {MODULES} from '../learning/modules';
const data=import.meta.glob('../../public/data/*_segmented.json',{eager:true,import:'default'}) as Record<string,SegmentedExam>;
test('every production original-source link opens complete PDF even with legacy unavailable flags',()=>{
 let count=0;
 for(const m of MODULES){const exam=data['../../public/'+m.segmentedPath];for(const q of exam.questions){for(const source of questionSources(q))expect(questionSourceUrl(q,source),q.question_id).toMatch(/\.pdf#page=\d+$/);count++;}}
 expect(count).toBe(MODULES.reduce((total,m)=>total+m.parts.reduce((n,p)=>n+p.questionNumbers.length,0),0));
});
import {fullPdfUrl} from './fullPdf';
import type {AnswerKey} from './answers';
import type {USolution} from '../learning/model';
const answers=import.meta.glob('../../public/data/*_answers.json',{eager:true,import:'default'}) as Record<string,AnswerKey>;
const solutions=import.meta.glob('../../public/data/*_u_solutions.json',{eager:true,import:'default'}) as Record<string,{solutions:USolution[]}>;
test('all production MC and U solution regions resolve to their complete source PDF',()=>{
 for(const m of MODULES){for(const a of answers['../../public/'+m.answersPath].answers)expect(fullPdfUrl({source:a.source_pdf,page:a.solution_source_page}),a.question_id).toMatch(/\.pdf#page=\d+$/);for(const u of solutions['../../public/'+m.solutionsPath].solutions)for(const r of u.regions)expect(fullPdfUrl({source:u.solution_source_pdf,page:r.source_page}),u.question_id).toMatch(/\.pdf#page=\d+$/);}
});
test('legacy test snapshots lacking answer_source_pdf resolve by original question identity; unknown explicit hashes never rebind',()=>{
 const q=data['../../public/data/2017_18_winter_arbeitsplanung_segmented.json'].questions[0];
 expect(fullPdfUrl({questionId:q.question_id,kind:'solution',page:10})).toMatch(/\.pdf#page=10$/);
 expect(fullPdfUrl({questionId:q.question_id,sha256:'unknown-old-source'})).toBeUndefined();
 expect(fullPdfUrl({source:q.source_pdf,page:9999})).toBeUndefined();
 expect(fullPdfUrl({source:q.source_pdf,page:0})).toBeUndefined();
});
