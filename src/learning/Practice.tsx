import {fullPdfUrl} from '../segmented/fullPdf';
import OfficialCorrection from './OfficialCorrection';
import QuestionNoteEditor from './QuestionNoteEditor';
import ClassificationEditor from '../bank/ClassificationEditor';
import {useAppServices} from '../services/context';
import {useEffect,useRef,useState} from 'react';
import {asset} from '../segmented/types';
import type {OfficialAnswer} from '../segmented/answers';
import {checkNumeric,combineAssessments,type Attempt,type AttemptProvenance,type Correctness,type LearningSession,type USolution} from './model';

export default function Practice({provenance,classificationSourceRevision,questionId,number,answer,u,session,history,onSession,onAttempt,onDelete,onBusy}:{
 classificationSourceRevision?:string;
 provenance?:AttemptProvenance;questionId:string;number:string;answer?:OfficialAnswer;u?:USolution;session?:LearningSession;history:Attempt[];
 onSession:(session:LearningSession)=>Promise<void>;onAttempt:(attempt:Attempt,session:LearningSession)=>Promise<void>;
 onAnnotate:(id:string,values:Pick<Attempt,'note'|'error_reason'|'unsure'|'confidence'>)=>Promise<void>;onDelete:(id:string)=>Promise<void>;onBusy:(busy:boolean)=>void;
}) {
 const {user,repository}=useAppServices();
 const [deleteTarget,setDeleteTarget]=useState<Attempt>();
 const [practiceBusy,setPracticeBusy]=useState(false);const [noteBusy,setNoteBusy]=useState(false);const [classificationBusy,setClassificationBusy]=useState(false);
 useEffect(()=>{onBusy(practiceBusy||noteBusy||classificationBusy||!!deleteTarget);},[practiceBusy,noteBusy,classificationBusy,deleteTarget,onBusy]);
 const [draft,setDraft]=useState<Record<string,string>>(session?.draft??{});
 const [revealed,setRevealed]=useState(session?.revealed??false);
 const [attemptId,setAttemptId]=useState(session?.attempt_id);
 const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 const pending=useRef<Promise<void>>(Promise.resolve());const guard=useRef(false);const pendingCount=useRef(0);
 const attempt=history.find(a=>a.attempt_id===attemptId);
 const persist=(next:Record<string,string>,show=revealed,id=attemptId)=>{
  setDraft(next);setMessage('Speichert…');pendingCount.current++;setPracticeBusy(true);
  const snapshot={userId:user.id,question_id:questionId,draft:next,revealed:show,attempt_id:id};
  pending.current=pending.current.catch(()=>{}).then(()=>onSession(snapshot));
  void pending.current.then(()=>{if(pendingCount.current===1){setMessage('Entwurf gespeichert');setError('');}}).catch(()=>setError('Speichern fehlgeschlagen. Bitte erneut versuchen.')).finally(()=>{pendingCount.current--;if(!pendingCount.current&&!guard.current)setPracticeBusy(false);});
 };
 const update=(key:string,value:string)=>{
  const next={...draft,[key]:value};
  if(u?.subparts.some(p=>p.id===key)&&draft[key]!==value)delete next['assessment:'+key];
  persist(next);
 };
 const act=async(action:()=>Promise<void>)=>{
  if(guard.current)return;guard.current=true;setSaving(true);setPracticeBusy(true);setError('');
  try{await pending.current;await action();}catch(e){setError(e instanceof Error?e.message:'Nicht gespeichert. Deine Eingaben bleiben sichtbar. Bitte erneut versuchen.');}
  finally{guard.current=false;setSaving(false);setPracticeBusy(pendingCount.current>0);}
 };
 const hasUAnswer=!!u?.subparts.some(p=>draft[p.id]?.trim());
 const canAssess=hasUAnswer&&revealed;
 const canSubmit=u?canAssess&&u.subparts.every(p=>!!draft['assessment:'+p.id]):!!draft.choice;
 const submit=()=>void act(async()=>{
  if(attempt||!canSubmit)return;
  const value=Number(draft.choice);if(!u&&(!Number.isInteger(value)||value<1||value>5))return;
  const subparts=u?.subparts.map(p=>({id:p.id,user_answer:draft[p.id]??'',unit:p.numeric?.unit,
   correctness:draft['assessment:'+p.id] as Correctness,numeric_suggestion:p.numeric?checkNumeric(draft[p.id]??'',p.numeric.unit,p.numeric):undefined,self_assessed:true as const,auto_scored:false as const}))??[];
  const key=answer?.official_answer_status==='auto_ready'||(answer?.official_answer_status as string)==='confirmed'?answer?.official_answer??null:null;
  const correctness=u?combineAssessments(subparts.map(p=>p.correctness??null)):key===null?null:value===key?'richtig':'falsch';
  if(u&&correctness===null)return;
  const result:Attempt={...provenance,attempt_id:crypto.randomUUID(),userId:user.id,question_id:questionId,timestamp:new Date().toISOString(),
   user_answer:u?Object.fromEntries(u.subparts.map(p=>[p.id,draft[p.id]??''])):{choice:value},correctness,partial_status:correctness==='teilweise',
   unsure:draft.unsure==='true',confidence:draft.unsure==='true'?'unsure':'sure',hints_used:draft.hint==='true'?['general_strategy']:[],
   error_reason:'',note:(await repository.getQuestionNote(user.id,questionId))?.text??'',self_assessed:!!u,auto_scored:!u&&key!==null,subparts,
   official_answer_snapshot:u?undefined:key,source_revision:u?.extractor_revision??answer?.parser_revision};
  await onAttempt(result,{userId:user.id,question_id:questionId,draft,revealed:true,attempt_id:result.attempt_id});
  setAttemptId(result.attempt_id);setRevealed(true);setMessage('Antwort und Ergebnis gespeichert');
 });
 const reveal=()=>void act(async()=>{await onSession({userId:user.id,question_id:questionId,draft,revealed:true,attempt_id:attemptId});setRevealed(true);setMessage('Lösung geöffnet');});
 const reset=()=>void act(async()=>{await repository.getQuestionNote(user.id,questionId);await onSession({userId:user.id,question_id:questionId,draft:{},revealed:false});setDraft({});setRevealed(false);setAttemptId(undefined);setMessage('Neuer Versuch. Frühere Ergebnisse bleiben erhalten.');});
 return <section className="practice" aria-label="Antwort bearbeiten">
  <div className="reader-head"><h3>Deine Antwort</h3><span className="practice-label">Study Mode</span></div>
  {!u?<><fieldset className="choice-options" disabled={saving||!!attempt}><legend>Wähle eine Antwort</legend>{[1,2,3,4,5].map(n=><label key={n} className={draft.choice===String(n)?'selected':''}><input type="radio" name={'choice-'+questionId} value={n} checked={draft.choice===String(n)} onChange={()=>update('choice',String(n))}/>{n}</label>)}</fieldset>
   </>:
   <div className="subparts">{u.subparts.map(p=><fieldset key={p.id} disabled={saving||!!attempt}><legend>{p.label}</legend>
    {p.type==='numeric'?<label>Wert <input aria-label={`${number} Teil ${p.id}`} inputMode="decimal" value={draft[p.id]??''} onChange={e=>update(p.id,e.target.value)}/> <span>{p.numeric?.unit}</span></label>:
    <><textarea aria-label={`${number} Teil ${p.id}`} rows={3} value={draft[p.id]??''} onChange={e=>update(p.id,e.target.value)} placeholder={p.type==='drawing'?'Zeichnung auf Papier erstellen; hier Vorgehen oder Ergänzungen notieren.':'Deine Antwort oder Rechenweg…'}/>
     {p.type==='drawing'&&<button className="outline" onClick={()=>update(p.id,(draft[p.id]??'')+' Auf Papier gezeichnet.')}>Auf Papier gezeichnet</button>}</>}
   </fieldset>)}</div>}
  {!revealed&&<div className="learning-tools"><button className="outline" disabled={saving} onClick={()=>update('hint','true')}>Hinweis</button>{draft.hint==='true'&&<p>Lies die gesuchte Größe und alle Bedingungen noch einmal. Prüfe Einheiten und vergleiche mit der Originalzeichnung.</p>}</div>}
  <label className="practice-unsure"><input type="checkbox" disabled={saving||!!attempt} checked={draft.unsure==='true'} onChange={e=>update('unsure',String(e.target.checked))}/> Ich bin unsicher</label>
  <div className="practice-actions">
   <button className="primary" disabled={saving||!!attempt||!canSubmit} onClick={submit}>Antwort abgeben</button>
   <button className="outline reveal-button" disabled={saving} onClick={reveal}>Lösung anzeigen</button>
  </div>
  {u&&!attempt&&!revealed&&hasUAnswer&&<p className="hint">Öffne die Lösung und bewerte deine Antwort vor der Abgabe selbst.</p>}
  {revealed&&<div className="learning-result">
   {attempt&&<div className={`result-banner ${attempt.correctness??'pending'}`} role="status"><strong>{attempt.correctness==='richtig'?'Richtig':attempt.correctness==='falsch'?'Falsch':attempt.correctness==='teilweise'?'Teilweise richtig':'Bewertung offen'}</strong><span>{u?'Deine abschließende Selbstbewertung':'Deine Antwort: '+attempt.user_answer.choice+' · Offizielle Antwort: '+(attempt.official_answer_snapshot??'noch nicht eindeutig')}</span></div>}
   {u?<><OfficialCorrection questionId={questionId}/><h3>Offizielle Lösung · {number}</h3><img className="u-solution-image" src={asset(u.cropped_solution_image)} alt={`Offizielle Lösung ${number}`}/><div className="source-links">{u.regions.map((r,i)=><a key={i} href={fullPdfUrl({sha256:provenance?.solution_source_sha256,source:u.solution_source_pdf,page:r.source_page})??(u.solution_source_pdf_available===false?asset(u.cropped_solution_image):asset(u.solution_source_pdf)+`#page=${r.source_page}`)} target="_blank" rel="noreferrer">{!fullPdfUrl({sha256:provenance?.solution_source_sha256,source:u.solution_source_pdf})&&u.solution_source_pdf_available===false?'Lösungsausschnitt aus Seite':'Lösung · PDF-Seite'} {r.source_page} ↗</a>)}</div>
    <p className="hint">Vergleiche Inhalt und Rechenweg selbst. Eine numerische Prüfung ist eine Lernhilfe; du entscheidest die abschließende Bewertung jedes Teilauftrags. KI-Bewertung ist in dieser Version nicht aktiv.</p>
    {canAssess&&u.subparts.map(p=><div className="part-assessment" key={p.id}><strong>{p.label}</strong>
     {p.numeric&&<p data-testid="numeric-result">Numerische Prüfung: {checkNumeric(draft[p.id]??'',p.numeric.unit,p.numeric)==='richtig'?'Richtig':checkNumeric(draft[p.id]??'',p.numeric.unit,p.numeric)==='falsch'?'Falsch':'Keine gültige Zahl'} · Offiziell {p.numeric.value} {p.numeric.unit}. {p.numeric.tolerance_policy}</p>}
     <label>Deine Bewertung <select aria-label={`${number} Bewertung ${p.id}`} disabled={saving||!!attempt} value={draft['assessment:'+p.id]??''} onChange={e=>update('assessment:'+p.id,e.target.value)}><option value="">Bitte selbst bewerten</option><option value="richtig">richtig</option><option value="teilweise">teilweise richtig</option><option value="falsch">falsch</option></select></label></div>)}
    {canAssess&&!attempt&&<button className="primary" disabled={saving||!canSubmit} onClick={submit}>Bewertung speichern</button>}</>:
    answer&&<><h3>Offizielle Lösung</h3><p>Offizielle Antwort: {answer.official_answer_status==='auto_ready'||(answer.official_answer_status as string)==='confirmed'?answer.official_answer??'noch nicht eindeutig':'noch nicht eindeutig'}</p><details open><summary>Offizielle Antwortquelle</summary><img className="mc-source" src={asset(answer.source_crop)} alt={`Offizielle Antwortquelle Q${number}`}/><a href={fullPdfUrl({sha256:provenance?.solution_source_sha256,source:answer.source_pdf,page:answer.solution_source_page})??(answer.source_pdf_available===false?asset(answer.source_crop):asset(answer.source_pdf)+`#page=${answer.solution_source_page}`)} target="_blank" rel="noreferrer">{!fullPdfUrl({sha256:provenance?.solution_source_sha256,source:answer.source_pdf})&&answer.source_pdf_available===false?'Original-Antwortausschnitt':'Original-Antwortseite'} ↗</a></details></>}
   <details><summary>Erklärung</summary><p>{u?'Die Original-Lösung zeigt den offiziellen Lösungsweg.':'Der offizielle Schlüssel kennzeichnet die richtige Option. Eine fachlich geprüfte Erklärung ist noch nicht hinterlegt.'}</p><p>Ergänze deine eigene Erklärung in der Notiz.</p></details>
  </div>}
  <QuestionNoteEditor key={user.id+':'+questionId} questionId={questionId} onBusy={setNoteBusy}/>
  <ClassificationEditor key={user.id+':classification:'+questionId} questionId={questionId} expectedSourceRevision={classificationSourceRevision} onBusy={setClassificationBusy}/>
  {attempt&&<div className="learning-tools"><button className="outline" disabled={saving} onClick={reset}>Aufgabe erneut versuchen</button></div>}
  {!attempt&&revealed&&<button className="outline" disabled={saving} onClick={reset}>Aufgabe erneut versuchen</button>}
  {error&&<p role="alert">{error}</p>}<p className="save-status" role="status">{message}</p>
  {history.length>0&&<details className="attempt-history"><summary>Deine Versuche ({history.length})</summary>{[...history].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).map(a=><article key={a.attempt_id} data-attempt-id={a.attempt_id}><span>{new Date(a.timestamp).toLocaleString('de-DE')} · {a.correctness??'offen'} · {a.self_assessed?'selbst bewertet':'automatisch verglichen'}{a.unsure?' · unsicher':''}{a.progress_generation?` · Runde ${a.progress_generation}`:''}</span><button className="outline destructive-outline" disabled={saving||noteBusy} onClick={()=>setDeleteTarget(a)}>Versuch löschen</button></article>)}</details>}
  {deleteTarget&&<section className="session-confirm" role="alertdialog" aria-label="Lernversuch löschen bestätigen"><h3>Diesen Lernversuch dauerhaft löschen?</h3><p>{new Date(deleteTarget.timestamp).toLocaleString('de-DE')} · {deleteTarget.correctness??'offen'}. Deine Notiz, andere Versuche und Prüfungen bleiben erhalten.</p><button className="primary" disabled={saving} onClick={()=>void act(async()=>{await onDelete(deleteTarget.attempt_id);setDeleteTarget(undefined);})}>Lernversuch dauerhaft löschen</button><button className="outline" disabled={saving} onClick={()=>setDeleteTarget(undefined)}>Abbrechen</button></section>}

 </section>;
}
