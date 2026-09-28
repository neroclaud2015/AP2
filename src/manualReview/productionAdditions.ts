import {assertProductionModule,type SourceRegistry,type ModuleIdentity} from '../sources/registry';
export function productionAdditions<T extends ModuleIdentity>(registry:SourceRegistry|unknown,configured:T[],existing:ModuleIdentity[]):T[]{
 const sources=(registry as SourceRegistry).sources,seen=new Set(existing.map(m=>`${m.examId}/${m.slug}`));
 return configured.filter(m=>['question_pdf','solution_pdf'].every(kind=>sources.some(s=>s.exam===m.examId&&s.module===m.slug&&s.source_type===kind&&s.status==='production'))).map(m=>{const id=`${m.examId}/${m.slug}`;if(seen.has(id))throw Error('Duplicate promoted module identity');assertProductionModule(registry,m);seen.add(id);return m});
}
