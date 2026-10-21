import type {InventoryQuestion} from '../bank/model';
import type {DashboardSnapshot} from '../dashboard/analytics';
import {wrongResults,reconcileWrongQuestions} from '../learning/wrongQuestions';
import {uncertaintyQuestionIds} from '../learning/questionUncertainty';

export interface WisoTaxonomyNode {id:string;label:string;parent_id:string|null;active:boolean}
export interface WisoClassification {question_id:string;question_source_revision:string;topic_ids:string[];confidence:number;source:string;locked:boolean;review_reasons:string[];evidence:unknown;active?:boolean;updated_at?:string;taxonomy_version?:string}
export interface WisoQuestionText {question_id:string;question_source_revision:string;text:string;extraction_method:string;confidence:number;language:string;reviewed:boolean;updated_at:string;evidence:unknown}
export interface WisoSummary {topic_id:string;bullets:string[];patterns:{text:string;question_ids:string[]}[];question_ids:string[];provenance:'historical_exam_summary';legal_freshness:{relevant:boolean;reviewed_at:string|null;review_needed:boolean;valid_for_year?:number;official_references?:unknown[]}}
export interface WisoConfig {recentSeasonCount:number;minAccuracyQuestions:number;weakAccuracy:number;relevance:{questionWeight:number;seasonWeight:number;recentWeight:number;veryHigh:number;high:number;medium:number};priority:{relevanceWeight:number;needWeight:number;weaknessWeight:number;unpracticedBonus:number;high:number;medium:number}}
export interface WisoDataset {schema_version:number;version:string;taxonomy:{version:string;nodes:WisoTaxonomyNode[]};texts:WisoQuestionText[];classifications:WisoClassification[];summaries:WisoSummary[];config?:Partial<WisoConfig>}
export const DEFAULT_WISO_CONFIG:WisoConfig={recentSeasonCount:4,minAccuracyQuestions:3,weakAccuracy:60,relevance:{questionWeight:.4,seasonWeight:.4,recentWeight:.2,veryHigh:.7,high:.5,medium:.25},priority:{relevanceWeight:1,needWeight:2,weaknessWeight:1,unpracticedBonus:.25,high:.9,medium:.5}};
const unique=(ids:string[])=>[...new Set(ids)];
const eligible=(value:unknown)=>{const r=value as Record<string,unknown>;return !r.invalidated&&!r.invalidated_at&&!r.deleted&&!r.deleted_at&&!r.discarded&&!r.discarded_at&&r.valid!==false;};
const seasonCompare=(a:string,b:string)=>Number(a.slice(0,4))-Number(b.slice(0,4))||(a.includes('sommer')?0:1)-(b.includes('sommer')?0:1)||a.localeCompare(b);

/** Preserve confirmed choices on source changes; stale machine evidence cannot classify new source content. */
export function reconcileWisoClassifications(inventory:InventoryQuestion[],previous:WisoClassification[],taxonomy:WisoDataset['taxonomy']):WisoClassification[]{
 const questions=new Map(inventory.filter(q=>q.module==='wiso').map(q=>[q.question_id,q]));
 return previous.map(c=>{const q=questions.get(c.question_id);if(!q)return {...c,active:false};
 const changed=q.question_source_revision!==c.question_source_revision,locked=c.locked&&c.source==='human_confirmed';
 const reasons=c.review_reasons.filter(r=>!['source_changed_since_confirmation','source_changed','taxonomy_labels_inactive'].includes(r));
 if(changed)reasons.push(locked?'source_changed_since_confirmation':'source_changed');
 if(c.topic_ids.some(id=>!taxonomy.nodes.some(n=>n.id===id&&n.active)))reasons.push('taxonomy_labels_inactive');
 return {...c,active:true,topic_ids:changed&&!locked?[]:[...c.topic_ids],review_reasons:unique(reasons)};});
}

export function deriveWiso(inventory:InventoryQuestion[],dataset:WisoDataset,snapshot:DashboardSnapshot,userId:string,now=new Date()){
 const config:WisoConfig={...DEFAULT_WISO_CONFIG,...dataset.config,relevance:{...DEFAULT_WISO_CONFIG.relevance,...dataset.config?.relevance},priority:{...DEFAULT_WISO_CONFIG.priority,...dataset.config?.priority}};
 const minAccuracy=Math.max(3,config.minAccuracyQuestions),questions=[...new Map(inventory.filter(q=>q.module==='wiso').map(q=>[q.question_id,q])).values()],ids=new Set(questions.map(q=>q.question_id));
 const seasons=unique(questions.map(q=>q.examId)).sort(seasonCompare),recentSeasons=seasons.slice(-Math.max(1,config.recentSeasonCount));
 const records=reconcileWisoClassifications(questions,dataset.classifications,dataset.taxonomy),classification=new Map(records.filter(c=>c.active).map(c=>[c.question_id,c]));
 const rows=wrongResults(userId,snapshot.attempts.filter(eligible),snapshot.testSessions.filter(eligible)).filter(r=>ids.has(r.question_id)&&Number.isFinite(Date.parse(r.timestamp))&&Date.parse(r.timestamp)<=now.getTime());
 const latest=[...new Map(rows.map(r=>[r.question_id,r])).values()];
 const states=reconcileWrongQuestions(userId,rows,snapshot.wrongQuestions.filter(s=>s.userId===userId&&ids.has(s.question_id)),now.toISOString());
 const wrongIds=states.filter(s=>s.active&&[1,2,3].includes(s.stage as number)).map(s=>s.question_id);
 const unsureIds=[...uncertaintyQuestionIds(snapshot.questionUncertainty.filter(s=>s.userId===userId&&ids.has(s.question_id)),states)];
 const masteredIds=states.filter(s=>s.stage==='mastered').map(s=>s.question_id);
 const nodes=dataset.taxonomy.nodes.filter(n=>n.active);
 const topics=nodes.map(node=>{
  const topicIds=new Set([node.id,...nodes.filter(n=>n.parent_id===node.id).map(n=>n.id)]);
  const pool=questions.filter(q=>classification.get(q.question_id)?.topic_ids.some(id=>topicIds.has(id))),questionIds=pool.map(q=>q.question_id),members=new Set(questionIds);
  const topicSeasons=seasons.filter(s=>pool.some(q=>q.examId===s)),recentSeasonCount=topicSeasons.filter(s=>recentSeasons.includes(s)).length;
  const relevanceScore=config.relevance.questionWeight*(questions.length?pool.length/questions.length:0)+config.relevance.seasonWeight*(seasons.length?topicSeasons.length/seasons.length:0)+config.relevance.recentWeight*(recentSeasons.length?recentSeasonCount/recentSeasons.length:0);
  const relevance=relevanceScore>=config.relevance.veryHigh?'Sehr häufig':relevanceScore>=config.relevance.high?'Häufig':relevanceScore>=config.relevance.medium?'Mittel':'Selten';
  const answeredRows=latest.filter(r=>members.has(r.question_id)),answered=answeredRows.length,correct=answeredRows.filter(r=>r.correctness==='richtig').length,accuracy=answered>=minAccuracy?100*correct/answered:null;
  const wrong=wrongIds.filter(id=>members.has(id)),unsure=unsureIds.filter(id=>members.has(id)),needIds=unique([...wrong,...unsure]);
  const lastPracticed=answeredRows.reduce<string|null>((stamp,r)=>!stamp||Date.parse(r.timestamp)>Date.parse(stamp)?r.timestamp:stamp,null);
  const reasons:string[]=[];if(relevanceScore>=config.relevance.high)reasons.push('In vielen Prüfungsterminen vertreten');if(wrong.length)reasons.push(`${wrong.length} Aufgaben in Fehlerstufe 1–3`);if(unsure.length)reasons.push(`${unsure.length} Aufgaben als unsicher markiert`);if(accuracy!==null&&accuracy<config.weakAccuracy)reasons.push(`Trefferquote unter ${config.weakAccuracy} % bei ${answered} verschiedenen Aufgaben`);if(!answered)reasons.push('Noch nicht bearbeitet');
  const priority=config.priority.relevanceWeight*relevanceScore+config.priority.needWeight*(pool.length?needIds.length/pool.length:0)+config.priority.weaknessWeight*(accuracy!==null&&accuracy<config.weakAccuracy?1-accuracy/100:0)+(!answered?config.priority.unpracticedBonus:0);
  return {...node,questionIds,count:pool.length,seasons:topicSeasons,seasonCount:topicSeasons.length,recentSeasonCount,mc:pool.filter(q=>q.kind==='multiple_choice').length,u:pool.filter(q=>q.kind==='multi_part').length,firstSeen:topicSeasons[0]??null,lastSeen:topicSeasons.at(-1)??null,relevance,relevanceScore,answered,correct,accuracy,wrongIds:wrong,unsureIds:unsure,needIds,mastered:masteredIds.filter(id=>members.has(id)).length,lastPracticed,priority,priorityLabel:priority>=config.priority.high?'Hoch':priority>=config.priority.medium?'Mittel':'Niedrig',reasons};
 });
 const classified=new Set(topics.flatMap(t=>t.questionIds)).size,total=questions.length;
 // Prefer specific subtopics, but retain parent-only questions that no child represents.
 const candidates=topics.filter(t=>{const childIds=new Set(topics.filter(child=>child.parent_id===t.id).flatMap(child=>child.questionIds));return t.questionIds.some(id=>!childIds.has(id));});
 const ranked=[...candidates].sort((a,b)=>b.priority-a.priority||(Date.parse(a.lastPracticed??'1970-01-01')-Date.parse(b.lastPracticed??'1970-01-01'))||a.id.localeCompare(b.id));
 return {total,classified,unclassified:total-classified,coverage:total?100*classified/total:0,seasons,recentSeasons,topics,frequentTopics:[...candidates].sort((a,b)=>b.relevanceScore-a.relevanceScore||b.count-a.count||a.id.localeCompare(b.id)).slice(0,8),weakTopics:ranked.filter(t=>t.accuracy!==null&&t.accuracy<config.weakAccuracy),nextFocus:ranked[0]??null,config,answered:latest.length,accuracy:latest.length>=minAccuracy?100*latest.filter(r=>r.correctness==='richtig').length/latest.length:null,wrong:wrongIds.length,unsure:unsureIds.length,mastered:masteredIds.length};
}
