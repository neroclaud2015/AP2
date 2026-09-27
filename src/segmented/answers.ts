export interface OfficialAnswer {
  question_id: string; exam: string; module: string; question_number: number;
  official_answer_type: 'multiple_choice'; official_answer: number | null;
  official_answer_status: 'auto_ready'|'needs_review'; confidence: number;
  solution_source_page: number; source_page: number; source_pdf: string; source_pdf_available?:boolean; source_crop: string;
  answer_bbox: number[]; parser_revision: string; review_reasons: string[];
}
export interface AnswerKey {
  schema_version: 1; solution_source_page?: number; parser_revision: string; answers: OfficialAnswer[]; overlay: string;
  completeness: { unique_complete: boolean; problems: {question_number:number;reason:string}[] };
}
export interface AnswerReview {
  userId: string; question_id: string; official_answer: number;
  official_answer_status: 'confirmed'; user_corrected: boolean; locked: true;
  parser_revision: string; updated_at: string;
}
export function validAnswerReview(value: unknown): value is AnswerReview {
  if(!value||typeof value!=='object')return false;
  const r=value as AnswerReview;
  return r.userId==='local'&&typeof r.question_id==='string'&&!!r.question_id&&
    Number.isInteger(r.official_answer)&&r.official_answer>=1&&r.official_answer<=5&&
    r.official_answer_status==='confirmed'&&r.locked===true&&typeof r.user_corrected==='boolean'&&
    typeof r.parser_revision==='string'&&typeof r.updated_at==='string';
}
export function effectiveAnswer(source: OfficialAnswer, saved?: AnswerReview) {
  return saved?.locked && saved.question_id===source.question_id ? {...source,...saved} : source;
}
