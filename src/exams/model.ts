import type {ModuleConfig} from '../learning/modules';
import {moduleParts} from '../learning/modules';
import type {SegmentedExam} from '../segmented/types';
import type {OfficialAnswer} from '../segmented/answers';
import type {Correctness,USolution} from '../learning/model';
import {combineAssessments} from '../learning/model';

export type TestType='original'|'module';
export type TestMode='kurz'|'standard';
export interface QuestionModel {kind:'multiple_choice'|'multi_part';subpart_ids:string[];number:string;part:string}
export interface TestSource {question_id:string;exam:string;module:string;question_number:string;source_pdf:string;source_page:number;revision:string;answer_source_pdf?:string;answer_source_page?:number;answer_source_crop?:string;solution_image?:string}
export interface TestResult {total:number;beantwortet:number;richtig:number;falsch:number;teilweise:number;unbeantwortet:number;pending:number;vorlaeufig:boolean;byQuestion:Record<string,Correctness|'unbeantwortet'|'pending'>}
export interface TestSession {
 test_id:string;exam_session_id:string;userId:string;test_type:TestType;exam:string;module:string;mode:TestMode;seed:string;
 question_ids:string[];question_models:Record<string,QuestionModel>;source_mix:TestSource[];
 answers:Record<string,Record<string,string>>;subpart_assessments:Record<string,Record<string,Correctness>>;official_answers:Record<string,number|null>;
 started_at:string;completed_at:string|null;status:'active'|'paused'|'submitted'|'abandoned';current_question:string;
 elapsed_time:number;active_since:number|null;revision:number;duration_minutes:number|null;result:TestResult|null;
}
export type SessionAction={type:'answer';questionId:string;answer:Record<string,string>}|{type:'move';questionId:string}|{type:'pause'|'resume'|'submit'|'abandon'}|{type:'assess';questionId:string;assessments:Record<string,Correctness>};
export const TEST_SIZES={kurz:{multiple_choice:6,multi_part:2},standard:{multiple_choice:12,multi_part:4}};
function random(seed:string){let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return()=>{n+=0x6D2B79F5;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
function shuffled<T>(input:T[],rng:()=>number){const a=[...input];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function createSession(input:{type:TestType;config:ModuleConfig;exam:SegmentedExam;officialAnswers:OfficialAnswer[];solutions:USolution[];mode?:TestMode;seed?:string;now?:number}):TestSession {
 const {config,exam,officialAnswers,solutions}=input;const now=input.now??Date.now();const mode=input.mode??'kurz';const seed=input.seed??crypto.randomUUID();
 const expected=config.parts.flatMap(p=>p.questionNumbers);
 if(exam.module!==config.title||new Set(expected).size!==expected.length||exam.questions.length!==expected.length||expected.some(n=>exam.questions.filter(q=>q.question_number===n).length!==1))throw Error('Der vollständige Aufgabensatz ist nicht eindeutig verfügbar.');
 const parts=moduleParts(config,exam.questions);let selected=parts.flatMap(p=>p.questions);
 if(input.type==='module'){
  const rng=random(seed);selected=parts.flatMap(p=>{
   const amount=TEST_SIZES[mode][p.kind];if(p.questions.length<amount)throw Error('Nicht genügend Aufgaben für diesen Test.');
   const shuffledQuestions=shuffled(p.questions,rng);const chosen=shuffledQuestions.slice(0,amount);
   const indices=chosen.map(q=>p.questions.indexOf(q));
   if(amount>1&&p.questions.length>amount&&Math.max(...indices)-Math.min(...indices)===amount-1){
    const outside=shuffledQuestions.slice(amount).sort((a,b)=>Math.abs(p.questions.indexOf(b)-indices[0])-Math.abs(p.questions.indexOf(a)-indices[0]));chosen[chosen.length-1]=outside[0];
   }
   return chosen;
  });selected=shuffled(selected,rng);
 }
 if(!selected.length||new Set(selected.map(q=>q.question_id)).size!==selected.length)throw Error('Ungültige Aufgabenliste.');
 const question_models:TestSession['question_models']={};const official_answers:TestSession['official_answers']={};const source_mix:TestSource[]=[];
 for(const q of selected){
  const part=parts.find(p=>p.questionNumbers.includes(q.question_number));if(!part)throw Error('Prüfungsteil fehlt.');
  const u=solutions.find(s=>s.question_id===q.question_id);const key=officialAnswers.find(k=>k.question_id===q.question_id);
  if(part.kind==='multi_part'&&(!u||!u.subparts.length))throw Error('Offizielle Teilaufgaben fehlen.');
  question_models[q.question_id]={kind:part.kind,subpart_ids:u?.subparts.map(s=>s.id)??[],number:q.question_number,part:part.title};
  official_answers[q.question_id]=key&&['auto_ready','confirmed'].includes(key.official_answer_status)&&Number.isInteger(key.official_answer)&&key.official_answer!>=1&&key.official_answer!<=5?key.official_answer:null;
  source_mix.push({question_id:q.question_id,exam:config.examId,module:config.slug,question_number:q.question_number,source_pdf:q.source_pdf,source_page:q.source_page,revision:q.segmentation_revision,
   answer_source_pdf:key?.source_pdf??u?.solution_source_pdf,answer_source_page:key?.source_page??u?.solution_source_page,answer_source_crop:key?.source_crop,solution_image:u?.cropped_solution_image});
 }
 const id=crypto.randomUUID();
 return {test_id:id,exam_session_id:id,userId:'local',test_type:input.type,exam:config.examId,module:config.slug,mode,seed,question_ids:selected.map(q=>q.question_id),question_models,source_mix,
  official_answers,answers:{},subpart_assessments:{},started_at:new Date(now).toISOString(),completed_at:null,status:'active',current_question:selected[0].question_id,elapsed_time:0,active_since:now,revision:0,
  duration_minutes:input.type==='original'?config.durationMinutes??null:null,result:null};
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
  if(s.status==='abandoned')throw Error('Versuch abgebrochen.');hasQuestion(action.questionId);next.current_question=action.questionId;
 }else if(action.type==='pause'){
  if(s.status!=='active')throw Error('Nur laufende Versuche können pausieren.');next={...next,status:'paused',elapsed_time:elapsedMs(s,now),active_since:null};
 }else if(action.type==='resume'){
  if(s.status!=='paused')throw Error('Versuch ist nicht pausiert.');next={...next,status:'active',active_since:now};
 }else if(action.type==='submit'||action.type==='abandon'){
  if(!['active','paused'].includes(s.status))throw Error('Versuch wurde bereits beendet.');
  next={...next,status:action.type==='submit'?'submitted':'abandoned',elapsed_time:elapsedMs(s,now),active_since:null,completed_at:new Date(now).toISOString()};
 }else if(action.type==='assess'){
  if(s.status!=='submitted')throw Error('Selbstbewertung erst nach Abgabe.');hasQuestion(action.questionId);const model=s.question_models[action.questionId];
  if(model.kind!=='multi_part'||!questionAnswered(s,action.questionId))throw Error('Keine beantwortete offene Aufgabe.');
  if(Object.entries(action.assessments).some(([id,value])=>!model.subpart_ids.includes(id)||!['richtig','teilweise','falsch'].includes(value)))throw Error('Ungültige Selbstbewertung.');
  next.subpart_assessments={...s.subpart_assessments,[action.questionId]:{...action.assessments}};
 }
 next.revision=s.revision+1;next.result=next.status==='submitted'?sessionResult(next):null;return next;
}
