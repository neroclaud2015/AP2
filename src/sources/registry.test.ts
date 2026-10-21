import {describe,it,expect} from 'vitest';
import registry from '../../public/data/source_registry.json';
import {moduleSources,assertProductionModule,sourceSnapshot,type SourceRegistry} from './registry';

function firstFormalFixture(){
 const copy=structuredClone(registry) as unknown as SourceRegistry;
 const old=copy.sources.find(s=>s.exam==='2017-sommer'&&s.module==='arbeitsplanung'&&s.source_type==='question_pdf')!;
 const replacement=structuredClone(old);replacement.source_id='first-formal';replacement.version=3;replacement.sha256='b'.repeat(64);
 for(const gate of Object.values(replacement.gates))gate!.source_sha256=replacement.sha256;
 old.status='blocked';old.gates={};
 const prior=structuredClone(old);prior.source_id='second-predecessor';prior.version=2;prior.sha256='c'.repeat(64);prior.supersedes_source_id=old.source_id;
 replacement.supersedes_source_id=prior.source_id;
 const [path,sha]=Object.entries(replacement.gates.validated!.artifacts).find(([path])=>path.endsWith('_segmented.json'))!;
 replacement.identity_migration={decision:'first_formal_dataset',evidence:{reviewed_by:'human'},dataset_bindings:{new:{source_id:replacement.source_id,dataset_path:path,dataset_sha256:sha,question_ids:[...(replacement.gates.validated!.question_ids as string[])]}}};
 Object.assign(replacement.identity_migration,{predecessors:{[old.source_id]:'d'.repeat(64),[prior.source_id]:'e'.repeat(64)}});
 copy.sources.push(prior,replacement);
 return {copy,old,prior,replacement};
}

describe('first formal dataset replacement',()=>{
 const identity={examId:'2017-sommer',slug:'arbeitsplanung'};
 it('accepts a reviewed complete first dataset with all never-formal predecessors',()=>{
  const {copy}=firstFormalFixture();expect(moduleSources(copy,identity).question.source_id).toBe('first-formal');
 });
 it.each(['formal_segmented','answers_extracted','validated','production'] as const)('rejects historical %s even on a blocked older predecessor',stage=>{
  const {copy,old,replacement}=firstFormalFixture();old.gates[stage]=replacement.gates[stage];expect(()=>moduleSources(copy,identity)).toThrow();
 });
 it.each(['missing-proof','extra-proof','bad-proof','missing-review','wrong-parent','wrong-version','wrong-module','wrong-type','wrong-exam','wrong-hash','wrong-path','absolute-path','traversal-path','wrong-source','partial-ids','duplicate-ids','empty-ids','extra-binding'])('rejects %s',kind=>{
  const {copy,old,prior,replacement}=firstFormalFixture();const decision=replacement.identity_migration!;const proofs=(decision as unknown as {predecessors:Record<string,string>}).predecessors;const binding=decision.dataset_bindings!.new;
  if(kind==='missing-proof')delete proofs[old.source_id];
  if(kind==='extra-proof')proofs.unknown='a'.repeat(64);
  if(kind==='bad-proof')proofs[old.source_id]='not-a-hash';
  if(kind==='missing-review')decision.evidence.reviewed_by=' ';
  if(kind==='wrong-parent')replacement.supersedes_source_id=old.source_id;
  if(kind==='wrong-version')replacement.version=4;
  if(kind==='wrong-module')prior.module='wiso';
  if(kind==='wrong-type')prior.source_type='solution_pdf';
  if(kind==='wrong-exam')prior.exam='2099-sommer';
  if(kind==='wrong-hash')binding.dataset_sha256='a'.repeat(64);
  if(kind==='wrong-path')binding.dataset_path='public/data/other_segmented.json';
  if(kind==='absolute-path'||kind==='traversal-path'){
   const path=kind==='absolute-path'?'C:/data/test_segmented.json':'../test_segmented.json';
   replacement.gates.validated!.artifacts={[path]:binding.dataset_sha256};binding.dataset_path=path;
  }
  if(kind==='wrong-source')binding.source_id=old.source_id;
  if(kind==='partial-ids')binding.question_ids.pop();
  if(kind==='duplicate-ids')binding.question_ids.push(binding.question_ids[0]);
  if(kind==='empty-ids')replacement.gates.validated!.question_ids=binding.question_ids=[];
  if(kind==='extra-binding')decision.dataset_bindings!.old={...binding};
  expect(()=>moduleSources(copy,identity)).toThrow();
 });
});
describe('production source registry',()=>{
 it('includes six accepted historical modules with immutable source snapshots',()=>{
  for(const examId of ['2017-sommer','2017-18-winter'])for(const slug of ['arbeitsplanung','funktionsanalyse','wiso']){
   const sources=moduleSources(registry,{examId,slug});expect(sources.question.sha256).toMatch(/^[a-f0-9]{64}$/);expect(sources.solution.source_type).toBe('solution_pdf');expect(sourceSnapshot(registry,{examId,slug}).official_answer_revision).toBeTruthy();
  }
 });
 it('rejects unregistered and nonproduction modules',()=>{
  expect(()=>assertProductionModule(registry,{examId:'2099-sommer',slug:'arbeitsplanung'})).toThrow();
  const copy=structuredClone(registry);for(const s of copy.sources)if(s.exam==='2017-sommer')s.status='registered';
  expect(()=>assertProductionModule(copy,{examId:'2017-sommer',slug:'arbeitsplanung'})).toThrow();
 });
 it('rejects omitted or hash-mismatched gates',()=>{
  const copy=structuredClone(registry);const s=copy.sources.find(s=>s.exam==='2017-sommer'&&s.module==='arbeitsplanung')!;s.gates.validated!.source_sha256='b'.repeat(64);
  expect(()=>moduleSources(copy,{examId:'2017-sommer',slug:'arbeitsplanung'})).toThrow();
 });
 it('binds supplied production data paths to the validated evidence',()=>{
  expect(()=>moduleSources(registry,{examId:'2017-sommer',slug:'arbeitsplanung',segmentedPath:'data/2017_18_winter_arbeitsplanung_segmented.json'})).toThrow();
  expect(()=>moduleSources(registry,{examId:'2017-sommer',slug:'arbeitsplanung',segmentedPath:'data/2017_sommer_arbeitsplanung_segmented.json'})).not.toThrow();
 });
 it('rejects partial replacement maps and accepts complete dataset-bound maps',()=>{
  const copy=structuredClone(registry) as unknown as SourceRegistry;const old=copy.sources.find(s=>s.exam==='2017-sommer'&&s.module==='arbeitsplanung'&&s.source_type==='question_pdf')!;
  const replacement=structuredClone(old);replacement.source_id='replacement';replacement.version=2;replacement.sha256='b'.repeat(64);replacement.supersedes_source_id=old.source_id;
  for(const gate of Object.values(replacement.gates))gate!.source_sha256=replacement.sha256;
  const ids=old.gates.validated!.question_ids as string[];
  const binding=(s:typeof old)=>{const [path,sha]=Object.entries(s.gates.validated!.artifacts).find(([path])=>path.endsWith('_segmented.json'))!;return {source_id:s.source_id,dataset_path:path,dataset_sha256:sha,question_ids:[...ids].sort()};};
  replacement.identity_migration={decision:'preserve_ids',evidence:{old_question_ids:[ids[0]],new_question_ids:[ids[0]],mapping:{[ids[0]]:ids[0]},reviewed_by:'human'},dataset_bindings:{old:binding(old),new:binding(replacement)}};copy.sources.push(replacement);
  expect(()=>moduleSources(copy,{examId:'2017-sommer',slug:'arbeitsplanung'})).toThrow(/vollständig/);
  replacement.identity_migration.evidence={old_question_ids:ids,new_question_ids:ids,mapping:Object.fromEntries(ids.map(id=>[id,id])),reviewed_by:'human'};
  expect(moduleSources(copy,{examId:'2017-sommer',slug:'arbeitsplanung'}).question.source_id).toBe('replacement');
  replacement.identity_migration.dataset_bindings!.new.dataset_sha256='c'.repeat(64);
  expect(()=>moduleSources(copy,{examId:'2017-sommer',slug:'arbeitsplanung'})).toThrow(/vollständig/);
 });
 it('returns a copy rather than mutable registry entries',()=>{
  const q=moduleSources(registry,{examId:'2017-sommer',slug:'arbeitsplanung'}).question;q.sha256='changed';expect(moduleSources(registry,{examId:'2017-sommer',slug:'arbeitsplanung'}).question.sha256).not.toBe('changed');
 });
});

it('uses final production evidence for reviewed crops without replacing validated evidence',()=>{
 const copy=structuredClone(registry) as unknown as SourceRegistry;
 const before=JSON.stringify(copy.sources.map(s=>s.gates.validated));
 for(const s of copy.sources.filter(s=>s.exam==='2017-sommer'&&s.module==='arbeitsplanung'))s.gates.production!.artifacts['public/data/reviewed_u_solutions.json']='a'.repeat(64);
 expect(()=>moduleSources(copy,{examId:'2017-sommer',slug:'arbeitsplanung',solutionsPath:'data/reviewed_u_solutions.json'})).not.toThrow();
 expect(JSON.stringify(copy.sources.map(s=>s.gates.validated))).toBe(before);
 expect(()=>moduleSources(copy,{examId:'2017-sommer',slug:'arbeitsplanung',solutionsPath:'data/unreviewed.json'})).toThrow();
});

it('requires a confirmed, never-segmented parent for processing revisions',()=>{
 const original=structuredClone(registry) as unknown as SourceRegistry;
 const identity={examId:'2020-sommer',slug:'arbeitsplanung'};
 const selected=moduleSources(original,identity).question;
 expect(selected.profile_revision_of_source_id).toBeTruthy();
 for(const kind of ['missing-parent','formal-parent','missing-proof','wrong-hash']){
  const copy=structuredClone(original);const child=copy.sources.find(s=>s.source_id===selected.source_id)!;
  const parent=copy.sources.find(s=>s.source_id===child.profile_revision_of_source_id)!;
  if(kind==='missing-parent')copy.sources=copy.sources.filter(s=>s!==parent);
  if(kind==='formal-parent')parent.gates.formal_segmented=child.gates.formal_segmented;
  if(kind==='missing-proof')delete child.profile_confirmation;
  if(kind==='wrong-hash')parent.sha256='0'.repeat(64);
  expect(()=>moduleSources(copy,identity)).toThrow(/Profilrevision/);
 }
});
