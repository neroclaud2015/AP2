import {isEligibleForAnalysis,type TestSession} from '../exams/model';
import {validAttempt,type Attempt} from './model';
import type {WrongQuestionState} from './wrongQuestions';
export interface QuestionUncertaintyState {userId:string;question_id:string;active:boolean;entered_at:string|null;updated_at:string;revision:number;last_result_id?:string}
export function validQuestionUncertainty(value:unknown):value is QuestionUncertaintyState {
 if(!value||typeof value!=='object')return false;const v=value as QuestionUncertaintyState;
 const stamp=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x));
 return typeof v.userId==='string'&&!!v.userId.trim()&&typeof v.question_id==='string'&&!!v.question_id.trim()&&typeof v.active==='boolean'&&(v.entered_at===null||stamp(v.entered_at))&&(!v.active||v.entered_at!==null)&&stamp(v.updated_at)&&Number.isSafeInteger(v.revision)&&v.revision>0&&(v.last_result_id===undefined||typeof v.last_result_id==='string'&&!!v.last_result_id.trim());
}
/** Explicit state always wins, including an explicit inactive state. */
export function legacyQuestionUncertainty(userId:string,existing:QuestionUncertaintyState[],attempts:Attempt[],tests:TestSession[],now:string):QuestionUncertaintyState[]{
 const known=new Set(existing.map(s=>s.question_id)),latest=new Map<string,Attempt>();
 for(const a of attempts.filter(a=>a&&validAttempt(a)&&typeof a.attempt_id==='string').sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)||a.attempt_id.localeCompare(b.attempt_id))){
  if(a.userId!==userId||known.has(a.question_id)||!validAttempt(a)||!['richtig','teilweise','falsch'].includes(a.correctness??'')||(!a.auto_scored&&!a.self_assessed)||a.self_assessed&&(!a.subparts.length||a.subparts.some(p=>!['richtig','teilweise','falsch'].includes(p.correctness))))continue;
  const raw=a as unknown as Record<string,unknown>,links=['test_id','test_session_id','exam_session_id'].map(k=>raw[k]).filter(v=>v!==undefined&&v!==null);
  if(links.some(id=>!tests.some(t=>t.userId===userId&&t.test_id===id&&isEligibleForAnalysis(t)&&t.question_ids.includes(a.question_id)&&['richtig','teilweise','falsch'].includes(t.result?.byQuestion[a.question_id]??''))))continue;
  latest.set(a.question_id,a);
 }
 return [...latest.values()].map(a=>({userId,question_id:a.question_id,active:a.unsure,entered_at:a.unsure?a.timestamp:null,updated_at:now,revision:1,last_result_id:a.attempt_id}));
}
export function uncertaintyQuestionIds(states:QuestionUncertaintyState[],wrong:WrongQuestionState[]):Set<string>{
 const blocked=new Set(wrong.filter(w=>w.active&&[1,2,3].includes(w.stage as number)).map(w=>w.question_id));
 return new Set(states.filter(s=>s.active&&!blocked.has(s.question_id)).map(s=>s.question_id));
}
