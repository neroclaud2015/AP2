import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=await createServer({root,server:{middlewareMode:true},appType:'custom'});
const read=async file=>JSON.parse(await readFile(resolve(root,file),'utf8'));
const optional=async(file,fallback)=>{try{return await read(file);}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
const write=async(file,value)=>{const path=resolve(root,file),next=JSON.stringify(value,null,2)+'\n';let old;try{old=await readFile(path,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}if(old!==next)await writeFile(path,next);};
try{
 const {MODULES,examLabel}=await server.ssrLoadModule('/src/learning/modules.ts');
 const {reconcileClassifications,classificationCounts,parseClassificationOverrides,validateTaxonomy}=await server.ssrLoadModule('/src/bank/model.ts');
 const {sourceSnapshot}=await server.ssrLoadModule('/src/sources/registry.ts');const registry=await read('public/data/source_registry.json');
 const taxonomy=await read('public/data/taxonomy.json');validateTaxonomy(taxonomy);const inventory=[];
 for(const module of MODULES){const provenance=sourceSnapshot(registry,module);const segmented=await read(`public/${module.segmentedPath}`);for(const q of segmented.questions){const part=module.parts.find(p=>p.questionNumbers.includes(q.question_number));if(!part)throw new Error(`Question outside production parts: ${q.question_id}`);
 const revision=createHash('sha256').update(JSON.stringify({document_revision:segmented.segmentation_revision,source_sha256:provenance.question_source_sha256,source_id:provenance.question_source_id,profile_revision:provenance.source_revision,question:q})).digest('hex');
 inventory.push({question_id:q.question_id,examId:module.examId,examLabel:examLabel(module.examId),module:module.slug,moduleTitle:module.title,number:q.question_number,kind:part.kind,crop:q.cropped_question_image,text:q.extracted_text??'',extraction_confidence:q.extraction_confidence??0,question_source_revision:revision});}}
 if(new Set(inventory.map(q=>q.question_id)).size!==inventory.length)throw new Error('Duplicate production question IDs');
 const previous=await optional('public/data/question_classifications.json',[]);const overridesFile=await optional('public/data/classification_overrides.json',{schema_version:1,classifications:[]});
 const overrides=parseClassificationOverrides(overridesFile,taxonomy,inventory,{allowStale:true,allowOrphans:true});const combined=new Map(previous.map(c=>[c.question_id,c]));for(const c of overrides){const prior=combined.get(c.question_id);const confirmedValues=x=>JSON.stringify([x.question_source_revision,x.knowledge_topic_ids,x.primary_question_type_id,x.secondary_question_type_ids,x.source,x.confidence,x.taxonomy_version,x.locked]);if(!prior||confirmedValues(prior)!==confirmedValues(c))combined.set(c.question_id,c);}
 const classifications=reconcileClassifications(inventory,[...combined.values()],taxonomy,new Date().toISOString());
 await write('public/data/question_inventory.json',inventory);await write('public/data/question_classifications.json',classifications);
 const coverage={schema_version:1,taxonomy_version:taxonomy.version,modules:MODULES.length,exams:[...new Set(inventory.map(q=>q.examId))],...classificationCounts(inventory,classifications),by_module:MODULES.map(m=>({examId:m.examId,module:m.slug,...classificationCounts(inventory.filter(q=>q.examId===m.examId&&q.module===m.slug),classifications)}))};
 await write('public/data/classification_coverage.json',coverage);console.log(JSON.stringify({modules:coverage.modules,total:coverage.total,knowledgeClassified:coverage.knowledgeClassified,typeClassified:coverage.typeClassified,unclassified:coverage.unclassified,review:coverage.review}));
}finally{await server.close();}
