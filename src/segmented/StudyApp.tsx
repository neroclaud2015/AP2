import type {USolution} from '../learning/model';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import AnswerPanel from './AnswerPanel';
import { effectiveAnswer, validAnswerReview, type AnswerKey, type AnswerReview, type OfficialAnswer } from './answers';
import LegacyArchive from '../LegacyArchive';
import { IndexedDBProgressRepository } from '../storage/storage';
import { CropImage } from './CropImage';
import ReviewEditor from './ReviewEditor';
import { asset, effectiveQuestion, validReview, type QuestionReview, type SegmentedExam } from './types';
import './study.css';

const repository = new IndexedDBProgressRepository();
const reason = (value:string) => ({non_rectangular_layout:'L-förmiger Ausschnitt: Anordnung prüfen',single_ocr_label_evidence:'Aufgabennummer nur per OCR erkannt',uncertain_question_number:'Aufgabennummer unsicher'}[value] ?? value);
export default function StudyApp({onBusy,onHome,uSolutions=[]}:{onBusy?:(busy:boolean)=>void;onHome?:()=>void;uSolutions?:USolution[]}={}) {
  const [exam,setExam]=useState<SegmentedExam>(); const [reviews,setReviews]=useState<Record<string,QuestionReview>>({});
  const [answerKey,setAnswerKey]=useState<AnswerKey>(); const [answerReviews,setAnswerReviews]=useState<Record<string,AnswerReview>>({});
  const [answerEditing,setAnswerEditing]=useState(false); const [importing,setImporting]=useState(false);
  const [error,setError]=useState(''); const [message,setMessage]=useState('');
  const [selected,setSelected]=useState(''); const [tab,setTab]=useState<'study'|'review'|'debug'>('study');
  const [editing,setEditing]=useState(false); const [search,setSearch]=useState('');
  useEffect(()=>{Promise.all([fetch(asset('data/2017_sommer_arbeitsplanung_segmented.json')).then(r=>{if(!r.ok)throw Error('Prüfungsdaten fehlen');return r.json();}),repository.getReviews('local'),fetch(asset('data/2017_sommer_arbeitsplanung_answers.json')).then(r=>{if(!r.ok)throw Error('Antwortdaten fehlen');return r.json();}),repository.getAnswerReviews('local')])
    .then(([data,saved,key,answers]:[SegmentedExam,QuestionReview[],AnswerKey,AnswerReview[]])=>{setExam(data);setAnswerKey(key);setAnswerReviews(Object.fromEntries(answers.map(a=>[a.question_id,a])));setReviews(Object.fromEntries(saved.map(r=>[r.question_id,r])));const number=new URLSearchParams(location.search).get('q');setSelected(data.questions.find(q=>q.question_number===number)?.question_id??data.questions[0].question_id);})
    .catch(()=>setError('Die Prüfungsdaten oder der lokale Speicher konnten nicht geöffnet werden. Bitte Seite neu laden und Browserspeicher erlauben.'));},[]);
  const questions=useMemo(()=>exam?.questions.map(q=>effectiveQuestion(q,reviews[q.question_id]))??[],[exam,reviews]);
  const busy=editing||answerEditing||importing;
  useLayoutEffect(()=>{onBusy?.(busy);},[busy,onBusy]);
  useLayoutEffect(()=>()=>onBusy?.(false),[onBusy]);
  const segmentationQueue=questions.filter(q=>q.review_status==='needs_review');
  const answers=useMemo(()=>exam?.questions.filter(q=>/^\d+$/.test(q.question_number)).map(q=>answerKey?.answers.find(a=>a.question_id===q.question_id)??({
    question_id:q.question_id,exam:q.exam,module:q.module,question_number:Number(q.question_number),official_answer_type:'multiple_choice',official_answer:null,
    official_answer_status:'needs_review',confidence:0,solution_source_page:2,source_page:2,source_pdf:exam.solution_document.public_pdf,
    source_crop:exam.solution_document.pages[1].image,answer_bbox:[],parser_revision:answerKey?.parser_revision??'missing',review_reasons:['missing_record']
  } as OfficialAnswer))??[],[exam,answerKey]);
  const answerQueue=answers.filter(a=>effectiveAnswer(a,answerReviews[a.question_id]).official_answer_status==='needs_review');
  const queueCount=new Set([...segmentationQueue.map(q=>q.question_id),...answerQueue.map(q=>q.question_id)]).size;
  const current=questions.find(q=>q.question_id===selected);
  const original=exam?.questions.find(q=>q.question_id===selected);
  const filtered=questions.filter(q=>(q.question_number+' '+q.extracted_text+' '+q.tags.join(' ')).toLowerCase().includes(search.toLowerCase()));
  const choose=(id:string)=>{if(busy)return;setSelected(id);setMessage('');const q=exam?.questions.find(q=>q.question_id===id);if(q){const url=new URL(location.href);url.searchParams.set('q',q.question_number);history.replaceState(null,'',url);}};
  const exportReviews=()=>{const blob=new Blob([JSON.stringify({schema_version:2,reviews:Object.values(reviews),answer_reviews:Object.values(answerReviews)},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='ap2-review-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const importReviews=async(file?:File)=>{if(!file||!exam||busy)return;setImporting(true);try{const data=JSON.parse(await file.text());
    if(![1,2].includes(data.schema_version)||!Array.isArray(data.reviews)||!data.reviews.every(validReview))throw Error();
    const importedAnswers=data.schema_version===2?data.answer_reviews:[];
    if(!Array.isArray(importedAnswers)||!importedAnswers.every(validAnswerReview)||importedAnswers.some((a:AnswerReview)=>!answers.some(q=>q.question_id===a.question_id)))throw Error();
    for(const r of data.reviews as QuestionReview[]){const q=exam.questions.find(q=>q.question_id===r.question_id);if(!q||r.bounding_box[2]>q.source_size[0]||r.bounding_box[3]>q.source_size[1]||r.regions.some(b=>b[0]<r.bounding_box[0]||b[1]<r.bounding_box[1]||b[2]>r.bounding_box[2]||b[3]>r.bounding_box[3])||r.solution_page!==null&&r.solution_page>exam.solution_document.pages.length)throw Error();}
    await repository.importReviews(data.reviews,importedAnswers);setAnswerReviews(Object.fromEntries((await repository.getAnswerReviews('local')).map(a=>[a.question_id,a])));setReviews(Object.fromEntries((await repository.getReviews('local')).map(r=>[r.question_id,r])));setMessage('Sicherung importiert.');
  }catch{setMessage('Import nicht möglich: ungültige Daten oder andere Prüfung. Vorhandene Änderungen bleiben erhalten.');}finally{setImporting(false);}};
  if(error)return <main role="alert">{error}</main>;
  if(!exam||!current||!original||!answerKey)return <main>Aufgaben werden geladen…</main>;
  if(tab==='debug')return <><div className="debug-return"><button className="primary" onClick={()=>setTab('study')}>← Zurück zu den Einzelaufgaben</button><span>Quellen / Debug · unveränderte ältere Importdaten</span></div><LegacyArchive/></>;
  const uSolution=uSolutions.find(s=>s.question_id===original.question_id);
  const answer=answers.find(a=>a.question_id===original.question_id);
  const saveAnswer=async(review:AnswerReview)=>{await repository.saveAnswerReview(review);setAnswerReviews(saved=>({...saved,[review.question_id]:review}));setMessage('Antwort gespeichert und gegen automatische Änderungen gesperrt.');};
  const index=questions.findIndex(q=>q.question_id===selected);
  const edited=!!reviews[current.question_id] && JSON.stringify(current.regions)!==JSON.stringify(original.regions);
  const confirm=async(review:QuestionReview)=>{await repository.saveReview({...review,tags:review.tags.filter(Boolean)});setReviews(r=>({...r,[review.question_id]:review}));setEditing(false);setMessage('Gespeichert. Deine Änderungen sind geschützt.');};
  return <div className="app study-app"><aside>
    <button className="brand review-brand" disabled={busy} onClick={()=>onHome?onHome():location.assign('./')}>AP2<span>REVIEW</span></button><div className="side-label">SOMMER 2017</div><h2>Arbeitsplanung</h2><p className="muted">Originalaufgaben.<br/>Eine nach der anderen.</p>
    <input className="question-search" aria-label="Aufgaben suchen" placeholder="Aufgabe oder Begriff suchen" value={search} onChange={e=>setSearch(e.target.value)}/>
    <nav className="question-nav" aria-label="Einzelaufgaben">{(['A','B'] as const).map(part=><section key={part}><h3>Teil {part}</h3><div className="number-grid">{filtered.filter(q=>q.question_number.startsWith('U')===(part==='B')).map(q=><button key={q.question_id} aria-label={`Aufgabe ${q.question_number}`} aria-current={selected===q.question_id?'true':undefined} className={`${selected===q.question_id?'active':''} ${q.review_status==='needs_review'?'needs-review':''}`} disabled={busy} onClick={()=>choose(q.question_id)}>{q.question_number}<span className="status-dot"/></button>)}</div></section>)}</nav>
    <div className="scope"><span className="dot"/> REVIEW MODE<p>Nur Arbeitsplanung 2017.<br/>Kein Vollimport gestartet.</p><button onClick={exportReviews}>Änderungen exportieren</button><label className="import-button">Sicherung importieren<input type="file" disabled={busy} accept="application/json" onChange={e=>void importReviews(e.target.files?.[0])}/></label></div>
  </aside><main>
    <header><div><div className="eyebrow">2017 SOMMER · ARBEITSPLANUNG</div><h1>Die Originalaufgabe.<br/><span>Alles im Blick.</span></h1></div><span className="phase">Review Mode</span></header>
    <section className="stats"><div><strong>{questions.length}</strong><span>Automatisch geschnittene Aufgaben</span></div><div><strong>{queueCount}</strong><span>Benötigen Review</span></div><div><strong>{answers.filter(a=>a.official_answer_status==='auto_ready').length}</strong><span>Offizielle Antworten erkannt</span></div><div><strong>13</strong><span>Originalseiten · eine Klausur</span></div></section>
    <div className="tabs" role="tablist" aria-label="Ansicht"><button role="tab" aria-selected={tab==='study'} disabled={busy} onClick={()=>setTab('study')}>Aufgaben</button><button role="tab" aria-selected={tab==='review'} disabled={busy} onClick={()=>setTab('review')}>Review ({queueCount})</button><button role="tab" aria-selected={false} disabled={busy} onClick={()=>setTab('debug')}>Quellen / Debug</button></div>
    {message&&<p className="save-message" role="status">{message}</p>}
    {tab==='review'&&<section className="reader queue-panel"><h2>Nur Aufgaben mit Prüfbedarf</h2><p className="hint">Sichere automatische Ausschnitte und Antworten müssen nicht einzeln bestätigt werden.</p>
      <div className="answer-queue"><h3>Offizielle Auswahlantworten ({answerQueue.length})</h3>{answerQueue.length===0?<p>Keine offenen Antwortprüfungen. Q1–Q28 sind automatisch vorbereitet oder von dir bestätigt.</p>:answerQueue.map(a=><button className="queue-item" key={a.question_id} onClick={()=>{choose(a.question_id);setTab('study');}}><strong>Antwort Q{a.question_number}</strong><span>Offizielle Kreismarkierung prüfen</span><span>Prüfen →</span></button>)}</div>
      <h3>Aufgabenausschnitte ({segmentationQueue.length})</h3>{segmentationQueue.length===0?<p>Keine offenen Ausschnittprüfungen.</p>:segmentationQueue.map(q=><button className="queue-item" key={q.question_id} onClick={()=>{choose(q.question_id);setTab('study');setEditing(true);}}><strong>Aufgabe {q.question_number}</strong><span>{q.review_reasons.length?q.review_reasons.map(reason).join(' · '):'Von dir zur Prüfung markiert'}</span><span>Prüfen →</span></button>)}
      <a href={asset(answerKey.overlay)} target="_blank" rel="noreferrer">Antworttabelle mit Erkennung ansehen ↗</a></section>}
    {tab==='study'&&<><div className="study-pagination"><button disabled={busy||index===0} onClick={()=>choose(questions[index-1].question_id)}>← Vorherige</button><span>{index+1} von {questions.length}</span><button disabled={busy||index===questions.length-1} onClick={()=>choose(questions[index+1].question_id)}>Nächste →</button></div>
      <section className="reader question-card"><div className="reader-head"><div><div className="eyebrow">ORIGINAL QUESTION · {current.question_number.startsWith('U')?'TEIL B':'TEIL A'}</div><h2>Aufgabe {current.question_number}</h2></div><span className={`badge ${current.review_status}`}>{current.review_status==='confirmed'?'Confirmed':current.review_status==='needs_review'?'Needs Review':'Automatisch vorbereitet'}</span></div>
        {current.review_status==='needs_review'&&<p className="review-hint">{current.review_reasons.map(reason).join(' · ')||'Von dir zur Prüfung markiert'}</p>}
        {reviews[current.question_id]&&reviews[current.question_id].source_revision!==original.segmentation_revision&&<p className="review-hint">Die automatische Extraktion wurde aktualisiert. Deine gespeicherten Änderungen bleiben aktiv.</p>}
        <div className="question-art"><CropImage key={current.question_id} question={current} edited={edited}/></div>
        <div className="question-actions"><button className="primary" disabled={busy} onClick={()=>setEditing(true)}>Prüfen / Bearbeiten</button><a className="outline" href={asset(current.source_pdf)+`#page=${current.source_page}`} target="_blank" rel="noreferrer">Original-PDF · Seite {current.source_page} ↗</a><a className="outline" href={asset(current.source_page_image)} target="_blank" rel="noreferrer">Ganze Seite ↗</a></div>
        {current.tags.length>0&&<div className="tag-list">{current.tags.filter(Boolean).map((t,i)=><span key={i}>{t}</span>)}</div>}
        {answer?<AnswerPanel key={answer.question_id} answer={answer} review={answerReviews[answer.question_id]} overlay={answerKey.overlay} disabled={editing||importing} onSave={saveAnswer} onBusy={setAnswerEditing}/>:<div className="answer"><strong>OFFICIAL SOLUTION · TEIL B</strong>{uSolution?<><p>Original-Lösungsbereiche · {uSolution.question_number} · {uSolution.review_status}</p><img className="question-image" src={asset(uSolution.cropped_solution_image)} alt={`Offizielle Lösung ${uSolution.question_number}`}/>{uSolution.regions.map((r,i)=><a key={i} className="outline" href={asset(uSolution.solution_source_pdf)+`#page=${r.source_page}`} target="_blank" rel="noreferrer">Lösung PDF-Seite {r.source_page} ↗</a>)}</>:<p>Keine offizielle Lösung geladen.</p>}</div>}
        {current.question_number.startsWith('U')&&<details><summary>Gemeinsame Unterlagen für Teil B</summary><p className="hint">Die Aufgabenbeschreibung und die Anlage bleiben als Originalquellen verfügbar.</p><a href={asset(current.source_pdf)+'#page=9'} target="_blank" rel="noreferrer">Aufgabenbeschreibung · PDF-Seite 9 ↗</a><br/><a href={asset(current.source_pdf)+'#page=13'} target="_blank" rel="noreferrer">Anlage · PDF-Seite 13 ↗</a></details>}
      </section>{editing&&<ReviewEditor key={current.question_id} question={current} original={original} exam={exam} fixedSolution={!!uSolution} onSave={confirm} onCancel={()=>setEditing(false)}/>}</>}
    <footer>Originalbild ist maßgeblich · Änderungen nur auf diesem Gerät · Keine automatische Benotung</footer>
  </main></div>;
}
