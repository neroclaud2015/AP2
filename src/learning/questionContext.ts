export interface QuestionContext {descriptionPage:number;attachmentPages:number[];sharedContextForAllQuestions?:boolean;questionContextPages?:Record<string,number[]>}
export function contextPagesForQuestion(config:QuestionContext,number:string,openQuestion:boolean):number[]{
 if(config.questionContextPages)return [...new Set(config.questionContextPages[number]??[])];
 return openQuestion||config.sharedContextForAllQuestions?[...new Set([config.descriptionPage,...config.attachmentPages].filter(p=>p>0))]:[];
}
