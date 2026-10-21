/** Public metadata gate. It has no personal-data repository and never rewrites history. */
export const SOURCE_STAGES=['registered','hash_verified','profile_matched','layout_validated','preview_ready','formal_segmented','answers_extracted','validated','production'] as const;
export type SourceStage=typeof SOURCE_STAGES[number];
export interface SourceEvidence {source_sha256:string;result:'passed';artifacts:Record<string,string>;[key:string]:unknown}
export interface RegisteredSource {source_id:string;exam:string;module:string;source_type:'question_pdf'|'solution_pdf';filename:string;sha256:string;version:number;status:SourceStage|'blocked';layout_profile:string|null;answer_profile:string|null;supersedes_source_id:string|null;created_at:string;gates:Partial<Record<SourceStage,SourceEvidence>>;identity_migration:null|{decision:string;evidence:Record<string,unknown>;dataset_bindings?:Record<string,{source_id:string;dataset_path:string;dataset_sha256:string;question_ids:string[]}>;predecessors?:Record<string,string>};[key:string]:unknown}
export interface SourceRegistry {schema_version:1;sources:RegisteredSource[]}
export interface ModuleIdentity {examId:string;slug:string;segmentedPath?:string;answersPath?:string;solutionsPath?:string}
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
function registryValue(value:unknown):SourceRegistry {
 const r=value as SourceRegistry;
 if(!r||r.schema_version!==1||!Array.isArray(r.sources)||r.sources.some(s=>!s||typeof s.source_id!=='string'||!hash(s.sha256)||!Number.isInteger(s.version)||s.version<1)||new Set(r.sources.map(s=>s.source_id)).size!==r.sources.length)throw Error('Ungültiges Quellenregister.');
 return r;
}
function firstFormalDataset(source:RegisteredSource,registry:SourceRegistry){
 const decision=source.identity_migration!;
 const prior=registry.sources.filter(s=>s.exam===source.exam&&s.module===source.module&&s.source_type===source.source_type&&s.version<source.version);
 const latest=[...prior].sort((a,b)=>b.version-a.version)[0];
 const proofs=decision.predecessors;const reviewer=decision.evidence?.reviewed_by;
 // Snapshot hashes are rehashed by the authoritative Python gate. Here check their
 // complete shape and every predecessor's retained formal-stage history.
 if(!latest||latest.source_id!==source.supersedes_source_id||source.version!==latest.version+1||latest.sha256===source.sha256||new Set(prior.map(s=>s.version)).size!==prior.length||prior.some(s=>SOURCE_STAGES.slice(5).some(stage=>Object.prototype.hasOwnProperty.call(s.gates??{},stage)))||typeof reviewer!=='string'||!reviewer.trim()||!proofs||Array.isArray(proofs)||Object.keys(proofs).length!==prior.length||prior.some(s=>!hash(proofs[s.source_id])))throw Error('Erster Datensatz ohne vollständige Vorgängerprüfung.');
 const gate=source.gates.validated!;const ids=gate.question_ids;
 const artifacts=Object.entries(gate.artifacts).filter(([path])=>path.endsWith('_segmented.json')).sort(([a],[b])=>Number(!a.startsWith('public/'))-Number(!b.startsWith('public/'))||a.localeCompare(b));
 const binding=decision.dataset_bindings?.new;const path=binding?.dataset_path;
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length||!artifacts.length||new Set(artifacts.map(([,sha])=>sha)).size!==1||Object.keys(decision.dataset_bindings??{}).length!==1||!binding||binding.source_id!==source.source_id||!hash(binding.dataset_sha256)||binding.dataset_sha256!==artifacts[0][1]||typeof path!=='string'||path!==artifacts[0][0]||/^(?:[a-z]:|[/\\])/i.test(path)||path.split(/[/\\]/).includes('..')||!Array.isArray(binding.question_ids)||binding.question_ids.some(id=>typeof id!=='string'||!id)||JSON.stringify([...binding.question_ids].sort())!==JSON.stringify([...ids].sort()))throw Error('Erster Datensatz ist nicht vollständig an validierte Daten gebunden.');
}
function validated(source:RegisteredSource,registry:SourceRegistry){
 if(source.profile_revision_of_source_id){
  const parent=registry.sources.find(s=>s.source_id===source.profile_revision_of_source_id);
  const proof=source.profile_confirmation as {proposal_hash?:string;proposal_path?:string;proposal_sha256?:string;confirmation_path?:string;confirmation_sha256?:string}|undefined;
  const events=parent?.events as {stage:string;proposal_hash?:string;evidence?:{sha256?:string;proposal_path?:string}}[]|undefined;
  const proposed=events?.find(e=>e.stage==='profile_revision_proposed'&&e.proposal_hash===proof?.proposal_hash);
  const confirmed=events?.find(e=>e.stage==='profile_revision_confirmed'&&e.proposal_hash===proof?.proposal_hash);
  if(!parent||parent.status!=='blocked'||parent.gates.formal_segmented||source.supersedes_source_id||source.version<=parent.version||['exam','module','source_type','filename','sha256'].some(k=>parent[k]!==source[k])||!proof||!hash(proof.proposal_hash)||!hash(proof.proposal_sha256)||!hash(proof.confirmation_sha256)||!proof.confirmation_path||proposed?.evidence?.proposal_path!==proof.proposal_path||proposed?.evidence?.sha256!==proof.proposal_sha256||confirmed?.evidence?.sha256!==proof.confirmation_sha256)throw Error('Profilrevision ohne unveränderte Quelle und bestätigte Prüfspur.');
 }
 if(!source.layout_profile||!source.answer_profile||!source.gates||SOURCE_STAGES.slice(1).some(stage=>{
  const e=source.gates[stage];return !e||e.source_sha256!==source.sha256||e.result!=='passed'||!e.artifacts||!Object.keys(e.artifacts).length||Object.entries(e.artifacts).some(([path,sha])=>!path||!hash(sha));
 }))throw Error('Die Prüfungsquelle hat nicht alle Freigaben.');
 if(source.supersedes_source_id){
  if(source.identity_migration?.decision==='first_formal_dataset'){firstFormalDataset(source,registry);return;}
  const old=registry.sources.find(s=>s.source_id===source.supersedes_source_id);const decision=source.identity_migration;const evidence=decision?.evidence;const ids=evidence?.old_question_ids as unknown[]|undefined;const next=evidence?.new_question_ids as unknown[]|undefined;const mapping=evidence?.mapping as Record<string,unknown>|undefined;
  if(!old||old.exam!==source.exam||old.module!==source.module||old.source_type!==source.source_type||old.sha256===source.sha256||source.version!==old.version+1||decision?.decision!=='preserve_ids'||!Array.isArray(ids)||!ids.length||!Array.isArray(next)||new Set(ids).size!==ids.length||new Set(next).size!==next.length||ids.length!==next.length||!mapping||Object.keys(mapping).length!==ids.length||ids.some(id=>typeof id!=='string'||!next.includes(id)||mapping[id]!==id)||!evidence?.reviewed_by)throw Error('Ersatzquelle ohne sichere Identitätsfreigabe.');
  for(const [role,s] of [['old',old],['new',source]] as const){
   const gate=s.gates.validated;const all=gate?.question_ids;const declared=role==='old'?ids:next;const binding=decision.dataset_bindings?.[role];
   const artifacts=Object.entries(gate?.artifacts??{}).filter(([path])=>path.endsWith('_segmented.json')).sort(([a],[b])=>Number(!a.startsWith('public/'))-Number(!b.startsWith('public/'))||a.localeCompare(b));
   const expectedPath=evidence?.[role+'_dataset_path']??artifacts[0]?.[0];
   if(!Array.isArray(all)||!all.length||all.some(id=>typeof id!=='string'||!id)||new Set(all).size!==all.length||declared.length!==all.length||declared.some(id=>!all.includes(id))||!artifacts.length||new Set(artifacts.map(([,sha])=>sha)).size!==1||!binding||binding.source_id!==s.source_id||binding.dataset_sha256!==artifacts[0][1]||binding.dataset_path!==expectedPath||JSON.stringify([...binding.question_ids].sort())!==JSON.stringify([...all].sort()))throw Error('Identitätsfreigabe deckt nicht beide validierten Datensätze vollständig ab.');
  }
 }
}
/** Selects latest fully approved versions; a pending replacement never hides the old source. */
export function moduleSources(value:unknown,module:ModuleIdentity):{question:RegisteredSource;solution:RegisteredSource}{
 const registry=registryValue(value);
 const select=(kind:RegisteredSource['source_type'])=>{
  const candidates=registry.sources.filter(s=>s.exam===module.examId&&s.module===module.slug&&s.source_type===kind&&s.status==='production').sort((a,b)=>b.version-a.version);
  if(!candidates.length||candidates.filter(s=>s.version===candidates[0].version).length!==1)throw Error('Dieses Modul ist nicht über das Quellenregister freigegeben.');
  const source=candidates[0];validated(source,registry);
  const paths=[module.segmentedPath,module.answersPath,module.solutionsPath].filter((p):p is string=>!!p);
  if(paths.some(path=>{const key=path.startsWith('public/')?path:'public/'+path;return !source.gates.validated!.artifacts[key]&&!source.gates.production!.artifacts[key];}))throw Error('Moduldateien stimmen nicht mit den validierten Quellen überein.');
  return structuredClone(source);
 };
 return {question:select('question_pdf'),solution:select('solution_pdf')};
}
export function assertProductionModule(registry:unknown,module:ModuleIdentity):void {moduleSources(registry,module);}
/** New records may snapshot this value; never recompute snapshots on existing records. */
export function sourceSnapshot(registry:unknown,module:ModuleIdentity){
 const {question,solution}=moduleSources(registry,module);
 return {question_source_id:question.source_id,solution_source_id:solution.source_id,question_source_sha256:question.sha256,solution_source_sha256:solution.sha256,source_revision:question.layout_profile!,official_answer_revision:typeof solution.gates.validated?.manual_confirmation_revision==='string'?solution.gates.validated.manual_confirmation_revision:solution.answer_profile!};
}
