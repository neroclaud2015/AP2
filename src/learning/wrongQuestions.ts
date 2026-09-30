import {isEligibleForAnalysis,type TestSession} from '../exams/model';
import type {Attempt,Correctness} from './model';
export interface WrongQuestionState {userId:string;question_id:string;active:boolean;entered_at:string|null;last_wrong_at:string|null;wrong_count:number;consecutive_correct:number;dismissed_at:string|null;dismissed_result_ids:string[];updated_at:string;revision:number}
export interface WrongResult {id:string;question_id:string;timestamp:string;correctness:Correctness}
export function wrongResults(userId:string,attempts:Attempt[],tests:TestSession[]):WrongResult[]{
 const results=new Map<string,WrongResult>();
 for(const a of attempts){const linked=a as unknown as Record<string,unknown>;if(a.userId!==userId||['test_id','test_session_id','exam_session_id'].some(k=>linked[k]!==undefined&&linked[k]!==null)||!['richtig','teilweise','falsch'].includes(a.correctness??'')||(!a.auto_scored&&!a.self_assessed)||a.self_assessed&&(!Array.isArray(a.subparts)||!a.subparts.length||a.subparts.some(p=>!['richtig','teilweise','falsch'].includes(p.correctness))))continue;const id='practice:'+a.attempt_id;results.set(id,{id,question_id:a.question_id,timestamp:a.timestamp,correctness:a.correctness as Correctness});}
 for(const t of tests){if(t.userId!==userId||!isEligibleForAnalysis(t)||!t.completed_at)continue;for(const [question_id,correctness] of Object.entries(t.result?.byQuestion??{})){if(!['richtig','teilweise','falsch'].includes(correctness))continue;const id='test:'+t.test_id+':'+question_id;results.set(id,{id,question_id,timestamp:t.assessment_updated_at?.[question_id]??t.completed_at,correctness:correctness as Correctness});}}
 return [...results.values()].sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)||a.id.localeCompare(b.id));
}
export const resultKey=(r:WrongResult)=>r.id+':'+r.timestamp+':'+r.correctness;
export function reconcileWrongQuestions(userId:string,results:WrongResult[],previous:WrongQuestionState[],now:string):WrongQuestionState[]{
 const ids=new Set([...results.map(r=>r.question_id),...previous.map(s=>s.question_id)]);
 return [...ids].sort().flatMap(question_id=>{
 const old=previous.find(s=>s.question_id===question_id),rows=results.filter(r=>r.question_id===question_id),dismissed=new Set(old?.dismissed_result_ids??[]);
 let active=false,entered_at:string|null=null,last_wrong_at:string|null=null,wrong_count=0,consecutive_correct=0;
 for(const r of rows){if(r.correctness==='richtig'){consecutive_correct++;if(consecutive_correct>=2)active=false;}else{wrong_count++;last_wrong_at=r.timestamp;consecutive_correct=0;if(!dismissed.has(resultKey(r))){if(!active)entered_at=r.timestamp;active=true;}}}
 if(!wrong_count&&!old)return [];
 const value={userId,question_id,active,entered_at,last_wrong_at,wrong_count,consecutive_correct,dismissed_at:old?.dismissed_at??null,dismissed_result_ids:old?.dismissed_result_ids??[]};
 if(old&&Object.entries(value).every(([k,v])=>JSON.stringify(v)===JSON.stringify(old[k as keyof WrongQuestionState])))return [old];
 return [{...value,updated_at:now,revision:(old?.revision??0)+1}];
 });
}
export function validWrongQuestionState(value:unknown):value is WrongQuestionState {
 if(!value||typeof value!=='object')return false;const v=value as WrongQuestionState;
 const stamp=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x));
 return typeof v.userId==='string'&&!!v.userId.trim()&&typeof v.question_id==='string'&&!!v.question_id&&typeof v.active==='boolean'&&[v.entered_at,v.last_wrong_at,v.dismissed_at].every(x=>x===null||stamp(x))&&stamp(v.updated_at)&&Number.isSafeInteger(v.revision)&&v.revision>0&&[v.wrong_count,v.consecutive_correct].every(x=>Number.isSafeInteger(x)&&x>=0)&&Array.isArray(v.dismissed_result_ids)&&v.dismissed_result_ids.every(x=>typeof x==='string'&&!!x);
}
