import {LOCAL_USER_ID} from '../services/identity';
import {includesSource,type SourceExams} from '../learning/sourceExams';
import type {ModuleConfig} from '../learning/modules';
import {moduleParts} from '../learning/modules';
import type {SegmentedQuestion,SegmentedExam} from '../segmented/types';
import type {OfficialAnswer} from '../segmented/answers';
import type {Correctness,USolution} from '../learning/model';
import {combineAssessments} from '../learning/model';

export type TestType='original'|'module';
export type TestMode='kurz'|'standard';
export type TestStatus='active'|'paused'|'completed'|'abandoned'|'discarded';
export interface QuestionModel {kind:'multiple_choice'|'multi_part';subpart_ids:string[];number:string;part:string;subpart_models?:USolution['subparts']}
export interface TestSource {question_id:string;exam:string;module:string;question_number:string;source_pdf:string;source_page:number;revision:string;answer_source_pdf?:string;answer_source_page?:number;answer_source_crop?:string;solution_image?:string;question_source_id?:string;solution_source_id?:string;question_source_sha256?:string;solution_source_sha256?:string;official_answer_revision?:string;answer_review_revision?:string;question_snapshot?:SegmentedQuestion}
export interface TestResult {total:number;beantwortet:number;richtig:number;falsch:number;teilweise:number;unbeantwortet:number;pending:number;vorlaeufig:boolean;byQuestion:Record<string,Correctness|'unbeantwortet'|'pending'>}
export interface TestSession {
 test_id:string;exam_session_id:string;userId:string;test_type:TestType;exam:string;module:string;mode:TestMode;seed:string;
 sourceExams?:SourceExams;question_ids:string[];question_models:Record<string,QuestionModel>;source_mix:TestSource[];
 answers:Record<string,Record<string,string>>;subpart_assessments:Record<string,Record<string,Correctness>>;official_answers:Record<string,number|null>;
 started_at:string;completed_at:string|null;status:TestStatus;current_question:string;discarded_at?:string;discarded_from?:TestStatus;previous_status?:TestStatus;deleted_at?:string;
 elapsed_time:number;active_since:number|null;revision:number;duration_minutes:number|null;result:TestResult|null;
}
export type SessionAction={type:'answer';questionId:string;answer:Record<string,string>}|{type:'move';questionId:string}|{type:'pause'|'resume'|'submit'|'abandon'|'discard'|'restore'}|{type:'assess';questionId:string;assessments:Record<string,Correctness>};
export const TEST_SIZES={kurz:{multiple_choice:6,multi_part:2},standard:{multiple_choice:12,multi_part:4}};
function random(seed:string){let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return()=>{n+=0x6D2B79F5;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
function shuffled<T>(input:T[],rng:()=>number){const a=[...input];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export interface SessionPool {config:ModuleConfig;exam:SegmentedExam;officialAnswers:OfficialAnswer[];solutions:USolution[];provenance?:{question_source_id:string;solution_source_id:string}}
export function createSession(input:SessionPool&{type:TestType;userId?:string;sourceExams?:SourceExams;pools?:SessionPool[];mode?:TestMode;seed?:string;now?:number}):TestSession {
 const {config}=input;const now=input.now??Date.now();const mode=input.mode??'kurz';const seed=input.seed??crypto.randomUUID();
 const sourceExams=input.sourceExams??'all';
 const pools=input.type==='module'?(input.pools??[input]).filter(p=>includesSource(sourceExams,p.config.examId)):[input];
 if(input.type==='module'&&sourceExams!=='all'&&(!sourceExams.length||sourceExams.some(id=>!pools.some(p=>p.config.examId===id))))throw Error('Ausgewählte Prüfungsquellen sind nicht verfügbar.');
 if(!pools.length||pools.some(p=>p.config.slug!==config.slug)||new Set(pools.map(p=>p.config.examId)).size!==pools.length)throw Error('Ungültige Prüfungsquellen.');
 const entries=pools.flatMap(pool=>{
  const expected=pool.config.parts.flatMap(p=>p.questionNumbers);
  if(pool.exam.exam.replaceAll('_','-')!==pool.config.examId||pool.exam.questions.some(q=>q.exam.replaceAll('_','-')!==pool.config.examId||q.module!==pool.config.title))throw Error('Prüfungsquelle und Aufgabenidentität stimmen nicht überein.');
  if(pool.exam.module!==pool.config.title||new Set(expected).size!==expected.length||pool.exam.questions.length!==expected.length||expected.some(n=>pool.exam.questions.filter(q=>q.question_number===n).length!==1))throw Error('Der vollständige Aufgabensatz ist nicht eindeutig verfügbar.');
  return moduleParts(pool.config,pool.exam.questions).flatMap(part=>part.questions.map(q=>({q,part,pool})));
 });
 if(new Set(entries.map(e=>e.q.question_id)).size!==entries.length)throw Error('Aufgabenidentität ist nicht eindeutig.');
 let selected=entries;
 if(input.type==='module'){
  const rng=random(seed);
  selected=(['multiple_choice','multi_part'] as const).flatMap(kind=>{
   const amount=TEST_SIZES[mode][kind];const groups=shuffled(pools.map(pool=>shuffled(entries.filter(e=>e.pool===pool&&e.part.kind===kind),rng)).filter(g=>g.length),rng);
   if(groups.reduce((n,g)=>n+g.length,0)<amount)throw Error('Nicht genügend Aufgaben für diesen Test.');
   const chosen:typeof entries=[];
   while(chosen.length<amount){for(const group of groups){if(group.length&&chosen.length<amount)chosen.push(group.shift()!);}}
   return chosen;
  });selected=shuffled(selected,rng);
  if(pools.length>1&&new Set(selected.map(e=>e.pool.config.examId)).size<2)throw Error('Zwei Prüfungsjahre sind für diesen Test nicht verfügbar.');
 }
 if(!selected.length)throw Error('Ungültige Aufgabenliste.');
 const question_models:TestSession['question_models']={};const official_answers:TestSession['official_answers']={};const source_mix:TestSource[]=[];
 for(const {q,part,pool} of selected){
  const u=pool.solutions.find(s=>s.question_id===q.question_id);const key=pool.officialAnswers.find(k=>k.question_id===q.question_id);
  if(part.kind==='multi_part'&&(!u||!u.subparts.length))throw Error('Offizielle Teilaufgaben fehlen.');
  question_models[q.question_id]={kind:part.kind,subpart_ids:u?.subparts.map(s=>s.id)??[],number:q.question_number,part:part.title,...(u?{subpart_models:structuredClone(u.subparts)}:{})};
  official_answers[q.question_id]=key&&['auto_ready','confirmed'].includes(key.official_answer_status)&&Number.isInteger(key.official_answer)&&key.official_answer!>=1&&key.official_answer!<=5?key.official_answer:null;
  source_mix.push({question_id:q.question_id,exam:pool.config.examId,module:pool.config.slug,question_number:q.question_number,source_pdf:q.source_pdf,source_page:q.source_page,revision:q.segmentation_revision,...pool.provenance,official_answer_revision:key?.parser_revision??u?.extractor_revision,answer_review_revision:(key as (OfficialAnswer&{updated_at?:string})|undefined)?.updated_at,question_snapshot:structuredClone(q),
   answer_source_pdf:key?(key.source_pdf_available===false?undefined:key.source_pdf):(u?.solution_source_pdf_available===false?undefined:u?.solution_source_pdf),answer_source_page:key?.source_page??u?.solution_source_page,answer_source_crop:key?.source_crop,solution_image:u?.cropped_solution_image});
 }
 const id=crypto.randomUUID();
 return {test_id:id,exam_session_id:id,userId:input.userId??LOCAL_USER_ID,test_type:input.type,exam:input.type==='module'?(pools.find(p=>p.config.examId===config.examId)??pools[0]).config.examId:config.examId,module:config.slug,mode,seed,...(input.type==='module'?{sourceExams:sourceExams==='all'?'all' as const:[...sourceExams]}:{}),question_ids:selected.map(e=>e.q.question_id),question_models,source_mix,
  official_answers,answers:{},subpart_assessments:{},started_at:new Date(now).toISOString(),completed_at:null,status:'active',current_question:selected[0].q.question_id,elapsed_time:0,active_since:now,revision:0,
  duration_minutes:input.type==='original'?config.durationMinutes??null:null,result:null};
}
export function isEligibleForAnalysis(s:TestSession){return s.status==='completed'&&!s.discarded_at&&!s.deleted_at;}
export function restoreStatus(s:TestSession):Exclude<TestStatus,'active'|'discarded'>|null {
 if(s.status!=='discarded'||s.deleted_at)return null;const previous=s.previous_status??s.discarded_from;
 return previous==='active'?'paused':previous==='paused'||previous==='completed'||previous==='abandoned'?previous:null;
}
export function elapsedMs(s:TestSession,now=Date.now()){return s.elapsed_time+(s.status==='active'&&s.active_since!==null?Math.max(0,now-s.active_since):0);}
export function questionAnswered(s:TestSession,id:string){const m=s.question_models[id],a=s.answers[id]??{};return m.kind==='multiple_choice'?/^[1-5]$/.test(a.choice??''):m.subpart_ids.some(k=>(a[k]??'').trim().length>0);}
export function sessionResult(s:TestSession):TestResult {
 const result:TestResult={total:s.question_ids.length,beantwortet:0,richtig:0,falsch:0,teilweise:0,unbeantwortet:0,pending:0,vorlaeufig:false,byQuestion:{}};
 for(const id of s.question_ids){
  let outcome:Correctness|'unbeantwortet'|'pending'='unbeantwortet';
  if(questionAnswered(s,id)){
   result.beantwortet++;const m=s.question_models[id];
   if(m.kind==='multiple_choice')outcome=s.official_answers[id]===null?'pending':Number(s.answers[id].choice)===s.official_answers[id]?'richtig':'falsch';
   else outcome=combineAssessments(m.subpart_ids.map(p=>s.subpart_assessments[id]?.[p]??null))??'pending';
  }
  result[outcome]++;result.byQuestion[id]=outcome;
 }
 result.vorlaeufig=result.pending>0;return result;
}
export function reduceSession(s:TestSession,action:SessionAction,now=Date.now()):TestSession {
 let next={...s};const hasQuestion=(id:string)=>{if(!s.question_ids.includes(id))throw Error('Aufgabe gehört nicht zu diesem Versuch.');};
 if(action.type==='answer'){
  if(s.status!=='active')throw Error('Antworten sind in diesem Status gesperrt.');hasQuestion(action.questionId);
  const model=s.question_models[action.questionId];const allowed=model.kind==='multiple_choice'?['choice']:model.subpart_ids;
  if(Object.entries(action.answer).some(([key,value])=>!allowed.includes(key)||typeof value!=='string')||(model.kind==='multiple_choice'&&!/^[1-5]?$/.test(action.answer.choice??'')))throw Error('Ungültige Antwort.');
  next.answers={...s.answers,[action.questionId]:{...action.answer}};
 }else if(action.type==='move'){
  if(s.status==='abandoned'||s.status==='discarded')throw Error('Versuch abgebrochen.');hasQuestion(action.questionId);next.current_question=action.questionId;
 }else if(action.type==='pause'){
  if(s.status!=='active')throw Error('Nur laufende Versuche können pausieren.');next={...next,status:'paused',elapsed_time:elapsedMs(s,now),active_since:null};
 }else if(action.type==='resume'){
  if(s.status!=='paused')throw Error('Versuch ist nicht pausiert.');next={...next,status:'active',active_since:now};
 }else if(action.type==='submit'||action.type==='abandon'){
  if(!['active','paused'].includes(s.status))throw Error('Versuch wurde bereits beendet.');
  next={...next,status:action.type==='submit'?'completed':'abandoned',elapsed_time:elapsedMs(s,now),active_since:null,completed_at:new Date(now).toISOString()};
 }else if(action.type==='discard'){
  if(s.status==='discarded')throw Error('Dieser Versuch ist bereits verworfen.');
  next={...next,status:'discarded',previous_status:s.status,discarded_from:s.status,discarded_at:new Date(now).toISOString(),elapsed_time:elapsedMs(s,now),active_since:null};
 }else if(action.type==='restore'){
  const target=restoreStatus(s);if(!target)throw Error('Der frühere Status ist nicht sicher bekannt. Wiederherstellen ist nicht möglich.');
  next={...next,status:target,active_since:null};delete next.discarded_at;delete next.previous_status;delete next.discarded_from;
 }else if(action.type==='assess'){
  if(s.status!=='completed')throw Error('Selbstbewertung erst nach Abgabe.');hasQuestion(action.questionId);const model=s.question_models[action.questionId];
  if(model.kind!=='multi_part'||!questionAnswered(s,action.questionId))throw Error('Keine beantwortete offene Aufgabe.');
  if(Object.entries(action.assessments).some(([id,value])=>!model.subpart_ids.includes(id)||!['richtig','teilweise','falsch'].includes(value)))throw Error('Ungültige Selbstbewertung.');
  next.subpart_assessments={...s.subpart_assessments,[action.questionId]:{...action.assessments}};
 }
 next.revision=s.revision+1;next.result=next.status==='completed'?(action.type==='restore'?s.result:sessionResult(next)):next.status==='discarded'?s.result:null;return next;
}
