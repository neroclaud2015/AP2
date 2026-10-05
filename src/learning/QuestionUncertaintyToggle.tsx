import {useEffect,useRef,useState} from 'react';
import {useAppServices} from '../services/context';
import type {QuestionUncertaintyState} from './questionUncertainty';
import './uncertainty.css';

/** Current personal uncertainty is independent of a submitted attempt. */
export default function QuestionUncertaintyToggle({questionId,onBusy,disabled=false}:{questionId:string;onBusy?:(busy:boolean)=>void;disabled?:boolean}){
 const {repository,user}=useAppServices();
 const [state,setState]=useState<QuestionUncertaintyState>(),[loaded,setLoaded]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const alive=useRef(true),guard=useRef(false),request=useRef(0);
 const load=async()=>{if(guard.current)return;const token=++request.current;try{const value=await repository.getQuestionUncertainty(user.id,questionId);if(alive.current&&token===request.current){setState(value);setLoaded(true);setError('')}}catch{if(alive.current&&token===request.current)setError('Unsicher-Status konnte nicht geladen werden. Bitte erneut laden.')}};
 useEffect(()=>{alive.current=true;setLoaded(false);void load();const refresh=()=>void load();window.addEventListener('focus',refresh);window.addEventListener('ap2:personal-data-changed',refresh);return()=>{alive.current=false;request.current++;window.removeEventListener('focus',refresh);window.removeEventListener('ap2:personal-data-changed',refresh)}},[repository,user.id,questionId]);
 useEffect(()=>{onBusy?.(saving||!loaded&&!error);return()=>onBusy?.(false)},[saving,loaded,error,onBusy]);
 const toggle=async(active:boolean)=>{if(guard.current||!loaded)return;guard.current=true;request.current++;setSaving(true);setError('');try{const next=await repository.saveQuestionUncertainty(user.id,questionId,active,state?.revision??0);if(alive.current){setState(next);window.dispatchEvent(new Event('ap2:personal-data-changed'))}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Unsicher-Status nicht gespeichert. Bitte erneut laden.')}finally{guard.current=false;if(alive.current)setSaving(false)}};
 return <section className="question-uncertainty" aria-label="Unsicher-Status"><label><input type="checkbox" disabled={disabled||!loaded||saving||!!error} checked={state?.active??false} onChange={e=>void toggle(e.target.checked)}/> <span>Diese Aufgabe ist mir unsicher</span></label><span className="uncertainty-save" role="status">{saving?'Speichert…':!loaded?'Lädt…':state?'Gespeichert':''}</span>{error&&<div role="alert"><p>{error}</p><button className="outline" disabled={saving} onClick={()=>void load()}>Unsicher-Status neu laden</button></div>}</section>;
}
