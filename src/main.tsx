import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Exam } from './types';
import './style.css';

const asset = (path: string) => import.meta.env.BASE_URL + path;
function App() {
  const [exam, setExam] = useState<Exam>();
  const [error, setError] = useState('');
  const [docIndex, setDocIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [mode, setMode] = useState<'pages' | 'questions' | 'review'>('pages');
  const [questionIndex, setQuestionIndex] = useState(0);
  useEffect(() => { fetch(asset('data/2017_sommer.json')).then(r => {
    if (!r.ok) throw new Error('Prüfungsdaten konnten nicht geladen werden.');
    return r.json();
  }).then(setExam).catch(e => setError(String(e))); }, []);
  if (error) return <main className="loading" role="alert">{error}</main>;
  if (!exam) return <main className="loading">Prüfungsarchiv wird geladen…</main>;
  const doc = exam.documents[docIndex];
  const page = doc?.pages[pageIndex];
  const questions = exam.questions.filter(q => q.module === doc?.module);
  const question = questions[questionIndex];
  const pageCount = exam.documents.reduce((n, d) => n + d.pages.length, 0);
  const goTo = (documentId: string, number: number) => {
    setDocIndex(exam.documents.findIndex(d => d.id === documentId)); setPageIndex(number - 1); setMode('pages');
  };
  return <div className="app">
    <aside>
      <a className="brand" href="#">AP2<span>STUDY ARCHIVE</span></a>
      <div className="side-label">DEIN PRÜFUNGSARCHIV</div>
      <h2>Sommer 2017</h2><p className="muted">Ein Prüfungsjahrgang.<br/>Jede Quelle nachvollziehbar.</p>
      <nav aria-label="Prüfungsbereiche">{exam.documents.map((d, i) => <button key={d.id} className={i === docIndex ? 'active' : ''} onClick={() => { setDocIndex(i); setPageIndex(0); setQuestionIndex(0); }}>
        <span>{d.module === 'Solutions' ? 'Offizielle Lösungen' : d.module}</span><small>{d.pages.length} Seiten</small>
      </button>)}</nav>
      <div className="scope"><span className="dot"/> PHASE 0 + 1<p>Ingestion-Prototyp<br/>Weitere Jahrgänge nicht importiert.</p></div>
    </aside>
    <main>
      <header><div><div className="eyebrow">HISTORISCHE ORIGINALPRÜFUNG</div><h1>Quellen verstehen.<br/><span>Sicher weiterlernen.</span></h1></div><span className="phase">Prototyp · 01</span></header>
      <section className="stats" aria-label="Importübersicht"><div><strong>01</strong><span>Prüfungssaison</span></div><div><strong>{pageCount}</strong><span>Originalseiten erhalten</span></div><div><strong>{exam.questions.length}</strong><span>Ungeprüfte Aufgabenvorschläge</span></div><div><strong>{exam.review_queue.length}</strong><span>Offene Prüfhinweise</span></div></section>
      <div className="notice"><strong>Prüfung erforderlich</strong><span>Text und Aufgabengrenzen sind ungeprüft. Die Originalseite ist maßgeblich. Fehlende Werte und Lösungen werden nicht ergänzt.</span></div>
      <div className="toolbar"><div className="tabs" role="tablist" aria-label="Ansicht">{([['pages', 'Originalseiten'], ['questions', 'Aufgabenvorschläge'], ['review', 'Prüfliste']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={mode === key} onClick={() => setMode(key)}>{label}</button>)}</div></div>
      {mode === 'pages' && doc && page && <section className="reader">
        <div className="reader-head"><div><span className="eyebrow">ORIGINALDOKUMENT</span><h2>{doc.module === 'Solutions' ? 'Offizielle Lösungen' : doc.module}</h2></div><a className="outline" href={asset(doc.public_pdf) + '#page=' + page.number} target="_blank" rel="noreferrer">Original-PDF ↗</a></div>
        <div className="pagination"><button disabled={pageIndex === 0} onClick={() => setPageIndex(p => p - 1)}>← Zurück</button><label>PDF-Seite <select aria-label="PDF-Seite" value={pageIndex} onChange={e => setPageIndex(Number(e.target.value))}>{doc.pages.map((p, i) => <option key={p.number} value={i}>{p.number} / {doc.pages_total}</option>)}</select></label><button disabled={pageIndex === doc.pages.length - 1} onClick={() => setPageIndex(p => p + 1)}>Weiter →</button></div>
        <div className="page-frame"><img src={asset(page.image)} alt={`${doc.module}, Original-PDF-Seite ${page.number}`} /></div>
        <div className="source-meta"><span>{page.method === 'image_only' ? 'Bildseite · OCR ausstehend' : 'Vorhandene PDF-Textebene · ungeprüft'}</span>{doc.duration && <span>Zeitvorschlag: {doc.duration.minutes} min · Quelle Seite {doc.duration.source_page} · ungeprüft</span>}</div>
        <details><summary>Unveränderte Textextraktion anzeigen</summary><pre>{page.raw_text || 'Keine Textebene vorhanden. Originalbild zur Prüfung verwenden.'}</pre></details>
      </section>}
      {mode === 'questions' && <section className="reader"><div className="reader-head"><h2>Aufgabenvorschläge · {doc?.module}</h2><span className="badge">Needs review</span></div><p className="hint">Automatische Segmentierung kann Teilaufgaben, Antwortoptionen oder mehrere Aufgaben enthalten. Diese Liste ist kein bestätigter vollständiger Aufgabenkatalog.</p>
        {question ? <><label className="question-select">Vorschlag <select aria-label="Aufgabenvorschlag" value={questionIndex} onChange={e => setQuestionIndex(Number(e.target.value))}>{questions.map((q, i) => <option key={q.question_id} value={i}>{i + 1} · erkannte Nr. {q.question_number} · PDF-Seite {q.source_reference.page}</option>)}</select></label><div className="question-body"><span className="eyebrow">ORIGINAL QUESTION · UNGEPRÜFTE EXTRAKTION</span><pre>{question.question_text}</pre><p>Punkte: {question.points === null ? 'nicht sicher erkannt' : `${question.points} (ungeprüft)`}</p><button className="primary" onClick={() => goTo(question.source_reference.document_id, question.source_reference.page)}>Originalseite prüfen ↗</button></div><div className="answer"><strong>OFFICIAL SOLUTION</strong><p>{question.official_solution || 'Keine bestätigte Zuordnung. Das vollständige Lösungsdokument ist links verfügbar.'}</p>{question.solution_candidates.map((c, i) => <button key={i} onClick={() => goTo(c.source_reference.document_id, c.source_reference.page)}>Unbestätigter Lösungsvorschlag · Seite {c.source_reference.page}</button>)}</div></> : <p>Keine belastbaren Aufgabenvorschläge in diesem Dokument. Alle Originalseiten sind verfügbar.</p>}
      </section>}
      {mode === 'review' && <section className="reader"><div className="reader-head"><h2>Prüfliste</h2><span>{exam.review_queue.length} offen</span></div><p className="hint">Nur Übersicht im Prototyp. Bestätigen und Bearbeiten folgen in einer späteren Phase.</p><div className="review-list">{exam.review_queue.map(item => <button key={item.id} onClick={() => goTo(item.source_reference.document_id, item.source_reference.page)}><span><strong>{exam.documents.find(d => d.id === item.source_reference.document_id)?.module} · Seite {item.source_reference.page}</strong><small>{item.reason === 'ocr_required' ? 'Keine Textebene – OCR erforderlich' : item.kind === 'page' ? 'Texterkennung und Aufgabengrenzen prüfen' : 'Aufgabe, Punkte und Lösungszuordnung prüfen'}</small></span><span>Prüfen ↗</span></button>)}</div></section>}
      <footer>AP2 STUDY · Quellen bleiben erhalten. Unsicherheit bleibt sichtbar.</footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
