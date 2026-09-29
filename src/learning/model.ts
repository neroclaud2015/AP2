export type Correctness='richtig'|'teilweise'|'falsch';
export interface NumericSpec {value:number;unit:string;tolerance:number;tolerance_policy?:string}
export interface USubpart {id:string;label:string;type:'numeric'|'short_text'|'drawing'|'diagram';numeric?:NumericSpec}
export interface USolution {question_id:string;question_number:string;solution_source_pdf:string;solution_source_pdf_available?:boolean;solution_source_page:number;regions:{source_page:number;bbox:number[]}[];cropped_solution_image:string;review_status:string;answer_type:'multi_part';subparts:USubpart[];extractor_revision:string}
export interface SubpartResult {id:string;user_answer:string;unit?:string;correctness:Correctness;numeric_suggestion?:Correctness|'invalid';self_assessed:true;auto_scored:false}
export interface AttemptProvenance {question_source_sha256?:string;solution_source_sha256?:string;question_source_revision?:string;official_answer_revision?:string;question_source_id?:string;solution_source_id?:string;answer_review_revision?:string}
export interface Attempt extends AttemptProvenance {progress_run_id?:string;progress_generation?:number;progress_order?:number;test_id?:string;exam?:string;module?:string;attempt_id:string;userId:string;question_id:string;timestamp:string;user_answer:Record<string,string|number>;correctness:Correctness|null;partial_status:boolean;unsure:boolean;confidence:'sure'|'unsure';hints_used:string[];error_reason:string;note:string;self_assessed:boolean;auto_scored:boolean;subparts:SubpartResult[];official_answer_snapshot?:number|null;source_revision?:string}
export interface LearningSession {progress_run_id?:string;progress_generation?:number;exam?:string;module?:string;userId:string;question_id:string;draft:Record<string,string>;revealed:boolean;attempt_id?:string;updated_at?:string}
// Advisory integration seam. An evaluator has no repository access and cannot finalize an attempt.
export interface EvaluationSuggestion {subpart_id:string;suggested:Correctness;rationale:string;requires_user_confirmation:true}
export interface AdvisoryEvaluator {suggest(answer:string,solution:USolution):Promise<EvaluationSuggestion[]>}
export function checkNumeric(text:string,unit:string,spec:NumericSpec):Correctness|'invalid' {
 const clean=text.trim().replace(',','.');
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean)||unit!==spec.unit||!Number.isFinite(Number(clean)))return 'invalid';
 return Math.abs(Number(clean)-spec.value)<=spec.tolerance+1e-9?'richtig':'falsch';
}
export function combineAssessments(results:(Correctness|null)[]):Correctness|null {
 if(!results.length||results.some(r=>r===null))return null;
 return results.every(r=>r==='richtig')?'richtig':results.every(r=>r==='falsch')?'falsch':'teilweise';
}
export function validAttempt(a:Attempt) {
 return typeof a.userId==='string'&&!!a.userId.trim()&&!!a.attempt_id&&!!a.question_id&&Number.isFinite(Date.parse(a.timestamp))&&
 ['richtig','teilweise','falsch',null].includes(a.correctness)&&typeof a.user_answer==='object'&&a.user_answer!==null&&
 typeof a.unsure==='boolean'&&Array.isArray(a.hints_used)&&Array.isArray(a.subparts)&&
 typeof a.note==='string'&&typeof a.error_reason==='string'&&typeof a.auto_scored==='boolean'&&typeof a.self_assessed==='boolean';
}
