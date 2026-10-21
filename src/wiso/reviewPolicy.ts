import type {WisoClassification,WisoSummary} from './model';
import {knowledgeStillCurrent} from './knowledgeValidity';
export function retainLegalConcerns(record:WisoClassification,base?:WisoClassification):WisoClassification{
 const reasons=[...new Set([...(base?.legal_review_reasons??[]),...(record.legal_review_reasons??[]),...(base?.review_reasons??[]).filter(r=>r.startsWith('legal_'))])];
 return {...record,legal_review:base?.legal_review||record.legal_review||null,legal_review_reasons:reasons,review_reasons:[...new Set([...record.review_reasons,...(base?.review_reasons??[]).filter(r=>r.startsWith('legal_'))])]};
}
export function questionLegalReview(c:WisoClassification){return !!c.legal_review||!!c.legal_review_reasons?.length||c.review_reasons.some(r=>r.startsWith('legal_'))}
export function ordinaryReview(c:WisoClassification|undefined){
 return !c||!c.topic_ids.length||c.confidence<.8||c.review_reasons.some(r=>['source_changed_since_confirmation','source_changed','taxonomy_labels_inactive','proposed_new_wiso_topic'].includes(r));
}
export function legalReviewReasons(s:WisoSummary){
 if(!s.legal_freshness.relevant)return [];
 const reasons:string[]=[];
 if(!s.knowledge||!knowledgeStillCurrent(s.knowledge))reasons.push('Aktuelle Gültigkeit / Konflikt prüfen');
 const v=s.knowledge?.versions.find(v=>v.current);
 if(v&&!v.effective_from)reasons.push('Gesetzlicher Geltungsbeginn nicht geklärt');
 if(v?.supersedes.length)reasons.push('Ersetzungsbeziehung separat rechtlich prüfen');
 return reasons;
}
