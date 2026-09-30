import {useEffect,useState} from 'react';
import {useBankData} from './useBankData';
import {confirmClassification} from './review';
import {needsClassificationReview,type QuestionClassification} from './model';
import './ClassificationEditor.css';

interface EditorProps {questionId:string;expectedSourceRevision?:string;onBusy?:(busy:boolean)=>void}
interface Draft {topics:string[];primary:string;secondary:string[];original:string;sourceRevision:string;taxonomyVersion:string;overrides:QuestionClassification[]}
const labelsKey=(topics:string[],primary:string,secondary:string[])=>JSON.stringify([[...topics].sort(),primary,[...secondary].sort()]);

/** Mount on first expansion, then keep drafts alive even when the details are collapsed. */
export default function ClassificationEditor(props:EditorProps){
 const [mounted,setMounted]=useState(false);
 return <details className="question-note classification-editor" onToggle={event=>{if(event.currentTarget.open)setMounted(true)}}>
  <summary>Klassifikation bearbeiten</summary>
  {mounted&&<ClassificationForm key={props.questionId} {...props}/>}
 </details>;
}

export function ClassificationForm({questionId,expectedSourceRevision,onBusy}:EditorProps){
 const {data,error,save}=useBankData();const [draft,setDraft]=useState<Draft>();const [message,setMessage]=useState(''),[failure,setFailure]=useState('');
 const q=data?.inventory.find(item=>item.question_id===questionId),record=data?.classifications.find(item=>item.question_id===questionId);
 const makeDraft=():Draft=>{const topics=record?.knowledge_topic_ids??[],primary=record?.primary_question_type_id??'',secondary=record?.secondary_question_type_ids??[];return {topics,primary,secondary,original:labelsKey(topics,primary,secondary),sourceRevision:q?.question_source_revision??'',taxonomyVersion:data?.taxonomy.version??'',overrides:data?.overrides??[]}};
 const values=draft??makeDraft(),dirty=!!draft&&labelsKey(values.topics,values.primary,values.secondary)!==values.original;
 useEffect(()=>{onBusy?.(dirty);return()=>onBusy?.(false)},[dirty,onBusy]);
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty]);
 if(error)return <p role="alert">{error}</p>;
 if(!data)return <p role="status">Klassifikation wird geladen…</p>;
 if(!q)return <p>Diese Aufgabe gehört nicht mehr zum aktuellen Aufgabenbestand. Ihre frühere Klassifikation bleibt erhalten.</p>;
 const sourceMismatch=expectedSourceRevision!==undefined&&expectedSourceRevision!==q.question_source_revision;
 const changedDuringEdit=!!draft&&(draft.sourceRevision!==q.question_source_revision||draft.taxonomyVersion!==data.taxonomy.version);
 const blocked=sourceMismatch||changedDuringEdit;
 const nodes=data.taxonomy.nodes.filter(node=>node.active),knowledge=nodes.filter(node=>node.kind==='knowledge'),types=nodes.filter(node=>node.kind==='question_type');
 const label=(id:string)=>data.taxonomy.nodes.find(node=>node.id===id)?.label??id;
 const update=(change:Partial<Draft>)=>{setDraft({...values,...change});setMessage('');setFailure('')};
 const toggle=(ids:string[],id:string,checked:boolean)=>checked?[...new Set([...ids,id])]:ids.filter(value=>value!==id);
 const confirm=()=>{if(blocked)return;try{save([confirmClassification(q,values.topics,values.primary||null,values.secondary,data.taxonomy.version,new Date().toISOString())],values.overrides);setDraft(undefined);setFailure('');setMessage('Gespeichert · menschlich bestätigt · gesperrt')}catch(e){setFailure(e instanceof Error?e.message:'Klassifikation konnte nicht gespeichert werden.')}};
 return <div>
  <p>{record?.source==='human_confirmed'?'Menschlich bestätigt · gesperrt':record?.knowledge_topic_ids.length||record?.primary_question_type_id?'Automatisch vorgeschlagen':'Noch nicht klassifiziert'}</p>
  {sourceMismatch&&<p role="status">Dieses Training zeigt einen älteren Aufgabenstand. Klassifikationen können nur an der aktuellen Aufgabe bestätigt werden.</p>}
  {changedDuringEdit&&<p role="alert">Aufgabenquelle oder Taxonomie wurde während der Bearbeitung geändert. Bitte den gespeicherten Stand neu laden.</p>}
  {record?.review_reasons.includes('source_changed_since_confirmation')&&<p role="status">Die Aufgabenquelle wurde seit deiner Bestätigung geändert. Deine bisherige Zuordnung bleibt gesperrt. Prüfe die aktuelle Aufgabe vor einer neuen Bestätigung.</p>}
  {record&&needsClassificationReview(record)&&!record.review_reasons.includes('source_changed_since_confirmation')&&<p className="hint">Für diese Zuordnung ist eine Prüfung offen.</p>}
  <fieldset disabled={blocked}><legend>Wissensgebiete</legend>
   {knowledge.map(node=><label className="bank-check" key={node.id}><input type="checkbox" checked={values.topics.includes(node.id)} onChange={e=>update({topics:toggle(values.topics,node.id,e.target.checked)})}/>{node.label}</label>)}
   {values.topics.filter(id=>!knowledge.some(node=>node.id===id)).map(id=><label className="bank-check" key={id}><input type="checkbox" checked onChange={()=>update({topics:values.topics.filter(value=>value!==id)})}/>{label(id)} (inaktiv – bitte ändern)</label>)}
  </fieldset>
  <fieldset disabled={blocked}><legend>Aufgabentypen</legend>
   <label>Primärer Aufgabentyp<select aria-label="Primärer Aufgabentyp" value={values.primary} onChange={e=>update({primary:e.target.value,secondary:values.secondary.filter(id=>id!==e.target.value)})}>
    <option value="">Noch offen</option>
    {values.primary&&!types.some(node=>node.id===values.primary)&&<option value={values.primary}>{label(values.primary)} (inaktiv – bitte ändern)</option>}
    {types.map(node=><option key={node.id} value={node.id}>{node.label}</option>)}
   </select></label>
   <details><summary>Weitere Aufgabentypen</summary>
    {types.filter(node=>node.id!==values.primary).map(node=><label className="bank-check" key={node.id}><input type="checkbox" checked={values.secondary.includes(node.id)} onChange={e=>update({secondary:toggle(values.secondary,node.id,e.target.checked)})}/>{node.label}</label>)}
    {values.secondary.filter(id=>!types.some(node=>node.id===id)).map(id=><label className="bank-check" key={id}><input type="checkbox" checked onChange={()=>update({secondary:values.secondary.filter(value=>value!==id)})}/>{label(id)} (inaktiv – bitte ändern)</label>)}
   </details>
  </fieldset>
  <div className="learning-tools"><button className="primary" disabled={blocked} onClick={confirm}>Klassifikation speichern</button>{(dirty||failure||changedDuringEdit)&&<button className="outline" onClick={()=>{setDraft(undefined);setFailure('');setMessage('Gespeicherter Stand geladen.')}}>Gespeicherten Stand neu laden</button>}</div>
  <p className="save-status" role="status">{dirty?'Nicht gespeichert':message}</p>{failure&&<p role="alert">{failure}</p>}
 </div>;
}
