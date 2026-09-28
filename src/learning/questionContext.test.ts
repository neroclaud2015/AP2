import {it,expect} from 'vitest';
import {contextPagesForQuestion} from './questionContext';
const config={descriptionPage:19,attachmentPages:[8,29,30],questionContextPages:{'13':[8],'14':[8],'15':[8],U2:[19,29],U7:[19,30]}};
it('makes FA13-15 shared source available for study and exam without leaking unrelated attachments',()=>{for(const n of ['13','14','15'])expect(contextPagesForQuestion(config,n,false)).toEqual([8]);expect(contextPagesForQuestion(config,'12',false)).toEqual([]);expect(contextPagesForQuestion(config,'U2',true)).toEqual([19,29]);});
it('preserves legacy U and all-question attachment behavior',()=>{const legacy={descriptionPage:9,attachmentPages:[13]};expect(contextPagesForQuestion(legacy,'U1',true)).toEqual([9,13]);expect(contextPagesForQuestion(legacy,'1',false)).toEqual([]);expect(contextPagesForQuestion({...legacy,sharedContextForAllQuestions:true},'1',false)).toEqual([9,13]);});
