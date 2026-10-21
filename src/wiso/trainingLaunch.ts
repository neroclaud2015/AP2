import {trainingDefinitionKey,type TrainingDefinition,type TrainingProgress,type TrainingRun} from '../training/model';
export const wisoTrainingDefinition=(topicId:string):TrainingDefinition=>({knowledgeTopicIds:[],questionTypeIds:[],moduleIds:['wiso'],examIds:[],wisoTopicIds:[topicId]});
export function resumableWisoRun(topicId:string,progress:TrainingProgress[],runs:TrainingRun[]){
 const key=trainingDefinitionKey(wisoTrainingDefinition(topicId)),record=progress.find(p=>p.definition_key===key);
 return record?runs.find(r=>r.run_id===record.run_id&&r.definition_key===key&&r.kind==='bank'):undefined;
}
