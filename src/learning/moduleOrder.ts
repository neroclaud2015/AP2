import releaseDecisions from '../../public/data/source_release_decisions.json';
import registry from '../../public/data/source_registry.json';
import type {ModuleConfig} from './modules';
export const MODULE_ORDER:Record<string,number>={arbeitsplanung:10,funktionsanalyse:20,wiso:30};
export const MODULE_CATALOG=[{slug:'arbeitsplanung',title:'Arbeitsplanung'},{slug:'funktionsanalyse',title:'Funktionsanalyse'},{slug:'wiso',title:'WiSo'}].sort((a,b)=>MODULE_ORDER[a.slug]-MODULE_ORDER[b.slug]);
export function moduleEntries(modules:ModuleConfig[],examId?:string){
 return MODULE_CATALOG.map(entry=>{
  const config=modules.find(m=>m.slug===entry.slug&&(!examId||m.examId===examId));
  const sources=registry.sources.filter(s=>s.exam===examId&&s.module===entry.slug&&s.status==='blocked');
  const missing=sources.some(s=>JSON.stringify(s.events).match(/missing|fehlend|Stückliste/i));
  const decision=releaseDecisions.decisions.find(d=>d.examId===examId&&d.module===entry.slug);
  const reason=decision?.status==='source_accepted_pending_extraction'?'Quellenhinweis akzeptiert · Aufbereitung ausstehend':decision?.status==='deferred_missing_source'?'Originalaufgaben fehlen · vorerst zurückgestellt':missing?'Fehlende Stückliste / Anlage':undefined;
  return {...entry,config,reason:!config?reason:undefined};
 });
}
