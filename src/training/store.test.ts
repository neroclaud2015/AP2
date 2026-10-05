import 'fake-indexeddb/auto';
import {expect,test} from 'vitest';
import {IndexedDBProgressRepository} from '../storage/storage';
import {trainingDefinitionKey,validTrainingRun,validTrainingSnapshot,type TrainingDefinition,type TrainingQuestionSnapshot} from './model';
import type {Attempt} from '../learning/model';
import {MODULES} from '../learning/modules';
const definition:TrainingDefinition={knowledgeTopicIds:[],questionTypeIds:[],moduleIds:['ap'],examIds:[]};
const snapshot=(id='q'):TrainingQuestionSnapshot=>({question:{question_id:id,question_number:'1',exam:'2024_sommer',module:'Arbeitsplanung',segmentation_revision:'original',cropped_question_image:'original.png',source_pdf:'source.pdf',source_page_image:'page.png',source_page:1,source_size:[100,100],bounding_box:[0,0,100,100],regions:[[0,0,100,100]],extracted_text:'',tags:[]},config:{examId:'2024-sommer',slug:'arbeitsplanung',parts:[{id:'A',kind:'multiple_choice',questionNumbers:['1']}]},answer:{question_id:id,official_answer:2,parser_revision:'official-original'},solution:null,provenance:{question_source_revision:'inventory-original'}} as unknown as TrainingQuestionSnapshot);
const attempt=(id:string,q='q'):Attempt=>({userId:'u',attempt_id:id,question_id:q,timestamp:new Date().toISOString(),user_answer:{choice:1},correctness:'falsch',partial_status:false,unsure:false,confidence:'sure',hints_used:[],error_reason:'',note:'kept',self_assessed:false,auto_scored:true,subparts:[]});
const session=(q='q')=>({userId:'u',question_id:q,draft:{choice:'1'},revealed:true});
const repo=()=>new IndexedDBProgressRepository('training-'+crypto.randomUUID());
const uSnapshot=():TrainingQuestionSnapshot=>{const s=snapshot();return {...s,question:{...s.question,question_number:'U1'},config:{...s.config,parts:[{id:'B',title:'B',label:'U',kind:'multi_part',questionNumbers:['U1']}]},answer:null,solution:{question_id:'q',question_number:'U1',solution_source_pdf:'solution.pdf',solution_source_page:1,regions:[{source_page:1,bbox:[0,0,100,100]}],cropped_solution_image:'solution.png',review_status:'auto_ready',answer_type:'multi_part',extractor_revision:'solution-v1',subparts:[{id:'1',label:'Result',type:'numeric',numeric:{value:0,unit:'',tolerance:0}}]}};};
test('malformed U subparts and solution sources are rejected atomically during backup import',async()=>{
 const source=repo(),destination=repo();await source.startTraining('u',definition,[uSnapshot()]);const backup=await source.exportSnapshot('u');
 const damages:Array<(s:Record<string,unknown>)=>void>=[s=>{s.subparts=[null]},s=>{s.subparts=[{id:'1',label:'Result',type:'numeric'}]},s=>{s.subparts=[{id:'1',label:'Result',type:'unsupported'}]},s=>{s.subparts=[{id:'1',label:'A',type:'short_text'},{id:'1',label:'B',type:'drawing'}]},s=>{s.subparts=[{id:'1',label:'A',type:'numeric',numeric:{value:1,unit:'V',tolerance:-1}}]},s=>{s.subparts=[{id:'1',label:5,type:'diagram'}]},s=>{s.regions=[{source_page:0,bbox:[0,0,1,1]}]},s=>{s.regions=[{source_page:1,bbox:[0,0,0,1]}]},s=>{s.solution_source_page=0},s=>{s.solution_source_pdf=null},s=>{s.cropped_solution_image=''}];
 for(const damage of damages){const broken=structuredClone(backup);damage(broken.trainingRuns![0].snapshots.q.solution as unknown as Record<string,unknown>);await expect(destination.importSnapshot(broken,'u',false)).rejects.toThrow();expect(await destination.getTrainingRuns('u')).toEqual([]);}
 expect(validTrainingSnapshot(uSnapshot())).toBe(true);source.close();destination.close();
});
test('all published U solutions remain valid training snapshots',async()=>{
 const documents=import.meta.glob('../../public/data/*_{segmented,u_solutions}.json',{eager:true,import:'default'}) as Record<string,{questions?:TrainingQuestionSnapshot['question'][];solutions?:NonNullable<TrainingQuestionSnapshot['solution']>[]}>;let count=0;
 for(const config of MODULES){const questions=documents['../../public/'+config.segmentedPath].questions!,solutions=documents['../../public/'+config.solutionsPath].solutions!;for(const solution of solutions){const question=questions.find((q:{question_id:string})=>q.question_id===solution.question_id);expect(validTrainingSnapshot({question,config,answer:null,solution}),solution.question_id).toBe(true);count++;}}
 expect(count).toBeGreaterThan(250);
});
test('filter identity canonicalizes sets without delimiter collisions',()=>{
 expect(trainingDefinitionKey({...definition,moduleIds:['b','a','a']})).toBe(trainingDefinitionKey({...definition,moduleIds:['a','b']}));
 expect(trainingDefinitionKey({...definition,moduleIds:['a,b']})).not.toBe(trainingDefinitionKey({...definition,moduleIds:['a','b']}));
});
test('bank resume freezes inventory and source, restart retains prior history and stages snapshot each start',async()=>{
 const r=repo(),s=snapshot();let run=await r.startTraining('u',definition,[s]);s.question.cropped_question_image='changed.png';
 expect((await r.startTraining('u',definition,[])).snapshots.q.question.cropped_question_image).toBe('original.png');
 run=await r.saveTrainingDraft('u',run.run_id,run.revision,session());expect((await r.getTrainingRun('u',run.run_id))?.drafts.q.draft.choice).toBe('1');
 const fresh=await r.startTraining('u',definition,[snapshot('new')],{restart:true});expect(fresh.question_ids).toEqual(['new']);expect((await r.getTrainingRun('u',run.run_id))?.question_ids).toEqual(['q']);
 const stage=await r.startTraining('u',definition,[snapshot()],{stage:1}),stage2=await r.startTraining('u',definition,[snapshot('later')],{stage:1});expect(stage2.run_id).not.toBe(stage.run_id);expect((await r.startTraining('u',definition,[])).run_id).toBe(fresh.run_id);r.close();
});
test('training attempts stay outside module progress and ordinary drafts; stale saves and foreign deletion fail',async()=>{
 const r=repo();await r.saveLearningSession({...session(),draft:{choice:'5'}});let run=await r.startTraining('u',definition,[snapshot()]);const revision=run.revision;
 const saved=await r.saveTrainingAttempt('u',run.run_id,revision,attempt('a'),session());run=saved.run;
 expect(saved.attempt).toMatchObject({training_run_id:run.run_id,official_answer_snapshot:2,question_source_revision:'inventory-original'});
 expect((await r.getLearningSessions('u'))[0].draft.choice).toBe('5');expect((await r.getWrongQuestions('u'))[0].wrong_count).toBe(1);
 const p=await r.ensureModuleProgress('u',{exam:'2024-sommer',module:'arbeitsplanung',question_ids:['q']});expect(p.questionStates.q.state).toBe('unanswered');
 await expect(r.saveTrainingDraft('u',run.run_id,revision,session())).rejects.toThrow();
 const other=await r.startTraining('u',definition,[snapshot()],{restart:true});await expect(r.deleteTrainingAttempt('u',other.run_id,other.revision,'a')).rejects.toThrow();
 run=await r.deleteTrainingAttempt('u',run.run_id,run.revision,'a');expect(run.drafts.q).toMatchObject({draft:{},revealed:false});expect(await r.getAttempts('u')).toEqual([]);expect((await r.getModuleProgress('u'))[0]).toEqual(p);r.close();
});
test('backup includes local runs and remaps ownership without large sync envelopes; invalid references roll back',async()=>{
 const r=repo(),copy=repo(),bad=repo();let run=await r.startTraining('u',definition,[snapshot()]);run=(await r.saveTrainingAttempt('u',run.run_id,run.revision,attempt('a'),session())).run;
 const backup=await r.exportSnapshot('u');await copy.importSnapshot(backup,'different',true);expect((await copy.getTrainingRun('different',run.run_id))?.drafts.q.userId).toBe('different');expect((await copy.getOutbox('different')).some(x=>String(x.entity).startsWith('training'))).toBe(false);
 const invalid=structuredClone(backup);invalid.trainingRuns![0].attempt_ids.q=['missing'];await expect(bad.importSnapshot(invalid,'u',false)).rejects.toThrow();expect(await bad.getAttempts('u')).toEqual([]);expect(await bad.getTrainingRuns('u')).toEqual([]);
 r.close();copy.close();bad.close();
});
test('invalid crop, foreign module, duplicate membership and stale deletes cannot alter existing history',async()=>{
 const r=repo(),good=snapshot();const run=await r.startTraining('u',definition,[good]);
 for(const broken of [{...good,question:{...good.question,bounding_box:[0,0,0,0]}},{...good,config:{...good.config,slug:'wiso'}}])await expect(r.startTraining('u',definition,[broken as TrainingQuestionSnapshot],{restart:true})).rejects.toThrow();
 await expect(r.startTraining('u',definition,[good,good],{restart:true})).rejects.toThrow();
 const saved=await r.saveTrainingAttempt('u',run.run_id,run.revision,attempt('a'),session());await expect(r.deleteTrainingAttempt('u',run.run_id,run.revision,'a')).rejects.toThrow();expect((await r.getTrainingRun('u',run.run_id))?.revision).toBe(saved.run.revision);expect(await r.getAttempts('u')).toHaveLength(1);expect(await r.getTrainingRuns('u')).toHaveLength(1);r.close();
});


test('uncertainty entry and restart refresh snapshots without resuming or replacing bank progress',async()=>{
 const r=repo(),bank=await r.startTraining('u',definition,[snapshot('bank')]),progress=await r.getTrainingProgress('u');
 const source=snapshot('unsure');const first=await r.startTraining('u',definition,[source],{uncertainty:true});
 expect(first.kind).toBe('uncertainty');expect(first.stage).toBeUndefined();expect(validTrainingRun(first)).toBe(true);
 expect(validTrainingRun({...first,stage:1})).toBe(false);expect(validTrainingRun({...first,kind:'other'})).toBe(false);
 source.question.cropped_question_image='new-source.png';
 const restored=await r.getTrainingRun('u',first.run_id);expect(restored?.question_ids).toEqual(['unsure']);expect(restored?.snapshots.unsure.question.cropped_question_image).toBe('original.png');
 const second=await r.startTraining('u',definition,[snapshot('later')],{uncertainty:true});
 expect(second.run_id).not.toBe(first.run_id);expect(second.question_ids).toEqual(['later']);
 const restarted=await r.startTraining('u',definition,[snapshot('fresh')],{uncertainty:true,restart:true});
 expect(restarted.question_ids).toEqual(['fresh']);expect((await r.getTrainingRun('u',first.run_id))?.question_ids).toEqual(['unsure']);
 expect(await r.getTrainingProgress('u')).toEqual(progress);expect((await r.startTraining('u',definition,[])).run_id).toBe(bank.run_id);
 await expect(r.startTraining('u',definition,[],{uncertainty:true})).rejects.toThrow();
 await expect(r.startTraining('u',definition,[snapshot()],{uncertainty:true,stage:1})).rejects.toThrow();r.close();
});


test('uncertainty runs round-trip backups without creating bank progress',async()=>{
 const source=repo(),copy=repo();const run=await source.startTraining('u',definition,[snapshot()],{uncertainty:true});
 await source.saveTrainingDraft('u',run.run_id,run.revision,session());
 await copy.importSnapshot(await source.exportSnapshot('u'),'copy',true);
 const restored=await copy.getTrainingRun('copy',run.run_id);
 expect(restored?.kind).toBe('uncertainty');expect(restored?.question_ids).toEqual(['q']);expect(restored?.drafts.q.draft).toEqual({choice:'1'});
 expect(await copy.getTrainingProgress('copy')).toEqual([]);expect(await source.getTrainingProgress('u')).toEqual([]);source.close();copy.close();
});
