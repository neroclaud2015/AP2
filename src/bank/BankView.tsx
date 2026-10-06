import {useEffect,useState} from 'react';
import {examSessions} from '../learning/examRegistry';
import {MODULE_ORDER} from '../learning/moduleOrder';
import {filterInventory,type InventoryQuestion} from './model';
import {useBankData} from './useBankData';
import {trainingDefinitionKey,type TrainingDefinition,type TrainingProgress} from '../training/model';
import {useAppServices} from '../services/context';
import './bank.css';
export interface TrainingLaunch {definition:TrainingDefinition;questions:InventoryQuestion[];stage?:1|2|3|'mastered';restart?:boolean;uncertainty?:boolean}
export default function BankView({onStart,disabled=false,initialModule}:{onStart:(input:TrainingLaunch)=>Promise<void>;disabled?:boolean;initialModule?:string}){
 const {data,error}=useBankData(),{repository,user}=useAppServices();
 const [progress,setProgress]=useState<TrainingProgress[]>([]);
 useEffect(()=>{let active=true;void repository.getTrainingProgress(user.id).then(p=>{if(active)setProgress(p)}).catch(e=>{if(active)setLaunchError(String(e))});return()=>{active=false}},[repository,user.id]);
 const [topic,setTopic]=useState(''),[type,setType]=useState(''),[module,setModule]=useState(initialModule??''),[year,setYear]=useState(''),[launchError,setLaunchError]=useState(''),[launching,setLaunching]=useState(false);
 if(error)return <p role="alert">{error}</p>;if(!data)return <p role="status">Aufgabenbank wird geladen…</p>;
 const taxonomy=data.taxonomy.nodes.filter(n=>n.active),knowledge=taxonomy.filter(n=>n.kind==='knowledge'),types=taxonomy.filter(n=>n.kind==='question_type');
 const modules=[...new Map(data.inventory.map(q=>[q.module,q.moduleTitle])).entries()].sort((a,b)=>(MODULE_ORDER[a[0]]??100)-(MODULE_ORDER[b[0]]??100)||a[1].localeCompare(b[1]));
 const filters={knowledgeTopicIds:topic?[topic]:[],questionTypeIds:type?[type]:[],modules:module?[module]:[],examIds:year?[year]:[]};
 const results=filterInventory(data.inventory,data.classifications,filters,data.taxonomy);
 const definition={knowledgeTopicIds:filters.knowledgeTopicIds,questionTypeIds:filters.questionTypeIds,moduleIds:filters.modules,examIds:filters.examIds};
 const existing=progress.find(p=>p.definition_key===trainingDefinitionKey(definition));
 const start=async()=>{setLaunching(true);setLaunchError('');try{await onStart({definition,questions:results});}catch(e){setLaunchError(String(e));}finally{setLaunching(false);}};
 const stats=(kind:'knowledge'|'question_type')=>{const nodes=taxonomy.filter(n=>n.kind===kind).map(node=>({node,count:filterInventory(results,data.classifications,kind==='knowledge'?{knowledgeTopicIds:[node.id]}:{questionTypeIds:[node.id]},data.taxonomy).length})).filter(x=>x.count>0);const max=Math.max(1,...nodes.map(x=>x.count));return <section className="bank-stat"><h2>{kind==='knowledge'?'Wissensgebiete':'Aufgabentypen'}</h2><div className="bank-stat-rows">{nodes.map(({node,count})=><button className="bank-stat-row" key={node.id} onClick={()=>kind==='knowledge'?setTopic(topic===node.id?'':node.id):setType(type===node.id?'':node.id)} aria-pressed={kind==='knowledge'?topic===node.id:type===node.id}><span>{node.label}</span><strong>{count}</strong><span className="bank-bar" style={{width:`${count/max*100}%`}}/></button>)}</div>{!nodes.length&&<p>Noch keine Zuordnung für diese Auswahl.</p>}</section>};
 return <section className="bank bank-landing"><span className="eyebrow">DEIN AUFGABENVORRAT</span><h1>Aufgabenbank</h1><p>Wähle, was du üben möchtest. Gleiche Auswahl? Dein Training geht dort weiter, wo du aufgehört hast.</p>
 <nav className="bank-modules" aria-label="Modul wählen"><button className={!module?'primary':'outline'} aria-pressed={!module} onClick={()=>setModule('')}>Alle</button>{modules.map(([id,label])=><button key={id} className={module===id?'primary':'outline'} aria-pressed={module===id} onClick={()=>setModule(id)}>{label}</button>)}</nav>
 <div className="bank-filters"><label>Wissensgebiet<select aria-label="Wissensgebiet" value={topic} onChange={e=>setTopic(e.target.value)}><option value="">Alle Wissensgebiete</option>{knowledge.map(n=><option key={n.id} value={n.id}>{n.parent_id?'↳ ':''}{n.label}</option>)}</select></label><label>Aufgabentyp<select aria-label="Aufgabentyp" value={type} onChange={e=>setType(e.target.value)}><option value="">Alle Aufgabentypen</option>{types.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label>Modul<select aria-label="Modul" value={module} onChange={e=>setModule(e.target.value)}><option value="">Alle Module</option>{modules.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Jahrgang<select aria-label="Jahrgang" value={year} onChange={e=>setYear(e.target.value)}><option value="">Alle Jahre</option>{examSessions(data.inventory).map(y=><option key={y.id} value={y.id}>{y.label}</option>)}</select></label></div>
 <div className="bank-launch"><div><strong data-testid="bank-count">{results.length} Aufgaben gefunden</strong><p>Originalaufgaben · eigener Trainingsfortschritt</p></div><button className="primary" disabled={disabled||launching||(!results.length&&!existing)} onClick={()=>void start()}>{launching?'Training wird geöffnet…':existing?'Training fortsetzen':'Training starten'}</button></div>
 {launchError&&<p role="alert">{launchError}</p>}<p className="hint">Automatische Zuordnungen helfen beim Filtern. Ohne Filter sind auch noch nicht klassifizierte Aufgaben enthalten.</p><div className="bank-statistics">{stats('knowledge')}{stats('question_type')}</div></section>;
}
