import type {InventoryQuestion} from '../bank/model';
import {reconcileWisoClassifications,type WisoDataset} from '../wiso/model';
/** Used only for new runs/change notices: saved question snapshots never change. */
export function filterWisoTraining(questions:InventoryQuestion[],topicIds:string[]|undefined,data:WisoDataset|undefined):InventoryQuestion[]{
 if(!topicIds?.length)return questions;
 if(!data)throw Error('WiSo-Themen werden noch geladen.');
 const ids=new Set(topicIds.filter(id=>data.taxonomy.nodes.some(n=>n.id===id&&n.active)).flatMap(id=>[id,...data.taxonomy.nodes.filter(n=>n.active&&n.parent_id===id).map(n=>n.id)]));
 const records=reconcileWisoClassifications(questions,data.classifications,data.taxonomy);
 const matches=new Set(records.filter(c=>c.active&&c.topic_ids.some(id=>ids.has(id))).map(c=>c.question_id));
 return questions.filter(q=>q.module==='wiso'&&matches.has(q.question_id));
}
