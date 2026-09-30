import {validWrongQuestionState} from '../learning/wrongQuestions';
import {validModuleProgress,validModuleRun} from '../learning/moduleProgress';
import {validQuestionNote} from '../learning/questionNotes';
import {validTestSession,stringMap} from './sessionValidation';
import {validAttempt} from '../learning/model';
import {validReview} from '../segmented/types';
import {validAnswerReview} from '../segmented/answers';
import {ID_FIELDS,PERSONAL_STORES} from './localTypes';
import type {EntityType,SyncEnvelope} from './protocol';
export function validateEntity(entity:EntityType,id:string,userId:string,value:unknown):asserts value is Record<string,unknown>{
 if(!PERSONAL_STORES.includes(entity)||!value||typeof value!=='object'||Array.isArray(value))throw Error('Ungültiger synchronisierter Datensatz.');
 const v=value as Record<string,unknown>;
 if(v.userId!==userId||v[ID_FIELDS[entity]]!==id||!id)throw Error('Datensatz gehört zu einem anderen Konto.');
 if(entity==='wrongQuestions'&&!validWrongQuestionState(v))throw Error('Ungültige Fehlerfrage.');
 const object=(x:unknown)=>!!x&&typeof x==='object'&&!Array.isArray(x);
 if(entity==='attempts'&&!validAttempt(v as never)||entity==='reviews'&&!validReview(v)||entity==='answerReviews'&&!validAnswerReview(v))throw Error('Ungültiges Datenschema.');
 if(entity==='records'&&(!object(v.fields)||v.schema_version!==1)||entity==='learningSessions'&&(!stringMap(v.draft)||typeof v.revealed!=='boolean'))throw Error('Ungültiges Datenschema.');
 if(entity==='moduleProgress'&&!validModuleProgress(v)||entity==='moduleRuns'&&!validModuleRun(v))throw Error('Ungültige Lernrunde.');
 if((entity==='attempts'||entity==='learningSessions')&&v.progress_run_id!==undefined&&(typeof v.progress_run_id!=='string'||!v.progress_run_id||!Number.isSafeInteger(v.progress_generation)||(v.progress_generation as number)<1))throw Error('Ungültige Rundenzuordnung.');
 if(entity==='questionNotes'&&!validQuestionNote(v))throw Error('Ungültige Frage-Notiz.');
 if(entity==='testSessions'&&!validTestSession(v))throw Error('Ungültige Prüfungssitzung.');
}
export function validateEnvelope(userId:string,r:SyncEnvelope){if(!r||!PERSONAL_STORES.includes(r.entity)||!r.id||!Number.isInteger(r.revision)||r.revision<1||typeof r.deleted!=='boolean')throw Error('Ungültige Synchronisierungsantwort.');if(!r.deleted)validateEntity(r.entity,r.id,userId,r.value);else if(r.value!==null)throw Error('Ungültige Löschmarkierung.');}

export function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value);}
