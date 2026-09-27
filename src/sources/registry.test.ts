import {describe,it,expect} from 'vitest';
import registry from '../../public/data/source_registry.json';
import {moduleSources,assertProductionModule,sourceSnapshot,type SourceRegistry} from './registry';
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
