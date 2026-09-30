import {fullPdfUrl} from './fullPdf';
import {useAppServices} from '../services/context';
import { useState } from 'react';
import { asset } from './types';
import { effectiveAnswer, type AnswerReview, type OfficialAnswer } from './answers';

export default function AnswerPanel({answer,review,overlay,disabled,onSave,onBusy}: {
  answer:OfficialAnswer; review?:AnswerReview; overlay:string; disabled:boolean;
  onSave:(review:AnswerReview)=>Promise<void>; onBusy:(busy:boolean)=>void;
}) {
 const {user}=useAppServices();
  const [source,setSource]=useState(false);const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState('');const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const current=effectiveAnswer(answer,review);
  const save=async(value:number,corrected:boolean)=>{
    if(!Number.isInteger(value)||value<1||value>5)return;
    setSaving(true);onBusy(true);setError('');
    try {await onSave({userId:user.id,question_id:answer.question_id,official_answer:value,
      official_answer_status:'confirmed',user_corrected:corrected||!!review?.user_corrected,locked:true,
      parser_revision:answer.parser_revision,updated_at:new Date().toISOString()});setEditing(false);onBusy(false);}
    catch{setError('Antwort konnte nicht gespeichert werden. Bitte erneut versuchen.');onBusy(editing);}
    finally{setSaving(false);}
  };
  return <section className="answer official-answer" aria-label="Offizielle Auswahlantwort">
    <div className="reader-head"><strong>OFFICIAL ANSWER</strong><span className={`badge ${current.official_answer_status}`}>{current.official_answer_status==='confirmed'?'Confirmed · gesperrt':current.official_answer_status==='auto_ready'?'Auto detected':'Needs Review'}</span></div>
    <p className="answer-value">Official answer: <strong data-testid="official-answer">{current.official_answer??'—'}</strong></p>
    <p className="hint">{review?'Deine bestätigte Antwort ist vor automatischen Änderungen geschützt.':`Confidence: ${answer.confidence>=.95?'High':'Needs Review'} · Geometrische Erkennung der offiziellen Kreismarkierung.`}</p>
    {review&&<p>Automatisch erkannt: {answer.official_answer??'nicht eindeutig'} · {review.user_corrected?'Von dir bearbeitet':'Von dir bestätigt'}</p>}
    {answer.review_reasons.length>0&&!review&&<p className="review-hint">Keine eindeutige automatische Antwort. Bitte die Quelle prüfen und eine Zahl wählen.</p>}
    <div className="question-actions"><button className="outline" onClick={()=>setSource(s=>!s)}>{source?'Antwortquelle ausblenden':'Offizielle Antwortquelle ansehen'}</button>
      <button className="outline" disabled={disabled||editing||saving} onClick={()=>{setDraft(String(current.official_answer??''));setEditing(true);onBusy(true);}}>Antwort ändern</button>
      <button className="outline" disabled={disabled||editing||saving||current.official_answer===null} onClick={()=>void save(current.official_answer!,false)}>Antwort bestätigen</button></div>
    {editing&&<div className="answer-edit"><label>Richtige Antwort <select aria-label="Richtige Antwort" value={draft} disabled={saving} onChange={e=>setDraft(e.target.value)}><option value="">Auswählen</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <button className="primary" disabled={saving||!draft} onClick={()=>void save(Number(draft),true)}>Antwort speichern</button>
      <button className="outline" disabled={saving} onClick={()=>{setEditing(false);onBusy(false);setError('');}}>Antwort abbrechen</button></div>}
    {error&&<p role="alert">{error}</p>}
    {source&&<div className="answer-source"><p>Originalquelle Q{answer.question_number} · Lösung PDF-Seite {answer.solution_source_page}. Von oben nach unten: 1, 2, 3, 4, 5.</p>
      <img src={asset(answer.source_crop)} alt={`Offizielle Antwortquelle Q${answer.question_number}: Nummer und fünf Positionen`} />
      <div className="question-actions"><a href={fullPdfUrl({source:answer.source_pdf,page:answer.solution_source_page})??(answer.source_pdf_available===false?asset(answer.source_crop):asset(answer.source_pdf)+`#page=${answer.solution_source_page}`)} target="_blank" rel="noreferrer">{!fullPdfUrl({source:answer.source_pdf})&&answer.source_pdf_available===false?'Original-Antwortausschnitt':'Original-Antwortseite'} ↗</a><a href={asset(overlay)} target="_blank" rel="noreferrer">Gesamte Tabelle mit Erkennung ↗</a></div></div>}
  </section>;
}
