import type {Attempt,LearningSession} from './model';
export type ModuleSlug=string;
export type View='start'|'learn'|'exams'|'tests'|'session'|'study'|'review';
export interface PartConfig {id:string;title:string;kind:'multiple_choice'|'multi_part';label:string;questionNumbers:string[]}
export interface ModuleConfig {examId:string;slug:ModuleSlug;title:string;segmentedPath:string;answersPath:string;solutionsPath:string;choiceSolutionPage:number;descriptionPage:number;descriptionLabel?:string;attachmentPages:number[];parts:PartConfig[];durationMinutes:number|null;durationSource?:{pdf:string;page:number}}
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
];
export function moduleParts<Q extends {question_number:string}>(config:ModuleConfig,questions:Q[]){
 return config.parts.map(part=>({...part,questions:part.questionNumbers.flatMap(number=>{const q=questions.find(q=>q.question_number===number);return q?[q]:[];})}));
}
export function questionPart(config:ModuleConfig,number:string){return config.parts.find(part=>part.questionNumbers.includes(number));}
export interface LearningRoute {view:View;examId:string;module:ModuleSlug;number:string;sessionId?:string}
export function readRoute(search:string):LearningRoute {
 const p=new URLSearchParams(search);const requested=p.get('view');
 const config=MODULES.find(m=>m.slug===(p.get('module')??MODULES[0].slug)&&m.examId===(p.get('exam')??MODULES[0].examId))??MODULES[0];
 return {view:(['start','learn','exams','tests','session','study','review'].includes(requested??'')?requested:p.has('q')?'study':'start') as View,examId:config.examId,module:config.slug,number:p.get('q')??config.parts[0].questionNumbers[0],...(requested==='session'&&p.get('session')?{sessionId:p.get('session')!}:{})};
}
export function routeUrl(route:LearningRoute,href:string):URL {
 const url=new URL(href);url.searchParams.set('view',route.view);url.searchParams.set('exam',route.examId);url.searchParams.set('module',route.module);
 if(route.view==='study'||route.view==='review')url.searchParams.set('q',route.number);else url.searchParams.delete('q');if(route.view==='session'&&route.sessionId)url.searchParams.set('session',route.sessionId);else url.searchParams.delete('session');return url;
}
export function moduleProgress(questions:{question_id:string;question_number:string}[],allAttempts:Attempt[],allSessions:LearningSession[]){
 const ids=new Set(questions.map(q=>q.question_id));const attempts=allAttempts.filter(a=>ids.has(a.question_id));const sessions=allSessions.filter(s=>ids.has(s.question_id));
 const latest=new Map<string,Attempt>();for(const a of [...attempts].sort((a,b)=>a.timestamp.localeCompare(b.timestamp)))latest.set(a.question_id,a);
 const activity=[...attempts.map(a=>({id:a.question_id,date:a.timestamp})),...sessions.map(s=>({id:s.question_id,date:s.updated_at??''}))].sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
 return {practiced:latest.size,attempts:attempts.length,correct:[...latest.values()].filter(a=>a.correctness==='richtig').length,unsure:[...latest.values()].filter(a=>a.unsure).length,lastActivity:activity?.date??'',resumeNumber:questions.find(q=>q.question_id===activity?.id)?.question_number??questions[0]?.question_number??'1',done:new Set(latest.keys())};
}
