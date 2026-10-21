import {expect,test} from 'vitest';
import {canonicalTrainingDefinition,trainingDefinitionKey} from './model';
const definition={knowledgeTopicIds:['b','a','a'],questionTypeIds:[],moduleIds:['wiso'],examIds:[]};
test('legacy key stays byte-for-byte identical when WiSo topics omitted or empty',()=>{
 const golden='{"knowledgeTopicIds":["a","b"],"questionTypeIds":[],"moduleIds":["wiso"],"examIds":[]}';
 expect(trainingDefinitionKey(definition)).toBe(golden);expect(trainingDefinitionKey({...definition,wisoTopicIds:[]})).toBe(golden);
});
test('WiSo namespace is canonical and cannot collide with knowledge filters',()=>{
 const d={...definition,wisoTopicIds:['z','a','z']};expect(canonicalTrainingDefinition(d).wisoTopicIds).toEqual(['a','z']);expect(trainingDefinitionKey(d)).toBe(trainingDefinitionKey({...d,wisoTopicIds:['a','z']}));expect(trainingDefinitionKey(d)).not.toBe(trainingDefinitionKey(definition));expect(d.wisoTopicIds).toEqual(['z','a','z']);expect(()=>canonicalTrainingDefinition({...definition,wisoTopicIds:['']})).toThrow();
});
