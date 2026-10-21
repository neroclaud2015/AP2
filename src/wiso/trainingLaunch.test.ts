import {it,expect} from 'vitest';
import {resumableWisoRun,wisoTrainingDefinition} from './trainingLaunch';
import {trainingDefinitionKey,type TrainingRun,type TrainingProgress} from '../training/model';
const key=trainingDefinitionKey(wisoTrainingDefinition('topic'));
const run=(id:string,definitionKey=key)=>({run_id:id,kind:'bank',definition_key:definitionKey,question_ids:['saved-question']} as TrainingRun);
const progress=[{definition_key:key,run_id:'current'}] as TrainingProgress[];
it('resumes only the current progress pointer with the exact topic definition',()=>{const current=run('current');expect(resumableWisoRun('topic',progress,[run('previous'),current])).toBe(current);expect(resumableWisoRun('other',progress,[current])).toBeUndefined();expect(resumableWisoRun('topic',[],[current])).toBeUndefined();expect(resumableWisoRun('topic',progress,[run('previous')])).toBeUndefined()});
