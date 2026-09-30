import {useEffect,useRef,useState} from 'react';
import {useAppServices} from '../services/context';
import {asset,questionSources,questionSourceUrl} from '../segmented/types';
import {CropImage} from '../segmented/CropImage';
import Practice from '../learning/Practice';
import ExternalAttachments from '../learning/ExternalAttachments';
import {contextPagesForQuestion} from '../learning/questionContext';
import {examLabel,originalPageLink} from '../learning/modules';
import type {Attempt} from '../learning/model';
import {useBankData} from '../bank/useBankData';
import {filterInventory} from '../bank/model';
import type {TrainingLaunch} from '../bank/BankView';
import type {TrainingRun} from './model';
export default function TrainingWorkspace({runId,onBusy,onBack,onRestart}:{runId?:string;onBusy:(v:boolean)=>void;onBack:(stage:boolean)=>void;onRestart:(v:TrainingLaunch)=>Promise<void>}){
 const {repository,user}=useAppServices(),{data}=useBankData();const [run,setRun]=useState<TrainingRun>(),[attempts,setAttempts]=useState<Attempt[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[epoch,setEpoch]=useState(0),[removed,setRemoved]=useState(false);const latest=useRef<TrainingRun|undefined>(undefined);
 useEffect(()=>{onBusy(busy||confirm);},[busy,confirm,onBusy]);
 const update=(value:TrainingRun)=>{latest.current=value;setRun(value)};
 useEffect(()=>{let alive=true;setRun(undefined);latest.current=undefined;setError('');if(!runId){setError('Trainings-ID fehlt. Bitte über die Aufgabenbank starten.');return;}void Promise.all([repository.getTrainingRun(user.id,runId),repository.getAttempts(user.id)]).then(([r,a])=>{if(alive){if(!r)setError('Dieses Training wurde auf diesem Gerät nicht gefunden.');else update(r);setAttempts(a)}}).catch(e=>{if(alive)setError(String(e))});return()=>{alive=false}},[runId,repository,user.id]);
 const act=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn()}catch(e){setError(String(e))}finally{setBusy(false)}};
 const refreshAttempts=async()=>setAttempts(await repository.getAttempts(user.id));
 const restart=()=>void act(async()=>{if(!run||!data)throw Error('Aufgabenbank wird noch geladen.');const definition=run.definition;let questions=filterInventory(data.inventory,data.classifications,{knowledgeTopicIds:definition.knowledgeTopicIds,questionTypeIds:definition.questionTypeIds,modules:definition.moduleIds,examIds:definition.examIds},data.taxonomy);if(run.kind==='stage'){const states=await repository.getWrongQuestions(user.id),ids=new Set(states.filter(s=>s.stage===run.stage).map(s=>s.question_id));questions=data.inventory.filter(q=>ids.has(q.question_id));}if(!questions.length)throw Error('Für diese Auswahl gibt es aktuell keine Aufgaben. Die bisherige Runde bleibt erhalten.');setConfirm(false);await onRestart({definition,questions,restart:true,stage:run.stage});});
 if(!run)return <section>{error?<p role="alert">{error}</p>:<p role="status">Training wird geladen…</p>}</section>;
 const id=run.current_question,snapshot=run.snapshots[id],q=snapshot.question,index=run.question_ids.indexOf(id),history=attempts.filter(a=>a.training_run_id===run.run_id&&a.question_id===id);
 const done=run.question_ids.filter(id=>attempts.some(a=>a.training_run_id===run.run_id&&a.question_id===id&&a.correctness!==null&&(a.auto_scored||a.self_assessed))).length;
 const matching=data?filterInventory(data.inventory,data.classifications,{knowledgeTopicIds:run.definition.knowledgeTopicIds,questionTypeIds:run.definition.questionTypeIds,modules:run.definition.moduleIds,examIds:run.definition.examIds},data.taxonomy):undefined;
 const changed=data&&(run.question_ids.some(id=>{const current=data.inventory.find(q=>q.question_id===id);return !current||!!run.snapshots[id].provenance?.question_source_revision&&current.question_source_revision!==run.snapshots[id].provenance?.question_source_revision})||run.kind==='bank'&&matching&&(matching.length!==run.question_ids.length||matching.some(q=>!run.question_ids.includes(q.question_id))));
 const move=(offset:number)=>void act(async()=>{const current=latest.current!;update(await repository.moveTraining(user.id,current.run_id,current.revision,current.question_ids[index+offset]));setRemoved(false);window.scrollTo(0,0)});
 return <section className="training-workspace"><div className="training-heading"><div><span className="eyebrow">{run.kind==='bank'?'AUFGABENBANK':'FEHLERTRAINING'}</span><h1>{run.kind==='bank'?'Dein Training':run.stage==='mastered'?'Gemeistert':`Stufe ${run.stage}`}</h1></div><button className="outline" disabled={busy} onClick={()=>onBack(run.kind==='stage')}>Zur Übersicht</button></div>
 <div className="training-progress"><strong data-testid="training-progress">{done} / {run.question_ids.length} bearbeitet</strong><progress value={done} max={run.question_ids.length}/><span>Aufgabe {index+1} / {run.question_ids.length} · Diese Runde bleibt als feste Auswahl gespeichert.</span></div>
 {changed&&<p role="status" className="session-warning">Die Aufgabenbank hat sich geändert. Diese Runde behält ihre ursprünglichen Aufgaben und Quellen. Eine neue Runde verwendet den aktuellen Stand.</p>}
 <div className="training-actions"><button className="outline" disabled={busy||!data} onClick={()=>setConfirm(true)}>Training neu starten</button>{run.kind==='stage'&&<button className="outline" disabled={busy||removed} onClick={()=>void act(async()=>{await repository.hideWrongQuestion(user.id,id);setRemoved(true)})}>{removed?'Aus Fehlertraining entfernt':'Aus Fehlertraining entfernen'}</button>}</div>
 {error&&<p role="alert">{error}</p>}<p className="training-context">{examLabel(snapshot.config.examId)} / {snapshot.config.title} / Aufgabe {q.question_number}</p>
 <section className="reader"><div className="reader-head"><h2>Aufgabe {q.question_number}</h2><div className="source-links">{questionSources(q).map(s=><a key={s.source_page} href={questionSourceUrl(q,s)} target="_blank" rel="noreferrer">Originalquelle · Seite {s.source_page} ↗</a>)}</div></div><div className="question-art"><CropImage question={q} edited={snapshot.cropEdited}/></div><ExternalAttachments items={snapshot.config.externalAttachments} number={q.question_number}/>
 {contextPagesForQuestion(snapshot.config,q.question_number,!!snapshot.solution).length>0&&<details><summary>Gemeinsame Aufgabenbeschreibung & Anlagen</summary>{contextPagesForQuestion(snapshot.config,q.question_number,!!snapshot.solution).map(page=><p key={page}><a href={originalPageLink(snapshot.config,q.source_pdf,page)} target="_blank" rel="noreferrer">Originalunterlage · Seite {page} ↗</a></p>)}</details>}
 <Practice key={run.run_id+':'+id+':'+epoch} classificationSourceRevision={snapshot.provenance?.question_source_revision} provenance={snapshot.provenance} questionId={id} number={q.question_number} answer={snapshot.answer??undefined} u={snapshot.solution??undefined} session={run.drafts[id]} history={history} onBusy={setBusy}
 onSession={async s=>{const current=latest.current!;update(await repository.saveTrainingDraft(user.id,current.run_id,current.revision,s))}}
 onAttempt={async(a,s)=>{const current=latest.current!;const saved=await repository.saveTrainingAttempt(user.id,current.run_id,current.revision,a,s);update(saved.run);await refreshAttempts()}}
 onAnnotate={async(a,v)=>{await repository.annotateAttempt(user.id,a,v);await refreshAttempts()}}
 onDelete={async a=>{const current=latest.current!;update(await repository.deleteTrainingAttempt(user.id,current.run_id,current.revision,a));await refreshAttempts();setEpoch(n=>n+1)}}/>
 </section><div className="study-pagination"><button className="outline" disabled={busy||index===0} onClick={()=>move(-1)}>← Vorherige Aufgabe</button><button className="primary" disabled={busy||index===run.question_ids.length-1} onClick={()=>move(1)}>Nächste Aufgabe →</button></div>
 {done===run.question_ids.length&&<p role="status">Diese Runde ist vollständig bearbeitet. Deine Versuche und Notizen bleiben gespeichert.</p>}
 {confirm&&<section className="session-confirm" role="alertdialog" aria-label="Training neu starten bestätigen"><h2>Neue Trainingsrunde?</h2><p>Die neue Runde beginnt ohne Antworten. Bisherige Versuche, Notizen und Fehlertraining bleiben erhalten.</p><button className="primary" disabled={busy} onClick={restart}>Neue Runde starten</button><button className="outline" disabled={busy} onClick={()=>setConfirm(false)}>Abbrechen</button></section>}</section>;
}
