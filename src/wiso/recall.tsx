import type {WisoSummary} from './model';
import {knowledgeStillCurrent} from './knowledgeValidity';
export interface RecallCard {id:string;topic_id:string;question:string;answer:string;question_ids:string[];knowledge_version_id:string;verified_at:string;references:{title:string;url:string}[]}
export function eligibleRecallCards(cards:RecallCard[],summary:WisoSummary|undefined,today=new Date().toISOString().slice(0,10)){
 if(!summary?.knowledge||!knowledgeStillCurrent(summary.knowledge,today))return [];
 return cards.filter(c=>c.topic_id===summary.topic_id&&c.knowledge_version_id===summary.knowledge?.current_version_id&&c.verified_at<=today&&!!c.answer.trim()&&c.question_ids.length>0&&c.question_ids.every(id=>summary.question_ids.includes(id))&&c.references.length>0);
}
/** Deliberately has no repository, state setters or learning-event callbacks. */
export function RecallQuestions({cards}:{cards:RecallCard[]}){
 return <section className="wiso-recall"><h2>Typische Fragen</h2><p className="hint">Zum Aufdecken anklicken · reine Wiederholung, kein Prüfungsversuch.</p>{cards.length?cards.map(c=><details className="wiso-qa" key={c.id}><summary>{c.question}</summary><div><strong>Antwort</strong><p>{c.answer}</p><p className="hint">Lernkarte aus {c.question_ids.length} historischen Aufgaben · geprüft am {c.verified_at}</p><div className="wiso-evidence">{c.references.map(r=><a key={r.url} href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a>)}</div></div></details>):<p>Für dieses Thema sind noch keine aktuellen, verifizierten Antwortkarten freigegeben.</p>}</section>;
}
