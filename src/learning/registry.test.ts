import {it,expect} from 'vitest';
import {MODULES,moduleKey} from './modules';
const files=import.meta.glob('../../public/data/*.json',{eager:true,import:'default'}) as Record<string,any>;
const load=(path:string)=>files['../../public/'+path];
it('registers only complete source-specific modules with globally unique identities',()=>{
 const all=new Set<string>();expect(new Set(MODULES.map(moduleKey)).size).toBe(MODULES.length);
 for(const config of MODULES){const data=load(config.segmentedPath),keys=load(config.answersPath),solutions=load(config.solutionsPath);const expected=config.parts.flatMap(p=>p.questionNumbers);
  expect(data.questions.map((q:{question_number:string})=>q.question_number)).toEqual(expected);
  for(const q of data.questions){expect(all.has(q.question_id)).toBe(false);all.add(q.question_id);expect(q.exam.replaceAll('_','-')).toBe(config.examId);expect(q.module).toBe(config.title);expect(q.cropped_question_image).toBeTruthy();}
  const mc=config.parts.filter(p=>p.kind==='multiple_choice').flatMap(p=>p.questionNumbers),us=config.parts.filter(p=>p.kind==='multi_part').flatMap(p=>p.questionNumbers);
  expect(keys.answers.map((a:{question_number:number})=>String(a.question_number))).toEqual(mc);expect(solutions.solutions.map((u:{question_number:string})=>u.question_number)).toEqual(us);
  expect(keys.parser_revision).toBeTruthy();expect(keys.completeness.unique_complete).toBeTypeOf('boolean');
  for(const a of keys.answers){expect(['auto_ready','needs_review','confirmed']).toContain(a.official_answer_status);expect(a.parser_revision).toBeTruthy();expect(typeof a.question_number).toBe('number');expect(data.questions.find((q:{question_number:string})=>q.question_number===String(a.question_number)).question_id).toBe(a.question_id);expect(a.source_crop).toBeTruthy();}
  for(const u of solutions.solutions){expect(data.questions.find((q:{question_number:string})=>q.question_number===u.question_number).question_id).toBe(u.question_id);expect(u.cropped_solution_image).toBeTruthy();}
 }
});
