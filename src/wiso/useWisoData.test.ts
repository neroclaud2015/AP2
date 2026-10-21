import {describe,it,expect} from 'vitest';
import {parseWisoOverrides,mergeWisoEdits} from './useWisoData';
import type {WisoDataset,WisoClassification} from './model';
import type {InventoryQuestion} from '../bank/model';
const data:WisoDataset={schema_version:1,version:'1',taxonomy:{version:'1',nodes:[{id:'a',label:'A',active:true,parent_id:null}]},texts:[],summaries:[],classifications:[]};
const inventory=[{question_id:'q',module:'wiso',question_source_revision:'r'}] as InventoryQuestion[];
const record:WisoClassification={question_id:'q',question_source_revision:'r',topic_ids:['a'],confidence:1,source:'human_confirmed',locked:true,taxonomy_version:'1',updated_at:'2026-10-21T12:00:00Z',evidence:[],review_reasons:[]};
const parse=(c:WisoClassification,stale=false)=>parseWisoOverrides({schema_version:1,classifications:[c]},data,inventory,stale);
describe('technical WiSo overrides',()=>{
 it('accepts source-bound locked confirmation and rejects unknown taxonomy/source',()=>{expect(parse(record)).toEqual([record]);expect(()=>parse({...record,topic_ids:['unknown']})).toThrow();expect(()=>parse({...record,question_source_revision:'old'})).toThrow();expect(parse({...record,question_source_revision:'old'},true)).toHaveLength(1)});
 it('merges unrelated edits but blocks concurrent changes to the same record',()=>{const other={...record,question_id:'other'};expect(mergeWisoEdits([other],[],record)).toEqual([other,record]);expect(()=>mergeWisoEdits([{...record,topic_ids:[]}],[],record)).toThrow(/inzwischen/)});
 it('rejects duplicates and malformed storage',()=>{expect(()=>parseWisoOverrides({schema_version:1,classifications:[record,record]},data,inventory)).toThrow();expect(()=>parseWisoOverrides({},data,inventory)).toThrow()});
});


it('rejects malformed shapes even when loading stale records',()=>{for(const change of [{question_id:' '},{question_source_revision:1},{taxonomy_version:1},{updated_at:'invalid'},{review_reasons:[1]},{evidence:[{}]}])expect(()=>parse({...record,...change} as WisoClassification,true)).toThrow();expect(()=>parseWisoOverrides({schema_version:1,classifications:[null]},data,inventory,true)).toThrow();expect(()=>parse({...record,taxonomy_version:'old'})).toThrow();expect(parse({...record,question_id:'retired'},true)).toHaveLength(1)});
