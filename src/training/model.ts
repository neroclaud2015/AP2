import type {ModuleConfig} from '../learning/modules';
import type {AttemptProvenance,LearningSession,USolution} from '../learning/model';
import type {OfficialAnswer} from '../segmented/answers';
import type {SegmentedQuestion} from '../segmented/types';

export interface TrainingDefinition {knowledgeTopicIds:string[];questionTypeIds:string[];moduleIds:string[];examIds:string[]}
export type TrainingStage=1|2|3|'mastered';
export interface TrainingQuestionSnapshot {question:SegmentedQuestion;config:ModuleConfig;answer:OfficialAnswer|null;solution:USolution|null;provenance?:AttemptProvenance;cropEdited?:boolean}
export interface TrainingRun {userId:string;run_id:string;definition_key:string;definition:TrainingDefinition;kind:'bank'|'stage'|'uncertainty';stage?:TrainingStage;question_ids:string[];snapshots:Record<string,TrainingQuestionSnapshot>;current_question:string;drafts:Record<string,LearningSession>;attempt_ids:Record<string,string[]>;created_at:string;updated_at:string;revision:number}
export interface TrainingProgress {userId:string;definition_key:string;run_id:string;revision:number;updated_at:string}
export interface TrainingStartOptions {restart?:boolean;stage?:TrainingStage;uncertainty?:boolean}
export const TRAINING_STORES=['trainingRuns','trainingProgress'] as const;
const fields=['knowledgeTopicIds','questionTypeIds','moduleIds','examIds'] as const;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim();
const stamp=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const box=(v:unknown)=>Array.isArray(v)&&v.length===4&&v.every(x=>typeof x==='number'&&Number.isFinite(x))&&v[0]>=0&&v[1]>=0&&v[2]>v[0]&&v[3]>v[1];
const page=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
function validSubpart(v:unknown):boolean {
 if(!object(v)||!text(v.id)||typeof v.label!=='string'||!['numeric','short_text','drawing','diagram'].includes(String(v.type)))return false;
 if(v.numeric===undefined)return v.type!=='numeric';
 return object(v.numeric)&&typeof v.numeric.value==='number'&&Number.isFinite(v.numeric.value)&&typeof v.numeric.unit==='string'&&typeof v.numeric.tolerance==='number'&&Number.isFinite(v.numeric.tolerance)&&v.numeric.tolerance>=0;
}
function validSolution(value:unknown,question:SegmentedQuestion):boolean {
 if(!object(value)||value.question_id!==question.question_id||value.question_number!==question.question_number||value.answer_type!=='multi_part'||typeof value.solution_source_pdf!=='string'||!page(value.solution_source_page)||!text(value.cropped_solution_image)||!text(value.extractor_revision)||!Array.isArray(value.regions)||!value.regions.length||!value.regions.every(r=>object(r)&&page(r.source_page)&&box(r.bbox))||!Array.isArray(value.subparts)||!value.subparts.length||!value.subparts.every(validSubpart))return false;
 return new Set(value.subparts.map(p=>p.id)).size===value.subparts.length;
}
export function canonicalTrainingDefinition(value:TrainingDefinition):TrainingDefinition {
 if(!object(value)||fields.some(k=>!Array.isArray(value[k])||!value[k].every(text)))throw Error('Ungültige Trainingsfilter.');
 return Object.fromEntries(fields.map(k=>[k,[...new Set(value[k])].sort()])) as unknown as TrainingDefinition;
}
export const trainingDefinitionKey=(value:TrainingDefinition)=>JSON.stringify(canonicalTrainingDefinition(value));
export function validTrainingSnapshot(value:unknown):value is TrainingQuestionSnapshot {
 if(!object(value)||!object(value.question)||!object(value.config))return false;
 const q=value.question,c=value.config;
 if(!text(q.question_id)||!text(q.question_number)||!text(q.segmentation_revision)||!text(q.cropped_question_image)||!text(q.exam)||!text(q.module)||!text(c.examId)||!text(c.slug)||!Array.isArray(c.parts)||q.exam.replaceAll('_','-')!==c.examId||q.module.toLowerCase()!==c.slug||typeof q.source_pdf!=='string'||(typeof q.source_page_image!=='string'||!q.source_page_image&&q.source_page_available!==false)||!Number.isInteger(q.source_page)||Number(q.source_page)<1||!Array.isArray(q.source_size)||q.source_size.length!==2||!q.source_size.every(x=>typeof x==='number'&&x>0&&Number.isFinite(x))||!box(q.bounding_box)||!Array.isArray(q.regions)||!q.regions.length||!q.regions.every(box)||typeof q.extracted_text!=='string'||!Array.isArray(q.tags)||!q.tags.every(x=>typeof x==='string')||(value.cropEdited!==undefined&&typeof value.cropEdited!=='boolean')||(value.provenance!==undefined&&(!object(value.provenance)||Object.values(value.provenance).some(x=>typeof x!=='string'))))return false;
 const part=c.parts.find(p=>object(p)&&Array.isArray(p.questionNumbers)&&p.questionNumbers.includes(q.question_number));
 if(!object(part))return false;
 if(part.kind==='multiple_choice')return object(value.answer)&&value.answer.question_id===q.question_id&&(value.answer.official_answer===null||Number.isInteger(value.answer.official_answer)&&Number(value.answer.official_answer)>=1&&Number(value.answer.official_answer)<=5)&&text(value.answer.parser_revision)&&value.solution===null;
 return part.kind==='multi_part'&&value.answer===null&&validSolution(value.solution,q as unknown as SegmentedQuestion);
}
export function validTrainingRun(v:unknown):v is TrainingRun {
 if(!object(v))return false;
 try{if(v.definition_key!==trainingDefinitionKey(v.definition as TrainingDefinition))return false;}catch{return false;}
 if(!text(v.userId)||!text(v.run_id)||!['bank','stage','uncertainty'].includes(String(v.kind))||(v.kind==='stage'?![1,2,3,'mastered'].includes(v.stage as TrainingStage):v.stage!==undefined)||!stamp(v.created_at)||!stamp(v.updated_at)||!Number.isSafeInteger(v.revision)||Number(v.revision)<1||!Array.isArray(v.question_ids)||!v.question_ids.length||!v.question_ids.every(text)||new Set(v.question_ids).size!==v.question_ids.length||!v.question_ids.includes(String(v.current_question))||!object(v.snapshots)||!object(v.drafts)||!object(v.attempt_ids))return false;
 const ids=v.question_ids as string[],snapshots=v.snapshots,drafts=v.drafts,attempts=v.attempt_ids;
 if(Object.keys(snapshots).length!==ids.length||Object.keys(drafts).some(id=>!ids.includes(id))||Object.keys(attempts).some(id=>!ids.includes(id)))return false;
 return ids.every(id=>{const s=snapshots[id],d=drafts[id],a=attempts[id];return validTrainingSnapshot(s)&&s.question.question_id===id&&(d===undefined||object(d)&&d.userId===v.userId&&d.question_id===id&&object(d.draft)&&Object.values(d.draft).every(x=>typeof x==='string')&&typeof d.revealed==='boolean'&&(d.attempt_id===undefined||Array.isArray(a)&&a.includes(d.attempt_id)))&&(a===undefined||Array.isArray(a)&&a.every(text)&&new Set(a).size===a.length);});
}
export function validTrainingProgress(v:unknown):v is TrainingProgress {return object(v)&&text(v.userId)&&text(v.definition_key)&&text(v.run_id)&&Number.isSafeInteger(v.revision)&&Number(v.revision)>0&&stamp(v.updated_at);}
