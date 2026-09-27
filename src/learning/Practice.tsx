import {useRef,useState} from 'react';
import {asset} from '../segmented/types';
import type {OfficialAnswer} from '../segmented/answers';
import {checkNumeric,combineAssessments,type Attempt,type Correctness,type LearningSession,type USolution} from './model';

export default function Practice({questionId,number,answer,u,session,history,onSession,onAttempt,onAnnotate,onBusy}:{
 questionId:string;number:string;answer?:OfficialAnswer;u?:USolution;session?:LearningSession;history:Attempt[];
 onSession:(session:LearningSession)=>Promise<void>;onAttempt:(attempt:Attempt,session:LearningSession)=>Promise<void>;
 onAnnotate:(id:string,values:Pick<Attempt,'note'|'error_reason'|'unsure'|'confidence'>)=>Promise<void>;onBusy:(busy:boolean)=>void;
}) {
 const [draft,setDraft]=useState<Record<string,string>>(session?.draft??{});
 const [revealed,setRevealed]=useState(session?.revealed??false);
 const [attemptId,setAttemptId]=useState(session?.attempt_id);
 const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 const pending=useRef<Promise<void>>(Promise.resolve());const guard=useRef(false);const pendingCount=useRef(0);
 const attempt=history.find(a=>a.attempt_id===attemptId);
 const persist=(next:Record<string,string>,show=revealed,id=attemptId)=>{
  setDraft(next);setMessage('Speichert…');pendingCount.current++;onBusy(true);
  const snapshot={userId:'local',question_id:questionId,draft:next,revealed:show,attempt_id:id};
  pending.current=pending.current.catch(()=>{}).then(()=>onSession(snapshot));
  void pending.current.then(()=>{if(pendingCount.current===1){setMessage('Entwurf gespeichert');setError('');}}).catch(()=>setError('Speichern fehlgeschlagen. Bitte erneut versuchen.')).finally(()=>{pendingCount.current--;if(!pendingCount.current&&!guard.current)onBusy(false);});
 };
 const update=(key:string,value:string)=>persist({...draft,[key]:value});
 const act=async(action:()=>Promise<void>)=>{
  if(guard.current)return;guard.current=true;setSaving(true);onBusy(true);setError('');
  try{await pending.current;await action();}catch{setError('Nicht gespeichert. Deine Eingaben bleiben sichtbar. Bitte erneut versuchen.');}
  finally{guard.current=false;setSaving(false);onBusy(pendingCount.current>0);}
 };
 const submit=()=>void act(async()=>{
  const value=Number(draft.choice);if(!u&&(!Number.isInteger(value)||value<1||value>5))return;
  const subparts=u?.subparts.map(p=>({id:p.id,user_answer:draft[p.id]??'',unit:p.numeric?.unit,
   correctness:draft['assessment:'+p.id] as Correctness,numeric_suggestion:p.numeric?checkNumeric(draft[p.id]??'',p.numeric.unit,p.numeric):undefined,self_assessed:true as const,auto_scored:false as const}))??[];
  const key=answer?.official_answer_status==='auto_ready'||(answer?.official_answer_status as string)==='confirmed'?answer?.official_answer??null:null;
  const correctness=u?combineAssessments(subparts.map(p=>p.correctness??null)):key===null?null:value===key?'richtig':'falsch';
  if(u&&correctness===null)return;
  const result:Attempt={attempt_id:crypto.randomUUID(),userId:'local',question_id:questionId,timestamp:new Date().toISOString(),
   user_answer:u?Object.fromEntries(u.subparts.map(p=>[p.id,draft[p.id]??''])):{choice:value},correctness,partial_status:correctness==='teilweise',
   unsure:draft.unsure==='true',confidence:draft.unsure==='true'?'unsure':'sure',hints_used:draft.hint==='true'?['general_strategy']:[],
   error_reason:draft.error_reason??'',note:draft.note??'',self_assessed:!!u,auto_scored:!u&&key!==null,subparts,
   official_answer_snapshot:u?undefined:key,source_revision:u?.extractor_revision??answer?.parser_revision};
  await onAttempt(result,{userId:'local',question_id:questionId,draft,revealed:true,attempt_id:result.attempt_id});
  setAttemptId(result.attempt_id);setRevealed(true);setMessage('Antwort und Ergebnis gespeichert');
 });
 const reveal=()=>void act(async()=>{await onSession({userId:'local',question_id:questionId,draft,revealed:true});setRevealed(true);setMessage('Lösung geöffnet · Deine Bewertung fehlt noch');});
 const reset=()=>void act(async()=>{await onSession({userId:'local',question_id:questionId,draft:{},revealed:false});setDraft({});setRevealed(false);setAttemptId(undefined);setMessage('Neuer Versuch. Frühere Ergebnisse bleiben erhalten.');});
 return <section className="practice" aria-label="Antwort bearbeiten">
  <div className="reader-head"><h3>Deine Antwort</h3><span className="practice-label">Study Mode</span></div>
  {!u?<><fieldset className="choice-options" disabled={saving||!!attempt}><legend>Wähle eine Antwort</legend>{[1,2,3,4,5].map(n=><label key={n} className={draft.choice===String(n)?'selected':''}><input type="radio" name={'choice-'+questionId} value={n} checked={draft.choice===String(n)} onChange={()=>update('choice',String(n))}/>{n}</label>)}</fieldset>
   {!attempt&&<button className="primary" disabled={saving||!draft.choice} onClick={submit}>Antwort abgeben</button>}</>:
   <div className="subparts">{u.subparts.map(p=><fieldset key={p.id} disabled={saving||revealed}><legend>{p.label}</legend>
    {p.type==='numeric'?<label>Wert <input aria-label={`${number} Teil ${p.id}`} inputMode="decimal" value={draft[p.id]??''} onChange={e=>update(p.id,e.target.value)}/> <span>{p.numeric?.unit}</span></label>:
    <><textarea aria-label={`${number} Teil ${p.id}`} rows={3} value={draft[p.id]??''} onChange={e=>update(p.id,e.target.value)} placeholder={p.type==='drawing'?'Zeichnung auf Papier erstellen; hier Vorgehen oder Ergänzungen notieren.':'Deine Antwort oder Rechenweg…'}/>
     {p.type==='drawing'&&<button className="outline" onClick={()=>update(p.id,(draft[p.id]??'')+' Auf Papier gezeichnet.')}>Auf Papier gezeichnet</button>}</>}
   </fieldset>)}</div>}
  {!revealed&&<div className="learning-tools"><button className="outline" disabled={saving} onClick={()=>update('hint','true')}>Hinweis</button>{draft.hint==='true'&&<p>Lies die gesuchte Größe und alle Bedingungen noch einmal. Prüfe Einheiten und vergleiche mit der Originalzeichnung.</p>}</div>}
  <details open={draft.unsure==='true'}><summary>Unsicher</summary><label><input type="checkbox" disabled={saving} checked={draft.unsure==='true'} onChange={e=>update('unsure',String(e.target.checked))}/> Bei dieser Antwort bin ich unsicher</label></details>
  {u&&!revealed&&<button className="primary reveal-button" disabled={saving||!u.subparts.some(p=>draft[p.id]?.trim())} onClick={reveal}>Lösung anzeigen</button>}
  {revealed&&<div className="learning-result">
   {attempt&&<div className={`result-banner ${attempt.correctness??'pending'}`} role="status"><strong>{attempt.correctness==='richtig'?'Richtig':attempt.correctness==='falsch'?'Falsch':attempt.correctness==='teilweise'?'Teilweise richtig':'Bewertung offen'}</strong><span>{u?'Deine abschließende Selbstbewertung':'Deine Antwort: '+attempt.user_answer.choice+' · Offizielle Antwort: '+(attempt.official_answer_snapshot??'noch nicht eindeutig')}</span></div>}
   {u?<><h3>Offizielle Lösung · {number}</h3><img className="u-solution-image" src={asset(u.cropped_solution_image)} alt={`Offizielle Lösung ${number}`}/><div className="source-links">{u.regions.map((r,i)=><a key={i} href={asset(u.solution_source_pdf)+`#page=${r.source_page}`} target="_blank" rel="noreferrer">Lösung · PDF-Seite {r.source_page} ↗</a>)}</div>
    <p className="hint">Vergleiche Inhalt und Rechenweg selbst. Eine numerische Prüfung ist eine Lernhilfe; du entscheidest die abschließende Bewertung jedes Teilauftrags. KI-Bewertung ist in dieser Version nicht aktiv.</p>
    {u.subparts.map(p=><div className="part-assessment" key={p.id}><strong>{p.label}</strong>
     {p.numeric&&<p data-testid="numeric-result">Numerische Prüfung: {checkNumeric(draft[p.id]??'',p.numeric.unit,p.numeric)==='richtig'?'Richtig':checkNumeric(draft[p.id]??'',p.numeric.unit,p.numeric)==='falsch'?'Falsch':'Keine gültige Zahl'} · Offiziell {p.numeric.value} {p.numeric.unit}. {p.numeric.tolerance_policy}</p>}
     <label>Deine Bewertung <select aria-label={`${number} Bewertung ${p.id}`} disabled={saving||!!attempt} value={draft['assessment:'+p.id]??''} onChange={e=>update('assessment:'+p.id,e.target.value)}><option value="">Bitte selbst bewerten</option><option value="richtig">richtig</option><option value="teilweise">teilweise richtig</option><option value="falsch">falsch</option></select></label></div>)}
    {!attempt&&<button className="primary" disabled={saving||u.subparts.some(p=>!draft['assessment:'+p.id])} onClick={submit}>Bewertung speichern</button>}</>:
    answer&&<details><summary>Offizielle Antwortquelle</summary><img className="mc-source" src={asset(answer.source_crop)} alt={`Offizielle Antwortquelle Q${number}`}/><a href={asset(answer.source_pdf)+`#page=${answer.solution_source_page}`} target="_blank" rel="noreferrer">Original-Antwortseite ↗</a></details>}
   <details><summary>Erklärung</summary><p>{u?'Die Original-Lösung zeigt den offiziellen Lösungsweg.':'Der offizielle Schlüssel kennzeichnet die richtige Option. Eine fachlich geprüfte Erklärung ist noch nicht hinterlegt.'}</p><p>Ergänze deine eigene Erklärung in der Notiz.</p></details>
   <details><summary>Warum falsch?</summary><label>Fehlerursache<textarea aria-label="Fehlerursache" rows={2} value={draft.error_reason??''} disabled={saving} onChange={e=>update('error_reason',e.target.value)} placeholder="Was habe ich übersehen?"/></label></details>
  </div>}
  <details><summary>Notiz</summary><textarea aria-label="Lernnotiz" rows={3} disabled={saving} value={draft.note??''} onChange={e=>update('note',e.target.value)} placeholder="Eigener Lösungsweg oder Erinnerung…"/></details>
  {attempt&&<div className="learning-tools"><button className="outline" disabled={saving} onClick={()=>void act(async()=>{await onAnnotate(attempt.attempt_id,{note:draft.note??'',error_reason:draft.error_reason??'',unsure:draft.unsure==='true',confidence:draft.unsure==='true'?'unsure':'sure'});setMessage('Reflexion gespeichert');})}>Reflexion speichern</button><button className="outline" disabled={saving} onClick={reset}>Neuer Versuch</button></div>}
  {!attempt&&revealed&&u&&<button className="outline" disabled={saving} onClick={reset}>Neu beantworten</button>}
  {error&&<p role="alert">{error}</p>}<p className="save-status" role="status">{message}</p>
  {history.length>0&&<details><summary>Deine Versuche ({history.length})</summary>{[...history].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).map(a=><p key={a.attempt_id}>{new Date(a.timestamp).toLocaleString('de-DE')} · {a.correctness??'offen'} · {a.self_assessed?'selbst bewertet':'automatisch verglichen'}{a.unsure?' · unsicher':''}</p>)}</details>}
 </section>;
}
