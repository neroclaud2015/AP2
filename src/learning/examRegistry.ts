import type {SourceExams} from './sourceExams';
export interface ExamOption {id:string;label:string}
/** Registry identities, rather than a UI year list, determine available seasons. */
export function examSessions(modules:ReadonlyArray<{examId:string}>):ExamOption[]{return [...new Set(modules.map(m=>m.examId))].sort().map(id=>{const summer=/^(\d{4})-sommer$/.exec(id),winter=/^(\d{4})-(\d{2})-winter$/.exec(id);return {id,label:summer?`Sommer ${summer[1]}`:winter?`Winter ${winter[1]}/${winter[2]}`:id};}).sort((a,b)=>Number(a.id.slice(0,4))-Number(b.id.slice(0,4))||Number(a.id.endsWith('winter'))-Number(b.id.endsWith('winter'))||a.id.localeCompare(b.id));}
export function yearSelectionLabel(value:SourceExams,years:ExamOption[]):string{return value==='all'?'Alle Jahre':value.length===0?'Keine ausgewählt':value.length===1?(years.find(y=>y.id===value[0])?.label??'Nicht verfügbar'):`${value.length} Jahrgänge ausgewählt`;}
