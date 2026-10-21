import type {WisoSummary} from './model';
import {knowledgeStillCurrent} from './knowledgeValidity';
import KnowledgeHistory from './KnowledgeHistory';

export function MemoryNotes({summary}:{summary?:WisoSummary}){
 const available=summary?.knowledge&&knowledgeStillCurrent(summary.knowledge),bullets=available?summary.bullets:[];
 return <section className="wiso-review-card wiso-memory-notes"><span className="eyebrow">MERKWISSEN</span><h2>Das merkst du dir</h2>{bullets?.length?<ul>{bullets.map(b=><li key={b}>{b}</li>)}</ul>:<p>Aktuelle Merksätze werden noch geprüft. Historische Hinweise sind keine aktuelle Rechtsregel.</p>}<p className="hint">{summary?.knowledge?.status==='current'&&available?`Verifizierter Wissensstand · ${summary.legal_freshness.reviewed_at??summary.knowledge.as_of}`:summary?.legal_freshness.relevant?'Aktualitätsprüfung offen':'Zusammenfassung historischer Prüfungsthemen'} · Lernhilfe, keine offizielle Prüfungsantwort.</p></section>;
}
export function KnowledgeSources({summary}:{summary?:WisoSummary}){
 if(!summary)return null;
 const legal=summary.legal_freshness as typeof summary.legal_freshness&{references?:{title:string;url:string}[]};
 return <details className="wiso-secondary"><summary>Historischer Stand & Quellen</summary><p>Originalaufgaben und offizielle Antworten bleiben im damaligen Prüfungsjahr. Häufigkeit entscheidet nicht über heutige Rechtsgültigkeit.</p><KnowledgeHistory knowledge={summary.knowledge} historical={summary.historical_bullets}/><div className="wiso-evidence">{legal.references?.map(r=><a key={r.url} href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a>)}</div></details>;
}
