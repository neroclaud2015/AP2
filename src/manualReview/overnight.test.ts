import {describe,it,expect} from 'vitest';
import {orderedQueue,exportOvernight,type OvernightItem} from './overnight';
describe('overnight review queue',()=>{
 it('sorts independently of registration order and rejects duplicate identities',()=>{
 const a={id:'a',exam:'2024_sommer',module:'WiSo',question:'1',type:'official_answer'} as OvernightItem;
 const b={...a,id:'b',module:'Arbeitsplanung'};
 expect(orderedQueue([a,b]).map(x=>x.id)).toEqual(['b','a']);
 expect(()=>orderedQueue([a,a])).toThrow();
 });
 it('exports no unchecked machine answers',()=>expect(exportOvernight([],[],[]).confirmations).toEqual([]));
});
