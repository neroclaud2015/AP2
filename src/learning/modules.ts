import {fullPdfUrl} from '../segmented/fullPdf';
import {examSessions} from './examRegistry';
import {MODULE_ORDER} from './moduleOrder';
import promotedModules from '../../public/data/promoted_modules.json';
import {productionAdditions} from '../manualReview/productionAdditions';
import sourceRegistry from '../../public/data/source_registry.json';
import {assertProductionModule} from '../sources/registry';
import {parseSourceExams,type SourceExams} from './sourceExams';
import {summarizeProgress,nextQuestion,type ModuleProgress} from './moduleProgress';
export type ModuleSlug=string;
export type View='training'|'bank'|'wrong'|'classification-review'|'start'|'learn'|'exams'|'tests'|'session'|'study'|'review'|'history'|'settings';
export interface PartConfig {id:string;title:string;kind:'multiple_choice'|'multi_part';label:string;questionNumbers:string[]}
export interface ExternalAttachment {id:string;label:string;image:string;filename:string;source_page:number;sha256:string;question_numbers:string[]}
export interface ModuleConfig {externalAttachments?:ExternalAttachment[];examId:string;slug:ModuleSlug;title:string;segmentedPath:string;answersPath:string;solutionsPath:string;choiceSolutionPage:number;descriptionPage:number;descriptionLabel?:string;sharedContextForAllQuestions?:boolean;questionContextPages?:Record<string,number[]>;attachmentPages:number[];parts:PartConfig[];durationMinutes:number|null;sourcePageImages?:Partial<Record<number,string>>;durationSource?:{pdf:string;page:number;image?:string}}
const standardParts=():PartConfig[]=>[
 {id:'A',title:'Teil A',kind:'multiple_choice',label:'Auswahlaufgaben',questionNumbers:Array.from({length:28},(_,i)=>String(i+1))},
 {id:'B',title:'Teil B',kind:'multi_part',label:'Offene Aufgaben',questionNumbers:Array.from({length:8},(_,i)=>`U${i+1}`)},
];
export const MODULES:ModuleConfig[]=[
 {examId:'2017-sommer',slug:'arbeitsplanung',title:'Arbeitsplanung',segmentedPath:'data/2017_sommer_arbeitsplanung_segmented.json',answersPath:'data/2017_sommer_arbeitsplanung_answers.json',solutionsPath:'data/2017_sommer_arbeitsplanung_u_solutions.json',choiceSolutionPage:2,descriptionPage:9,attachmentPages:[13],parts:standardParts(),durationMinutes:105,durationSource:{pdf:'assets/pdfs/35c77ffdb630f70057e4cfb8.pdf',page:2}},
 {examId:'2017-sommer',slug:'funktionsanalyse',title:'Funktionsanalyse',segmentedPath:'data/2017_sommer_funktionsanalyse_segmented.json',answersPath:'data/2017_sommer_funktionsanalyse_answers.json',solutionsPath:'data/2017_sommer_funktionsanalyse_u_solutions.json',choiceSolutionPage:1,descriptionPage:9,attachmentPages:[13,14,15],parts:standardParts(),durationMinutes:105,durationSource:{pdf:'assets/pdfs/0734a1589eed96809ac7896a.pdf',page:2}},
 {examId:'2017-sommer',slug:'wiso',title:'WiSo',segmentedPath:'data/2017_sommer_wiso_segmented.json',answersPath:'data/2017_sommer_wiso_answers.json',solutionsPath:'data/2017_sommer_wiso_u_solutions.json',choiceSolutionPage:3,descriptionPage:2,descriptionLabel:'Prüfungshinweise',attachmentPages:[9],durationMinutes:60,durationSource:{pdf:'assets/pdfs/35f662246f2737dba0b61b88.pdf',page:2},parts:[
  {id:'A',title:'Gebundene Aufgaben',kind:'multiple_choice',label:'Auswahlaufgaben',questionNumbers:Array.from({length:18},(_,i)=>String(i+1))},
  {id:'B',title:'Ungebundene Aufgaben',kind:'multi_part',label:'Offene Aufgaben',questionNumbers:Array.from({length:6},(_,i)=>`U${i+1}`)},
 ]},
 {examId:'2017-18-winter',slug:'arbeitsplanung',title:'Arbeitsplanung',segmentedPath:'data/2017_18_winter_arbeitsplanung_segmented.json',answersPath:'data/2017_18_winter_arbeitsplanung_answers.json',solutionsPath:'data/2017_18_winter_arbeitsplanung_u_solutions.json',choiceSolutionPage:10,descriptionPage:14,attachmentPages:[24,25],parts:standardParts(),durationMinutes:105,durationSource:{pdf:'',page:2,image:'evidence/layout-profiles/ap_2017_18/2b.1.1-a2fe9c23bdbf61a4/page-002.png'},sourcePageImages:Object.fromEntries(Array.from({length:25},(_,i)=>[i+1,`evidence/layout-profiles/ap_2017_18/2b.1.1-a2fe9c23bdbf61a4/page-${String(i+1).padStart(3,'0')}.png`]))},
 {examId:'2017-18-winter',slug:'funktionsanalyse',title:'Funktionsanalyse',segmentedPath:'data/2017_18_winter_funktionsanalyse_segmented.json',answersPath:'data/2017_18_winter_funktionsanalyse_answers.json',solutionsPath:'data/2017_18_winter_funktionsanalyse_u_solutions.json',choiceSolutionPage:11,descriptionPage:16,attachmentPages:[24],parts:standardParts(),durationMinutes:105,durationSource:{pdf:'assets/pdfs/765e3fd4ff24429fd28bee06.pdf',page:2}},
 {examId:'2017-18-winter',slug:'wiso',title:'WiSo',segmentedPath:'data/2017_18_winter_wiso_segmented.json',answersPath:'data/2017_18_winter_wiso_answers.json',solutionsPath:'data/2017_18_winter_wiso_u_solutions.json',choiceSolutionPage:12,descriptionPage:0,descriptionLabel:'Unterlagen',attachmentPages:[12],durationMinutes:60,durationSource:{pdf:'',page:2,image:'assets/official/winter-wiso-timing.png'},sourcePageImages:{12:'assets/questions/47d11c07ee752963d6746821/2e.1.0-b9bca870c797/attachment-12.png'},parts:[
 {id:'A',title:'Gebundene Aufgaben',kind:'multiple_choice',label:'Auswahlaufgaben',questionNumbers:Array.from({length:18},(_,i)=>String(i+1))},
 {id:'B',title:'Ungebundene Aufgaben',kind:'multi_part',label:'Offene Aufgaben',questionNumbers:Array.from({length:6},(_,i)=>`U${i+1}`)},
 ]},
 {examId:'2018-sommer',slug:'wiso',title:'WiSo',segmentedPath:'data/2018_sommer_wiso_segmented.json',answersPath:'data/2018_sommer_wiso_answers.json',solutionsPath:'data/2018_sommer_wiso_u_solutions.json',choiceSolutionPage:3,descriptionPage:3,descriptionLabel:'Prüfungsaufgaben-Beschreibung',sharedContextForAllQuestions:true,attachmentPages:[13],durationMinutes:60,durationSource:{pdf:'',page:2,image:'assets/questions/d70911bd62cdd7a47a13c1ee/2f.1.0-f88a0acb6f43/attachment-2-0.png'},sourcePageImages:{3:'assets/questions/d70911bd62cdd7a47a13c1ee/2f.1.0-f88a0acb6f43/attachment-3-1.png',13:'assets/questions/d70911bd62cdd7a47a13c1ee/2f.1.0-f88a0acb6f43/attachment-13-2.png'},parts:[
  {id:'A',title:'Gebundene Aufgaben',kind:'multiple_choice',label:'Auswahlaufgaben',questionNumbers:Array.from({length:18},(_,i)=>String(i+1))},
  {id:'B',title:'Ungebundene Aufgaben',kind:'multi_part',label:'Offene Aufgaben',questionNumbers:Array.from({length:6},(_,i)=>`U${i+1}`)},
 ]},
 {examId:'2018-19-winter',slug:'wiso',title:'WiSo',segmentedPath:'data/2018_19_winter_wiso_segmented.json',answersPath:'data/2018_19_winter_wiso_answers.json',solutionsPath:'data/2018_19_winter_wiso_u_solutions.json',choiceSolutionPage:1,descriptionPage:3,descriptionLabel:'Prüfungsaufgaben-Beschreibung',sharedContextForAllQuestions:true,attachmentPages:[17],durationMinutes:60,durationSource:{pdf:'',page:2,image:'assets/questions/6432e4aebe0150c2dfe3139e/2i.1.0-da4449b33ada/attachment-2-0.png'},sourcePageImages:{3:'assets/questions/6432e4aebe0150c2dfe3139e/2i.1.0-da4449b33ada/attachment-3-1.png',17:'assets/questions/6432e4aebe0150c2dfe3139e/2i.1.0-da4449b33ada/attachment-17-2.png'},parts:[
  {id:'A',title:'Gebundene Aufgaben',kind:'multiple_choice',label:'Auswahlaufgaben',questionNumbers:Array.from({length:18},(_,i)=>String(i+1))},
  {id:'B',title:'Ungebundene Aufgaben',kind:'multi_part',label:'Offene Aufgaben',questionNumbers:Array.from({length:6},(_,i)=>`U${i+1}`)},
 ]},
];
MODULES.push(...productionAdditions(sourceRegistry,promotedModules as ModuleConfig[],MODULES));
for(const module of MODULES)assertProductionModule(sourceRegistry,module);
export const EXAM_SESSIONS=examSessions(MODULES);
MODULES.sort((a,b)=>EXAM_SESSIONS.findIndex(e=>e.id===a.examId)-EXAM_SESSIONS.findIndex(e=>e.id===b.examId)||(MODULE_ORDER[a.slug]??100)-(MODULE_ORDER[b.slug]??100)||a.slug.localeCompare(b.slug));
export const MODULE_TITLES:Record<string,string>={arbeitsplanung:'Arbeitsplanung',funktionsanalyse:'Funktionsanalyse',wiso:'WiSo'};
export function examLabel(id:string){return EXAM_SESSIONS.find(e=>e.id===id)?.label??id;}
export function moduleKey(config:Pick<ModuleConfig,'examId'|'slug'>){return `${config.examId}/${config.slug}`;}
export function findModule(examId:string,slug:string){return MODULES.find(m=>m.examId===examId&&m.slug===slug);}
export function moduleParts<Q extends {question_number:string}>(config:ModuleConfig,questions:Q[]){
 return config.parts.map(part=>({...part,questions:part.questionNumbers.flatMap(number=>{const q=questions.find(q=>q.question_number===number);return q?[q]:[];})}));
}
export function questionPart(config:ModuleConfig,number:string){return config.parts.find(part=>part.questionNumbers.includes(number));}
export interface LearningRoute {view:View;examId:string;module:ModuleSlug;number:string;sessionId?:string;trainingRunId?:string;sourceExams?:SourceExams}
export function readRoute(search:string):LearningRoute {
 const p=new URLSearchParams(search);const requested=p.get('view');
 const config=MODULES.find(m=>m.slug===(p.get('module')??MODULES[0].slug)&&m.examId===(p.get('exam')??MODULES[0].examId))??MODULES.find(m=>m.examId===p.get('exam'))??MODULES[0];
 return {view:(['training','bank','wrong','classification-review','start','learn','exams','tests','session','study','review','history','settings'].includes(requested??'')?requested:p.has('q')?'study':'start') as View,examId:config.examId,module:config.slug,number:p.get('q')??config.parts[0].questionNumbers[0],...((requested==='tests'||requested==='session'&&p.has('years'))?{sourceExams:parseSourceExams(p.get('years'))}:{}),...(requested==='training'&&p.get('run')?{trainingRunId:p.get('run')!}:{}),...(requested==='session'&&p.get('session')?{sessionId:p.get('session')!}:{})};
}
export function routeUrl(route:LearningRoute,href:string):URL {
 const url=new URL(href);if(route.view==='training'&&route.trainingRunId)url.searchParams.set('run',route.trainingRunId);else url.searchParams.delete('run');if(route.view==='tests'||route.view==='session'&&route.sourceExams!==undefined){const filter=route.sourceExams??'all';url.searchParams.set('years',filter==='all'?'all':filter.join(','));}else url.searchParams.delete('years');url.searchParams.set('view',route.view);url.searchParams.set('exam',route.examId);url.searchParams.set('module',route.module);
 if(route.view==='study'||route.view==='review')url.searchParams.set('q',route.number);else url.searchParams.delete('q');if(route.view==='session'&&route.sessionId)url.searchParams.set('session',route.sessionId);else url.searchParams.delete('session');return url;
}
export function moduleProgress(questions:{question_id:string;question_number:string}[],current?:ModuleProgress){
 const ids=questions.map(q=>q.question_id),s=summarizeProgress(current,ids);return {...s,practiced:s.completed,lastActivity:current&&(current.revision>1||s.completed>0)?current.updated_at:'',resumeNumber:questions.find(q=>q.question_id===nextQuestion(current,ids))?.question_number??questions[0]?.question_number??'1',done:new Set(ids.filter(id=>current?.questionStates[id]?.state&&current.questionStates[id].state!=='unanswered'))};
}

export function originalPageLink(config:ModuleConfig,pdf:string,page:number,sha256?:string){const original=fullPdfUrl({source:pdf,page,sha256});if(original)return original;const image=config.sourcePageImages?.[page];return image?import.meta.env.BASE_URL+image:import.meta.env.BASE_URL+pdf+`#page=${page}`;}

export function switchExamRoute(route:LearningRoute,examId:string,modules:ModuleConfig[]=MODULES):LearningRoute {
 const target=modules.find(m=>m.examId===examId&&m.slug===route.module)??modules.find(m=>m.examId===examId);
 if(!target)return route;
 const number=target.parts.some(p=>p.questionNumbers.includes(route.number))?route.number:target.parts[0].questionNumbers[0];
 return {view:route.view==='session'?'exams':route.view,examId:target.examId,module:target.slug,number};
}
