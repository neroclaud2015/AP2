import type {Attempt,LearningSession} from '../learning/model';
import type {TestSession} from '../exams/model';
import type {TrainingRun} from '../training/model';
import {wrongResults,reconcileWrongQuestions,type WrongQuestionState,type WrongResult} from '../learning/wrongQuestions';
import {uncertaintyQuestionIds,type QuestionUncertaintyState} from '../learning/questionUncertainty';
import type {InventoryQuestion} from '../bank/model';
import {MODULE_ORDER} from '../learning/moduleOrder';
import defaults from './config.json';
export interface DashboardSnapshot {attempts:Attempt[];testSessions:TestSession[];learningSessions:LearningSession[];trainingRuns:TrainingRun[];wrongQuestions:WrongQuestionState[];questionUncertainty:QuestionUncertaintyState[]}
export interface DashboardConfig {highCoverage:number;minTrendQuestions:number;milestones:number[]}
const eligible=(value:unknown)=>{const r=value as Record<string,unknown>;return !r.invalidated&&!r.invalidated_at&&!r.deleted&&!r.deleted_at&&!r.discarded&&!r.discarded_at&&r.valid!==false;};
const latest=(rows:WrongResult[])=>[...new Map(rows.map(r=>[r.question_id,r])).values()];
const summarize=(rows:WrongResult[])=>{const count=rows.length,correct=rows.filter(r=>r.correctness==='richtig').length;return {count,correct,partial:rows.filter(r=>r.correctness==='teilweise').length,accuracy:count?100*correct/count:null};};
export function deriveDashboard(userId:string,inventory:InventoryQuestion[],snapshot:DashboardSnapshot,now=new Date(),config:DashboardConfig=defaults){
 const questions=[...new Map(inventory.map(q=>[q.question_id,q])).values()],ids=new Set(questions.map(q=>q.question_id));
 // Reuse formal-result eligibility, then exclude invalidated records and unavailable sources.
 const rows=wrongResults(userId,snapshot.attempts.filter(eligible),snapshot.testSessions.filter(eligible)).filter(r=>ids.has(r.question_id)&&Number.isFinite(Date.parse(r.timestamp))&&Date.parse(r.timestamp)<=now.getTime());
 const currentResults=latest(rows),summary=summarize(currentResults),total=questions.length,answered=summary.count,coverage=total?100*answered/total:0;
 // Replay in memory only: discarded/deleted sessions cannot leave stale wrong-stage counts.
 const wrongStates=reconcileWrongQuestions(userId,rows,snapshot.wrongQuestions.filter(s=>s.userId===userId&&ids.has(s.question_id)),now.toISOString());
 const wrongIds=wrongStates.filter(s=>s.active&&[1,2,3].includes(s.stage as number)).map(s=>s.question_id),stage1Ids=wrongStates.filter(s=>s.active&&s.stage===1).map(s=>s.question_id);
 const unsureIds=[...uncertaintyQuestionIds(snapshot.questionUncertainty.filter(s=>s.userId===userId&&ids.has(s.question_id)),wrongStates)];
 const modules=[...new Map(questions.map(q=>[q.module,q.moduleTitle])).entries()].map(([module,title])=>{const moduleIds=new Set(questions.filter(q=>q.module===module).map(q=>q.question_id)),s=summarize(currentResults.filter(r=>moduleIds.has(r.question_id)));return {module,title,total:moduleIds.size,answered:s.count,accuracy:s.accuracy,coverage:moduleIds.size?100*s.count/moduleIds.size:0};}).sort((a,b)=>(MODULE_ORDER[a.module]??100)-(MODULE_ORDER[b.module]??100)||a.title.localeCompare(b.title));
 const day=86400000,end=now.getTime(),start=end-7*day,previousStart=start-7*day;
 const current=summarize(latest(rows.filter(r=>Date.parse(r.timestamp)>=start))),previous=summarize(latest(rows.filter(r=>Date.parse(r.timestamp)>=previousStart&&Date.parse(r.timestamp)<start)));
 const delta=current.count>=config.minTrendQuestions&&previous.count>=config.minTrendQuestions?current.accuracy!-previous.accuracy!:null;
 const first=new Map<string,number>();for(const r of rows)if(!first.has(r.question_id))first.set(r.question_id,Date.parse(r.timestamp));
 const newCoverage=[...first.values()].filter(t=>t>=start).length;
 const lowest=[...modules].sort((a,b)=>a.coverage-b.coverage||(MODULE_ORDER[a.module]??100)-(MODULE_ORDER[b.module]??100))[0];
 const next=stage1Ids.length?{kind:'wrong' as const,count:stage1Ids.length}:unsureIds.length?{kind:'uncertainty' as const,count:unsureIds.length}:coverage>=config.highCoverage&&total?{kind:'test' as const,count:total}:{kind:'module' as const,module:lowest?.module,count:lowest?lowest.total-lowest.answered:0};
 const milestone=[...new Set([...config.milestones.filter(n=>n<=total),total])].sort((a,b)=>a-b).find(n=>n>answered)??null;
 const localDay=(date:Date)=>[date.getFullYear(),date.getMonth()+1,date.getDate()].join('-'),activeDays=new Set(rows.map(r=>localDay(new Date(r.timestamp))));
 const cursor=new Date(now);let streak=0;if(!activeDays.has(localDay(cursor)))cursor.setDate(cursor.getDate()-1);while(activeDays.has(localDay(cursor))){streak++;cursor.setDate(cursor.getDate()-1);}
 const weekStart=new Date(now);weekStart.setHours(0,0,0,0);weekStart.setDate(weekStart.getDate()-(weekStart.getDay()+6)%7);let weekActive=0;for(let d=new Date(weekStart);d<=now;d.setDate(d.getDate()+1))if(activeDays.has(localDay(d)))weekActive++;
 return {total,answered,correct:summary.correct,partial:summary.partial,accuracy:summary.accuracy,coverage,open:total-answered,unsure:unsureIds.length,wrong:wrongIds.length,mastered:wrongStates.filter(s=>s.stage==='mastered').length,stage1Ids,unsureIds,modules,current,previous,delta,newCoverage,next,milestone,streak,weekActive};
}
