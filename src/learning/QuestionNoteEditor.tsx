import {useEffect,useRef,useState} from 'react';
import {useAppServices} from '../services/context';
import type {QuestionNote} from './questionNotes';

/** Question-owned notes never depend on answer drafts or attempts. */
export default function QuestionNoteEditor({questionId,onBusy}:{questionId:string;onBusy?:(busy:boolean)=>void}) {
 const {user,repository}=useAppServices();
 const [note,setNote]=useState<QuestionNote>();const [text,setText]=useState('');
 const [loaded,setLoaded]=useState(false);const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');const [conflict,setConflict]=useState(false);
 const alive=useRef(true);const guard=useRef(false);const dirty=loaded&&text!==(note?.text??'');
 useEffect(()=>{onBusy?.(dirty||saving);return()=>onBusy?.(false);},[dirty,saving,onBusy]);
 useEffect(()=>{alive.current=true;let current=true;void repository.getQuestionNote(user.id,questionId).then(n=>{if(current){setNote(n);setText(n?.text??'');setLoaded(true);}}).catch(()=>{if(current)setError('Notiz konnte nicht geladen werden. Bitte die Seite neu laden.');});return()=>{current=false;alive.current=false;};},[repository,user.id,questionId]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty||saving){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,saving]);
 const save=async()=>{if(guard.current||!loaded)return;guard.current=true;setSaving(true);setError('');try{const n=await repository.saveQuestionNote(user.id,questionId,text,note?.revision??0,note?.text??'');if(alive.current){setNote(n);setConflict(false);}}catch(e){if(alive.current){setError(e instanceof Error?e.message:'Notiz nicht gespeichert.');setConflict(true);}}finally{guard.current=false;if(alive.current)setSaving(false);}};
 const reload=async()=>{try{const n=await repository.getQuestionNote(user.id,questionId);if(alive.current){setNote(n);setError('Gespeicherten Stand geladen. Dein Text bleibt zum Vergleichen erhalten: '+(n?.text??'(leer)'));setConflict(false);}}catch{setError('Gespeicherter Stand nicht erreichbar.');}};
 return <section className="question-note" aria-label="Persönliche Notiz"><label>Notiz<textarea aria-label="Lernnotiz" rows={3} disabled={!loaded||saving} value={text} onChange={e=>setText(e.target.value)} placeholder="Eigener Lösungsweg oder Erinnerung…"/></label><div className="learning-tools"><button className="outline" disabled={!loaded||saving||!dirty||conflict} onClick={()=>void save()}>Notiz speichern</button><span role="status">{saving?'Speichert…':!loaded?'Lädt…':dirty?'Nicht gespeichert':note?'Gespeichert':'Noch keine Notiz'}</span></div>{error&&<p role="alert">{error}</p>}{conflict&&<button className="outline" onClick={()=>void reload()}>Gespeicherten Stand vergleichen</button>}</section>;
}
