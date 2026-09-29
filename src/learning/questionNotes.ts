import type {Attempt,LearningSession} from './model';
export interface QuestionNote {userId:string;question_id:string;text:string;created_at:string;updated_at:string;revision:number}
export function validQuestionNote(value:unknown):value is QuestionNote {
 if(!value||typeof value!=='object')return false;const n=value as QuestionNote;
 return typeof n.userId==='string'&&!!n.userId.trim()&&typeof n.question_id==='string'&&!!n.question_id.trim()&&typeof n.text==='string'&&Number.isSafeInteger(n.revision)&&n.revision>0&&Number.isFinite(Date.parse(n.created_at))&&Number.isFinite(Date.parse(n.updated_at));
}
/** Session draft wins; otherwise latest nonempty attempt. Existing notes (even empty) are never replaced. */
export function legacyQuestionNotes(userId:string,existing:QuestionNote[],attempts:Attempt[],sessions:LearningSession[],stamp:string,deletedIds:string[]=[]):QuestionNote[]{
 const protectedIds=new Set([...existing.map(n=>n.question_id),...deletedIds]);const texts=new Map<string,string>();
 for(const a of [...attempts].filter(a=>a.userId===userId).sort((a,b)=>(a.timestamp??'').localeCompare(b.timestamp??'')||a.attempt_id.localeCompare(b.attempt_id))){if(typeof a.note==='string'&&a.note.trim())texts.set(a.question_id,a.note);}
 for(const s of sessions.filter(s=>s.userId===userId)){if(typeof s.draft?.note==='string'&&s.draft.note.trim())texts.set(s.question_id,s.draft.note);}
 return [...texts].filter(([id])=>!protectedIds.has(id)).map(([question_id,text])=>({userId,question_id,text,created_at:stamp,updated_at:stamp,revision:1}));
}
