import type {ReviewItem} from './model';
import {confirmedReview,machineChanged,reviewExport} from './model';
import type {AnswerReview} from '../segmented/answers';
export type ReviewType='official_answer'|'shared_region_mapping'|'question_boundary'|'U_solution_mapping'|'attachment_mapping'|'other_source_association'|'classification';
export interface OvernightItem {id:string;exam:string;examLabel:string;module:string;question:string;type:ReviewType;reason:string;scope?:string;answer?:ReviewItem;source_crop?:string;source_crop_sha256?:string;evidence_hash:string;proposal?:unknown;requires_source?:boolean;evidence_images?:{src:string;sha256:string;label:string}[]}
export interface MappingDecision {id:string;evidence_hash:string;decision:'confirmed'|'change_requested';comment:string;updated_at:string}
const order:Record<string,number>={Arbeitsplanung:10,Funktionsanalyse:20,WiSo:30};
export function orderedQueue(items:OvernightItem[]){if(new Set(items.map(i=>i.id)).size!==items.length)throw Error('Duplicate review identity');return [...items].sort((a,b)=>a.exam.localeCompare(b.exam)||(order[a.module]??99)-(order[b.module]??99)||a.question.localeCompare(b.question,undefined,{numeric:true})||a.type.localeCompare(b.type));}
export function exportOvernight(items:OvernightItem[],reviews:AnswerReview[],decisions:MappingDecision[]){
 const valid=items.flatMap(i=>{if(!i.answer)return [];const r=confirmedReview(i.answer,reviews.find(r=>r.question_id===i.answer!.question_id));return r&&!machineChanged(i.answer,r)?[r]:[]});
 return {schema_version:1,scope:'overnight',exported_at:new Date().toISOString(),confirmations:reviewExport(items.flatMap(i=>i.answer?[i.answer]:[]),valid,'overnight').confirmations,scopes:[...new Set(items.flatMap(i=>i.scope?[i.scope]:[]))].map(scope=>reviewExport(items.filter(i=>i.scope===scope).flatMap(i=>i.answer?[i.answer]:[]),valid,scope)),mapping_decisions:decisions.filter(d=>items.some(i=>i.id===d.id&&i.evidence_hash===d.evidence_hash))};
}
