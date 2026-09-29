import type {AnswerReview,OfficialAnswer} from '../segmented/answers';
export interface Measurement {row:number;ring_ink:number;angular_support:number;center_ink?:number;threshold_offset:number;center?:number[]}
export interface ReviewItem extends OfficialAnswer {source_pdf_sha256:string;source_crop_sha256:string;evidence_hash:string;measurements:Measurement[];row_positions:number[];overlay:string}
export interface ManualReview extends AnswerReview {confirmation_method:'manual_source_review';exam:string;module:string;question_number:number;source_pdf_sha256:string;source_crop:string;source_crop_sha256:string;evidence_hash:string;machine_answer_at_confirmation:number|null}
export interface ReviewQueue {schema_version:1;scope:string;items:ReviewItem[];module_coverage?:Record<string,{mc:number;u:number}>}
export function strongestCandidate(item:ReviewItem):number|null {
 const scores=[1,2,3,4,5].map(row=>({row,score:Math.max(0,...item.measurements.filter(m=>m.row===row).map(m=>m.ring_ink))})).sort((a,b)=>b.score-a.score);
 return scores[0].score>0&&scores[0].score>scores[1].score?scores[0].row:null;
}
export function makeConfirmation(item:ReviewItem,userId:string,answer:number|null):ManualReview {
 if(!Number.isInteger(answer)||answer===null||answer<1||answer>5)throw Error('Bitte eine Antwort 1–5 anhand der Quelle auswählen.');
 return {userId,question_id:item.question_id,official_answer:answer,official_answer_status:'confirmed',user_corrected:true,locked:true,confirmation_method:'manual_source_review',parser_revision:item.parser_revision,updated_at:new Date().toISOString(),exam:item.exam,module:item.module,question_number:item.question_number,source_pdf_sha256:item.source_pdf_sha256,source_crop:item.source_crop,source_crop_sha256:item.source_crop_sha256,evidence_hash:item.evidence_hash,machine_answer_at_confirmation:item.official_answer};
}
export function confirmedReview(item:ReviewItem,value?:AnswerReview):ManualReview|undefined {
 const r=value as ManualReview|undefined;
 return r?.question_id===item.question_id&&r.locked&&r.user_corrected&&r.official_answer_status==='confirmed'&&r.confirmation_method==='manual_source_review'&&Number.isInteger(r.official_answer)&&r.official_answer>=1&&r.official_answer<=5?r:undefined;
}
export function machineChanged(item:ReviewItem,r:ManualReview){return r.parser_revision!==item.parser_revision||r.evidence_hash!==item.evidence_hash||r.machine_answer_at_confirmation!==item.official_answer;}
export function reviewExport(items:ReviewItem[],reviews:AnswerReview[],scope='winter-2018-19-ap-fa'){return {schema_version:1,scope,exported_at:new Date().toISOString(),confirmations:items.flatMap(item=>{const r=confirmedReview(item,reviews.find(v=>v.question_id===item.question_id));if(!r)return [];const {userId:_,...confirmation}=r;return [confirmation];})};}
