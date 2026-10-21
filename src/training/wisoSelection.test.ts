import {describe,it,expect} from 'vitest';
import {filterWisoTraining} from './wisoSelection';
import type {InventoryQuestion} from '../bank/model';
import type {WisoDataset} from '../wiso/model';
const q=(id:string,revision='1')=>({question_id:id,module:'wiso',question_source_revision:revision}) as InventoryQuestion;
const data={taxonomy:{version:'1',nodes:[{id:'parent',label:'Parent',parent_id:null,active:true},{id:'leaf',label:'Leaf',parent_id:'parent',active:true}]},classifications:[{question_id:'a',question_source_revision:'1',topic_ids:['leaf'],source:'machine',locked:false,review_reasons:[]}]} as unknown as WisoDataset;
describe('topic training uses current pool without changing saved runs',()=>{
 it('keeps ordinary training independent of topic data',()=>expect(filterWisoTraining([q('a')],[],undefined)).toEqual([q('a')]));
 it('requires loaded data for topic restart',()=>expect(()=>filterWisoTraining([q('a')],['leaf'],undefined)).toThrow());
 it('unions descendants and excludes unrelated or removed records',()=>expect(filterWisoTraining([q('a'),q('b')],['parent'],data).map(q=>q.question_id)).toEqual(['a']));
 it('excludes stale machine classification until reprocessed',()=>expect(filterWisoTraining([q('a','2')],['leaf'],data)).toEqual([]));
});
