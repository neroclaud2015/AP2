import type {TestSession,TestType} from './model';
export const HISTORY_PAGE_SIZE=20;
export interface HistoryFilters {type:'all'|TestType;exam:string;status:'all'|'active'|'paused'|'completed'|'archived'}
export const DEFAULT_HISTORY_FILTERS:HistoryFilters={type:'all',exam:'all',status:'all'};
export const isArchived=(s:TestSession)=>s.status==='abandoned'||s.status==='discarded';
export function sessionExams(s:TestSession){return [...new Set(s.source_mix?.length?s.source_mix.map(q=>q.exam):[s.exam])];}
export function filterHistory(sessions:readonly TestSession[],filters:HistoryFilters=DEFAULT_HISTORY_FILTERS,options:{archive?:boolean}={}){
 return sessions.filter(s=>!s.deleted_at&&isArchived(s)===!!options.archive&&(filters.type==='all'||s.test_type===filters.type)&&(filters.exam==='all'||sessionExams(s).includes(filters.exam))&&(filters.status==='all'||(filters.status==='archived'?isArchived(s):s.status===filters.status))).sort((a,b)=>b.started_at.localeCompare(a.started_at)||a.test_id.localeCompare(b.test_id));
}
export function historyPage(sessions:readonly TestSession[],visible=HISTORY_PAGE_SIZE){return sessions.slice(0,Math.max(0,visible));}
export function dashboardHistory(sessions:readonly TestSession[],limit=5){return historyPage(filterHistory(sessions),Math.min(5,Math.max(0,limit)));}
