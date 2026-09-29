import {validQuestionNote} from '../learning/questionNotes';
import {SYNC_ENTITIES,type EntityType,type PushMutation,type SyncEnvelope,type SyncValue} from './protocol';
export const ID_FIELDS:Record<EntityType,string>={records:'questionId',reviews:'question_id',answerReviews:'question_id',attempts:'attempt_id',learningSessions:'question_id',testSessions:'test_id',settings:'id',questionNotes:'question_id'};
export const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v)??'undefined';
export function validateMutation(m:PushMutation,uid:string){
 if(!SYNC_ENTITIES.includes(m.entity)||typeof m.id!=='string'||!m.id.length||m.id.length>200||typeof m.mutationId!=='string'||!m.mutationId.length||m.mutationId.length>200||!Number.isSafeInteger(m.baseRevision)||m.baseRevision<0||typeof m.deleted!=='boolean'||new TextEncoder().encode(JSON.stringify(m)).length>200_000)throw Error('Ungültiger Sync-Datensatz.');
 if(m.deleted){if(m.value!==null)throw Error('Ungültiger Löschmarker.');}
 else if(!m.value||Array.isArray(m.value)||m.value.userId!==uid||m.value[ID_FIELDS[m.entity]]!==m.id)throw Error('Datensatz gehört nicht zu diesem Konto oder dieser Identität.');
 if(!m.deleted&&m.entity==='questionNotes'&&!validQuestionNote(m.value))throw Error('Ungültige Notiz.');
}
const without=(v:Record<string,unknown>,keys:string[])=>Object.fromEntries(Object.entries(v).filter(([k])=>!keys.includes(k)));
export function immutableCompatible(entity:EntityType,old:Record<string,unknown>,next:Record<string,unknown>):boolean{
 if(entity==='attempts')return canonical(without(old,['note','error_reason','unsure','confidence','updated_at','revision','sync_state','device_id']))===canonical(without(next,['note','error_reason','unsure','confidence','updated_at','revision','sync_state','device_id']));
 if(entity==='testSessions'){
  for(const key of ['test_id','userId','exam_session_id','test_type','exam','module','mode','seed','sourceExams','question_ids','question_models','source_mix','official_answers','started_at'])if(canonical(old[key])!==canonical(next[key]))return false;
  if(old.completed_at||old.status==='completed'||old.discarded_from==='completed'||old.previous_status==='completed')return canonical(without(old,['status','previous_status','discarded_from','discarded_at','deleted_at','revision','updated_at','sync_state','device_id','current_question','note','notes','reflection','subpart_assessments','result']))===canonical(without(next,['status','previous_status','discarded_from','discarded_at','deleted_at','revision','updated_at','sync_state','device_id','current_question','note','notes','reflection','subpart_assessments','result']));
 }
 return true;
}
export function planMutation(m:PushMutation,current:SyncEnvelope|undefined,history:SyncValue):{reason?:'revision_mismatch'|'immutable_history'}{
 if(m.baseRevision!==(current?.revision??0))return{reason:'revision_mismatch'};
 if(!m.deleted&&history&&m.value&&!immutableCompatible(m.entity,history,m.value))return{reason:'immutable_history'};
 return {};
}
