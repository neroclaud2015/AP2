import { useState } from 'react';
import { CropEditor, CropImage } from './CropImage';
import { asset, type Box, type QuestionReview, type SegmentedExam, type SegmentedQuestion, validReview } from './types';

export default function ReviewEditor({question, original, exam, fixedSolution=false, onSave, onCancel}: {
  question: SegmentedQuestion; original: SegmentedQuestion; exam: SegmentedExam; fixedSolution?:boolean;
  onSave: (review: QuestionReview)=>Promise<void>; onCancel: ()=>void;
}) {
  const [draft,setDraft]=useState(question);
  const [error,setError]=useState(''); const [saving,setSaving]=useState(false);
  const update=<K extends keyof SegmentedQuestion>(key:K,value:SegmentedQuestion[K])=>setDraft(d=>({...d,[key]:value}));
  const validBox=(box:Box)=>box.every(Number.isFinite)&&box[0]>=0&&box[1]>=0&&box[2]<=draft.source_size[0]&&box[3]<=draft.source_size[1]&&box[2]>box[0]&&box[3]>box[1];
  const save=async(status:'confirmed'|'needs_review')=>{
    const review:QuestionReview={userId:'local',question_id:original.question_id,source_revision:original.segmentation_revision,
      question_number:draft.question_number.trim(),bounding_box:draft.bounding_box,regions:draft.regions,extracted_text:draft.extracted_text,
      tags:draft.tags,solution_page:draft.solution_page,solution_confirmed:draft.solution_confirmed,review_status:status,updated_at:new Date().toISOString()};
    if(!validReview(review)||!validBox(draft.bounding_box)){setError('Bitte eine gültige Nummer und einen Ausschnitt innerhalb der Originalseite eingeben.');return;}
    setSaving(true);try{await onSave(review);}catch{setError('Speichern fehlgeschlagen. Deine Änderungen bleiben hier erhalten.');}finally{setSaving(false);}
  };
  return <section className="review-editor" aria-label="Aufgabe bearbeiten"><div className="reader-head"><h2>Prüfen & bearbeiten</h2><button onClick={onCancel}>Abbrechen</button></div>
    <p className="hint">Deine Änderungen werden auf diesem Gerät gespeichert und gegen automatische Extraktion gesperrt. Exportiere sie als Sicherung.</p>
    <div className="edit-fields"><label>Aufgabennummer<input aria-label="Aufgabennummer" value={draft.question_number} onChange={e=>update('question_number',e.target.value)}/></label>
      <label>Wissens-Tags (mit Komma trennen)<input aria-label="Wissens-Tags" value={draft.tags.join(', ')} onChange={e=>update('tags',e.target.value.split(',').map(t=>t.trim()))}/></label></div>
    <h3>Originalausschnitt</h3><CropEditor question={draft} onChange={box=>setDraft(d=>({...d,bounding_box:box,regions:[box]}))}/>
    <button className="outline" onClick={()=>setDraft(d=>({...d,bounding_box:original.bounding_box,regions:original.regions}))}>Automatischen Ausschnitt wiederherstellen</button>
    {validBox(draft.bounding_box)&&<details><summary>Vorschau des neuen Ausschnitts</summary><CropImage question={draft} edited/></details>}
    <label className="text-label">Hilfstext für Suche und Einordnung<textarea aria-label="Extrahierter Text" rows={8} value={draft.extracted_text} onChange={e=>update('extracted_text',e.target.value)}/></label>
    {fixedSolution?<p className="hint">Die offiziellen Lösungsbereiche werden oben mit direkten PDF-Quellen gezeigt. Eigene Bewertungen bleiben im Lernmodus.</p>:/^\d+$/.test(original.question_number)?<p className="hint">Die Auswahlantwort wird oben separat über „Antwort ändern“ bearbeitet (nur 1–5). Die Quellen-PDF-Seite ist kein Antwortwert.</p>:<><h3>Offizielle Lösungsquelle zuordnen</h3><p className="hint">Seite aus dem vorhandenen Lösungsdokument auswählen und prüfen. Eine Zuordnung gilt erst nach deiner Bestätigung.</p>
    <label>Lösungsseite <select aria-label="Lösungsseite" value={draft.solution_page??''} onChange={e=>setDraft(d=>({...d,solution_page:e.target.value?Number(e.target.value):null,solution_confirmed:false}))}><option value="">Keine Zuordnung</option>{exam.solution_document.pages.map(p=><option key={p.number} value={p.number}>PDF-Seite {p.number}</option>)}</select></label>
    {draft.solution_page&&<><div className="solution-preview"><img src={asset(exam.solution_document.pages[draft.solution_page-1].image)} alt={`Lösungsvorschau Seite ${draft.solution_page}`}/></div><label className="check-label"><input type="checkbox" checked={draft.solution_confirmed} onChange={e=>update('solution_confirmed',e.target.checked)}/>Diese Lösungszuordnung bestätigen</label></>}
    </>}
    {error&&<p role="alert">{error}</p>}<div className="save-row"><button className="primary" disabled={saving} onClick={()=>save('confirmed')}>Speichern · Confirmed</button><button className="outline" disabled={saving} onClick={()=>save('needs_review')}>Speichern · Needs Review</button></div>
  </section>;
}
