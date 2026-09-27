import {useLayoutEffect,useRef,useState} from 'react';
import type {IndexedDBProgressRepository} from '../storage/storage';
import type {TestSession} from './model';

export interface RecordLifecycleProps {
 compact?:boolean;session:TestSession;repository:IndexedDBProgressRepository;disabled?:boolean;
 onUpdated:(session:TestSession)=>void;onDeleted:(id:string)=>void;onBusy?:(busy:boolean)=>void;
}
export default function RecordLifecycle({session,repository,compact=false,disabled=false,onUpdated,onDeleted,onBusy}:RecordLifecycleProps){
 const [confirmation,setConfirmation]=useState<{mode:'discard'|'delete';revision:number}|null>(null);
 const [saving,setSaving]=useState(false);const [error,setError]=useState('');const guard=useRef(false);
 const busyRef=useRef(false);const callbackRef=useRef(onBusy);callbackRef.current=onBusy;
 useLayoutEffect(()=>{const busy=!!confirmation||saving;if(busy!==busyRef.current){busyRef.current=busy;callbackRef.current?.(busy);}},[confirmation,saving]);
 useLayoutEffect(()=>()=>{if(busyRef.current)callbackRef.current?.(false);},[]);
 const open=(mode:'discard'|'delete')=>{if(disabled||guard.current)return;setError('');setConfirmation({mode,revision:session.revision});};
 const confirm=async()=>{
  if(!confirmation||guard.current)return;guard.current=true;setSaving(true);setError('');
  try{
   if(confirmation.mode==='discard')onUpdated(await repository.discardTestSession(session.userId,session.test_id,confirmation.revision));
   else{await repository.deleteTestSession(session.userId,session.test_id,confirmation.revision);onDeleted(session.test_id);}
  }catch(e){
   setError(e instanceof Error?e.message:'Aktion nicht gespeichert. Bitte erneut versuchen.');
   try{const fresh=await repository.getTestSession(session.userId,session.test_id);if(fresh)onUpdated(fresh);else onDeleted(session.test_id);}catch{/* Keep the existing record visible if refreshing storage also fails. */}
  }finally{guard.current=false;setSaving(false);setConfirmation(null);}
 };
 return <div className="record-lifecycle" data-testid="record-lifecycle">
  <div className="session-actions">{session.status!=='discarded'&&<button className="outline" disabled={disabled||saving} aria-label="Versuch verwerfen" onClick={()=>open('discard')}>{compact?'Verwerfen':'Versuch verwerfen'}</button>}<button className="outline destructive-outline" disabled={disabled||saving} aria-label="Versuch löschen" onClick={()=>open('delete')}>{compact?'Löschen':'Versuch löschen'}</button></div>
  {error&&<p className="session-warning" role="alert">{error} Bitte den aktuellen Stand prüfen und bei Bedarf erneut bestätigen.</p>}
  {confirmation&&<section className="session-confirm" role="alertdialog" aria-label={confirmation.mode==='discard'?'Versuch verwerfen bestätigen':'Versuch löschen bestätigen'}><h2>{confirmation.mode==='discard'?'Diesen Versuch verwerfen?':'Diesen Versuch dauerhaft löschen?'}</h2><p>{session.module} · {new Date(session.started_at).toLocaleString('de-DE')}</p><p>{confirmation.mode==='discard'?'Der Versuch bleibt mit seinen Antworten gespeichert, wird aber aus der normalen Übersicht und allen Auswertungen ausgeschlossen. Er kann nicht fortgesetzt werden.':'Dieser Versuch mit seinen Antworten, Bewertungen und Ergebnissen wird dauerhaft gelöscht. Dein freier Lernfortschritt und andere Versuche bleiben erhalten.'}</p><button className="primary" disabled={saving} onClick={()=>void confirm()}>{confirmation.mode==='discard'?'Verwerfen bestätigen':'Dauerhaft löschen'}</button><button className="outline" autoFocus disabled={saving} onClick={()=>setConfirmation(null)}>Abbrechen</button></section>}
 </div>;
}
