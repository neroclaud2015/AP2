import {useEffect,useRef,useState} from 'react';
import ReviewWorkspace from '../segmented/StudyApp';
import {asset,effectiveQuestion,type QuestionReview,type SegmentedExam} from '../segmented/types';
import {effectiveAnswer,type AnswerKey,type AnswerReview,type OfficialAnswer} from '../segmented/answers';
import {CropImage} from '../segmented/CropImage';
import {IndexedDBProgressRepository} from '../storage/storage';
import Practice from './Practice';
import type {Attempt,LearningSession,USolution} from './model';
import {MODULES,moduleProgress,moduleParts,questionPart,readRoute,routeUrl,type LearningRoute,type ModuleSlug,type View} from './modules';
import './learning.css';

const repository=new IndexedDBProgressRepository();
interface Bundle {exam:SegmentedExam;keys:AnswerKey;solutions:USolution[]}
export default function LearningApp(){
 const [locationState,setLocationState]=useState(()=>readRoute(location.search));const [bundles,setBundles]=useState<Partial<Record<ModuleSlug,Bundle>>>({});
 const [moduleErrors,setModuleErrors]=useState<Partial<Record<ModuleSlug,string>>>({});const [personalLoaded,setPersonalLoaded]=useState(false);
 const [attempts,setAttempts]=useState<Attempt[]>([]);const [sessions,setSessions]=useState<LearningSession[]>([]);
 const [reviews,setReviews]=useState<QuestionReview[]>([]);const [answerReviews,setAnswerReviews]=useState<AnswerReview[]>([]);
 const [error,setError]=useState('');const [practiceBusy,setBusy]=useState(false);const [reviewBusy,setReviewBusy]=useState(false);const [routing,setRouting]=useState(false);
 const busy=practiceBusy||reviewBusy||routing;const busyRef=useRef(busy);busyRef.current=busy;
 const deferredRoute=useRef<LearningRoute|null>(null);const transition=useRef<(next:LearningRoute,push:boolean)=>Promise<void>>(async()=>{});
 const refreshPersonal=async()=>{const [a,s,r,k]=await Promise.all([repository.getAttempts('local'),repository.getLearningSessions('local'),repository.getReviews('local'),repository.getAnswerReviews('local')]);setAttempts(a);setSessions(s);setReviews(r);setAnswerReviews(k);};
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  const get=async(path:string)=>{const r=await fetch(asset(path),{signal:controller.signal});if(!r.ok)throw Error();return r.json();};
  for(const m of MODULES)void Promise.all([get(m.segmentedPath),get(m.answersPath),get(m.solutionsPath)]).then(([exam,keys,u])=>{if(active)setBundles(all=>({...all,[m.slug]:{exam,keys,solutions:u.solutions}}));}).catch(()=>{if(active)setModuleErrors(all=>({...all,[m.slug]:'Moduldaten konnten nicht geladen werden. Bitte neu laden.'}));});
  void refreshPersonal().then(()=>{if(active)setPersonalLoaded(true);}).catch(()=>{if(active)setError('Persönlicher Speicher konnte nicht geladen werden. Bitte neu laden.');});
  return()=>{active=false;controller.abort();};
 },[]);
 transition.current=async(next,push)=>{
  busyRef.current=true;setRouting(true);
  if(locationState.view==='review'){try{await refreshPersonal();}catch{setError('Persönlicher Speicher nicht lesbar.');setRouting(false);return;}}
  if(push)history.pushState(null,'',routeUrl(next,location.href));
  setLocationState(next);setRouting(false);window.scrollTo(0,0);
 };
 useEffect(()=>{const pop=()=>{const next=readRoute(location.search);if(busyRef.current)deferredRoute.current=next;else void transition.current(next,false);};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
 useEffect(()=>{if(!busy&&deferredRoute.current){const next=deferredRoute.current;deferredRoute.current=null;void transition.current(next,false);}},[busy,locationState]);
 useEffect(()=>{if(!busy&&!deferredRoute.current)history.replaceState(null,'',routeUrl(locationState,location.href));},[locationState,busy]);
 const navigate=(view:View,number=locationState.number,module=locationState.module)=>{if(busyRef.current)return;void transition.current({view,number,module,examId:MODULES.find(m=>m.slug===module)!.examId},true);};
 const config=MODULES.find(m=>m.slug===locationState.module)!;const bundle=bundles[config.slug];
 const exam=bundle?.exam;const keys=bundle?.keys;const solutions=bundle?.solutions??[];
 const original=exam?.questions.find(q=>q.question_number===locationState.number)??exam?.questions[0];
 useEffect(()=>{if(original&&original.question_number!==locationState.number&&!busy)setLocationState(s=>({...s,number:original.question_number}));},[original,locationState.number,busy]);
 const saveSession=async(s:LearningSession)=>{s={...s,updated_at:new Date().toISOString()};await repository.saveLearningSession(s);setSessions(all=>[...all.filter(v=>v.question_id!==s.question_id),s]);};
 const saveAttempt=async(a:Attempt,s:LearningSession)=>{s={...s,updated_at:new Date().toISOString()};await repository.saveAttempt(a,s);setAttempts(all=>[...all,a]);setSessions(all=>[...all.filter(v=>v.question_id!==s.question_id),s]);};
 const annotate=async(id:string,v:Pick<Attempt,'note'|'error_reason'|'unsure'|'confidence'>)=>{await repository.annotateAttempt('local',id,v);setAttempts(all=>all.map(a=>a.attempt_id===id?{...a,...v}:a));};
 if(error)return <main className="learning-main" role="alert">{error}</main>;
 const progress=moduleProgress(exam?.questions??[],attempts,sessions);
 const review=reviews.find(r=>r.question_id===original?.question_id);const current=original?effectiveQuestion(original,review):undefined;
 const base=keys?.answers.find(a=>a.question_id===original?.question_id);const answer=base?effectiveAnswer(base,answerReviews.find(r=>r.question_id===original?.question_id)) as OfficialAnswer:undefined;
 const solution=solutions.find(s=>s.question_id===original?.question_id);
 const currentPart=questionPart(config,original?.question_number??'');
 const moduleCards=(dashboard:boolean)=>MODULES.map(m=>{const b=bundles[m.slug];const p=moduleProgress(b?.exam.questions??[],attempts,sessions);return <section className="exam-card" key={m.slug}><span className="eyebrow">SOMMER 2017</span><h2>{m.title}</h2>{b?<><p>{p.practiced}/{b.exam.questions.length} Aufgaben bearbeitet · {p.attempts} Versuche</p><p className="hint">Letzte Aktivität: {p.lastActivity?new Date(p.lastActivity).toLocaleString('de-DE'):'Noch nicht begonnen'}</p>{dashboard?<button className="primary" disabled={busy||!personalLoaded} onClick={()=>navigate('study',p.resumeNumber,m.slug)}>Lernen fortsetzen · {m.title}</button>:<div className="part-cards">{moduleParts(m,b.exam.questions).map(part=><button key={part.title} disabled={busy||!personalLoaded||!part.questions.length} onClick={()=>navigate('study',part.questions[0].question_number,m.slug)}><strong>{part.title}</strong><span>{part.questions.length} {part.label}</span><small>{part.questions[0]?.question_number}–{part.questions.at(-1)?.question_number} →</small></button>)}</div>}</>:<p role={moduleErrors[m.slug]?'alert':'status'}>{moduleErrors[m.slug]??'Modul wird geladen…'}</p>}</section>;});
 return <div className="learning-root"><div className="learning-topbar"><button className="learning-brand" disabled={busy} onClick={()=>navigate('start')}>AP2 <span>lernen</span></button><nav aria-label="Hauptnavigation"><button disabled={busy} onClick={()=>navigate('start')} aria-current={locationState.view==='start'?'page':undefined}>Start / Dashboard</button><button disabled={busy} onClick={()=>navigate('exams')} aria-current={locationState.view==='exams'?'page':undefined}>Originalprüfungen</button></nav><span className="phase">Sommer 2017</span></div>
 <nav className="module-nav" aria-label="Module">{MODULES.map(m=><button key={m.slug} disabled={busy} aria-current={m.slug===config.slug?'true':undefined} onClick={()=>navigate(locationState.view,moduleProgress(bundles[m.slug]?.exam.questions??[],attempts,sessions).resumeNumber,m.slug)}>{m.title}</button>)}</nav>
 {locationState.view==='review'&&bundle&&personalLoaded?<div className="review-shell" inert={routing}><div className="mode-banner"><strong>Review Mode · {config.title} · Daten und Quellen prüfen</strong><button className="primary" disabled={busy} onClick={()=>navigate('study')}>Zurück zum Lernen</button></div><ReviewWorkspace key={config.slug} config={config} suppliedExam={bundle.exam} suppliedAnswerKey={bundle.keys} selectedNumber={locationState.number} onQuestionChange={number=>{const next={...locationState,number};history.replaceState(null,'',routeUrl(next,location.href));setLocationState(next);}} onBusy={setReviewBusy} uSolutions={solutions} onHome={()=>navigate('start')}/></div>:
 <main className="learning-main"><div className="breadcrumbs"><button disabled={busy} onClick={()=>navigate('exams')}>Originalprüfungen</button><span> / Sommer 2017 / {config.title}</span></div>
 {locationState.view==='start'?<><div className="eyebrow">DEIN LERNPLATZ</div><h1>Verstehen. Üben.<br/><span>Sicherer werden.</span></h1><p className="intro">Sommer 2017 · Zwei Module, dein eigener Fortschritt.</p><div className="module-cards">{moduleCards(true)}</div></>:
 locationState.view==='exams'?<><h1>Originalprüfungen</h1><h2>Sommer 2017</h2><div className="module-cards">{moduleCards(false)}</div></>:
 !bundle||!personalLoaded||!original||!current||!exam?<p role={moduleErrors[config.slug]?'alert':'status'}>{moduleErrors[config.slug]??'Lernbereich wird geladen…'}</p>:
 <><div className="learning-heading"><div><span className="eyebrow">SOMMER 2017 · {config.title}</span><h1>{currentPart?.title} · {currentPart?.label}</h1></div><span className="practice-label">Study Mode</span></div><nav className="part-nav" aria-label="Prüfungsteile">{moduleParts(config,exam.questions).map(part=><button key={part.title} disabled={busy||!part.questions.length} onClick={()=>navigate('study',part.questions[0].question_number)}>{part.title} · {part.questions.length} Aufgaben</button>)}</nav><nav className="learning-question-nav" aria-label="Aufgaben">{exam.questions.filter(q=>currentPart?.questionNumbers.includes(q.question_number)).map(q=><button disabled={busy} key={q.question_id} onClick={()=>navigate('study',q.question_number)} aria-label={`Aufgabe ${q.question_number}`} aria-current={q.question_id===current.question_id?'true':undefined} className={progress.done.has(q.question_id)?'completed':''}>{q.question_number}{progress.done.has(q.question_id)?' ✓':''}</button>)}</nav>
 <section className="reader"><div className="reader-head"><h2>Aufgabe {current.question_number}</h2><a className="outline" href={asset(current.source_pdf)+`#page=${current.source_page}`} target="_blank" rel="noreferrer">Original-PDF · Seite {current.source_page} ↗</a></div><div className="question-art"><CropImage question={current} edited={!!review&&JSON.stringify(current.regions)!==JSON.stringify(original.regions)}/></div>
 {solution&&<details><summary>Gemeinsame Aufgabenbeschreibung & Anlagen</summary><a href={asset(current.source_pdf)+`#page=${config.descriptionPage}`} target="_blank" rel="noreferrer">Aufgabenbeschreibung · Seite {config.descriptionPage} ↗</a>{config.attachmentPages.map(page=><p key={page}><a href={asset(current.source_pdf)+`#page=${page}`} target="_blank" rel="noreferrer">Anlage · Seite {page} ↗</a></p>)}</details>}
 {currentPart?.kind==='multi_part'&&!solution?<p role="alert">Offizielle U-Lösung fehlt. Keine Bewertung möglich.</p>:<Practice key={original.question_id} questionId={original.question_id} number={original.question_number} answer={answer} u={solution} session={sessions.find(s=>s.question_id===original.question_id)} history={attempts.filter(a=>a.question_id===original.question_id)} onSession={saveSession} onAttempt={saveAttempt} onAnnotate={annotate} onBusy={setBusy}/>}
 </section><div className="study-pagination"><button disabled={busy||exam.questions.indexOf(original)===0} onClick={()=>navigate('study',exam.questions[exam.questions.indexOf(original)-1].question_number)}>← Vorherige Aufgabe</button><button disabled={busy||exam.questions.indexOf(original)===exam.questions.length-1} onClick={()=>navigate('study',exam.questions[exam.questions.indexOf(original)+1].question_number)}>Nächste Aufgabe →</button></div></>}
 <footer className="learning-footer"><span>Sommer 2017 · {config.title} · Fortschritt bleibt auf diesem Gerät</span><button className="outline" disabled={busy||!bundle||!personalLoaded} onClick={()=>navigate('review')}>Review / Quellen</button><button className="outline" disabled={busy||!personalLoaded} onClick={()=>{const blob=new Blob([JSON.stringify({schema_version:1,attempts,sessions},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ap2-learning-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Lernfortschritt exportieren</button></footer>
 </main>}
 </div>;
}
