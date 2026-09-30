import {useEffect,useState} from 'react';
import {useAppServices} from '../services/context';
import {asset} from '../segmented/types';
import {reconcileClassifications,parseClassificationOverrides,type InventoryQuestion,type QuestionClassification,type Taxonomy} from './model';
import {mergeClassifications} from './review';
const changeEvent='ap2:classifications-changed';
/** Compare only edited records so unrelated confirmations from another view can merge. */
export function mergeClassificationEdits(current:QuestionClassification[],expected:QuestionClassification[],records:QuestionClassification[]){
 for(const record of records){const id=record.question_id;if(JSON.stringify(current.find(c=>c.question_id===id))!==JSON.stringify(expected.find(c=>c.question_id===id)))throw Error('Diese Klassifikation wurde inzwischen geändert. Bitte den gespeicherten Stand neu laden.');}
 return mergeClassifications(current,records);
}
export function useBankData(){
 const {user}=useAppServices();const [data,setData]=useState<{inventory:InventoryQuestion[];taxonomy:Taxonomy;classifications:QuestionClassification[];machine:QuestionClassification[];overrides:QuestionClassification[]}>(),[error,setError]=useState('');
 const [loadedKey,setLoadedKey]=useState('');
 const key='ap2:technical-review:classification:'+user.id;
 useEffect(()=>{setData(undefined);setError('');let alive=true;const controller=new AbortController();const get=async(p:string)=>{const r=await fetch(asset('data/'+p),{signal:controller.signal});if(!r.ok)throw Error('Klassifikationsdaten konnten nicht geladen werden.');return r.json()};void Promise.all([get('question_inventory.json'),get('taxonomy.json'),get('question_classifications.json')]).then(([inventory,taxonomy,machine])=>{const saved=localStorage.getItem(key);const overrides=saved?parseClassificationOverrides(JSON.parse(saved),taxonomy,inventory,{allowStale:true,allowOrphans:true}):[];if(alive){setLoadedKey(key);setData({inventory,taxonomy,machine,overrides,classifications:reconcileClassifications(inventory,mergeClassifications(machine,overrides),taxonomy,new Date().toISOString())})}}).catch(e=>{if(alive)setError(String(e))});return()=>{alive=false;controller.abort()}},[key]);
 useEffect(()=>{
  const refresh=(event:Event)=>{if(event instanceof StorageEvent&&event.key!==key&&event.key!==null)return;if(event instanceof CustomEvent&&event.detail!==key)return;
   setData(current=>{if(!current||loadedKey!==key)return current;try{const saved=localStorage.getItem(key);const overrides=saved?parseClassificationOverrides(JSON.parse(saved),current.taxonomy,current.inventory,{allowStale:true,allowOrphans:true}):[];return {...current,overrides,classifications:reconcileClassifications(current.inventory,mergeClassifications(current.machine,overrides),current.taxonomy,new Date().toISOString())};}catch(e){setError(String(e));return current;}});
  };
  window.addEventListener('storage',refresh);window.addEventListener(changeEvent,refresh);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener(changeEvent,refresh)};
 },[key,loadedKey]);
 const save=(records:QuestionClassification[],expectedOverrides=data?.overrides)=>{if(!data||loadedKey!==key||!expectedOverrides)throw Error('Daten fehlen.');const validated=parseClassificationOverrides({schema_version:1,classifications:records},data.taxonomy,data.inventory);const current=localStorage.getItem(key);const old=current?parseClassificationOverrides(JSON.parse(current),data.taxonomy,data.inventory,{allowStale:true,allowOrphans:true}):[];const overrides=mergeClassificationEdits(old,expectedOverrides,validated);localStorage.setItem(key,JSON.stringify({schema_version:1,classifications:overrides}));setData({...data,overrides,classifications:reconcileClassifications(data.inventory,mergeClassifications(data.machine,overrides),data.taxonomy,new Date().toISOString())});window.dispatchEvent(new CustomEvent(changeEvent,{detail:key}));return overrides;};
 return {data:loadedKey===key?data:undefined,error,save};
}
