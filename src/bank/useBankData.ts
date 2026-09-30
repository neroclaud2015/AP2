import {useEffect,useState} from 'react';
import {useAppServices} from '../services/context';
import {asset} from '../segmented/types';
import {reconcileClassifications,parseClassificationOverrides,type InventoryQuestion,type QuestionClassification,type Taxonomy} from './model';
import {mergeClassifications} from './review';
export function useBankData(){
 const {user}=useAppServices();const [data,setData]=useState<{inventory:InventoryQuestion[];taxonomy:Taxonomy;classifications:QuestionClassification[];overrides:QuestionClassification[]}>(),[error,setError]=useState('');
 const [loadedKey,setLoadedKey]=useState('');
 const key='ap2:technical-review:classification:'+user.id;
 useEffect(()=>{setData(undefined);setError('');let alive=true;const controller=new AbortController();const get=async(p:string)=>{const r=await fetch(asset('data/'+p),{signal:controller.signal});if(!r.ok)throw Error('Klassifikationsdaten konnten nicht geladen werden.');return r.json()};void Promise.all([get('question_inventory.json'),get('taxonomy.json'),get('question_classifications.json')]).then(([inventory,taxonomy,machine])=>{const saved=localStorage.getItem(key);const overrides=saved?parseClassificationOverrides(JSON.parse(saved),taxonomy,inventory,{allowStale:true,allowOrphans:true}):[];if(alive){setLoadedKey(key);setData({inventory,taxonomy,overrides,classifications:reconcileClassifications(inventory,mergeClassifications(machine,overrides),taxonomy,new Date().toISOString())})}}).catch(e=>{if(alive)setError(String(e))});return()=>{alive=false;controller.abort()}},[key]);
 const save=(records:QuestionClassification[])=>{if(!data||loadedKey!==key)throw Error('Daten fehlen.');const validated=parseClassificationOverrides({schema_version:1,classifications:records},data.taxonomy,data.inventory);const current=localStorage.getItem(key);const old=current?parseClassificationOverrides(JSON.parse(current),data.taxonomy,data.inventory,{allowStale:true,allowOrphans:true}):[];const overrides=mergeClassifications(old,validated);localStorage.setItem(key,JSON.stringify({schema_version:1,classifications:overrides}));setData({...data,overrides,classifications:reconcileClassifications(data.inventory,mergeClassifications(data.classifications,overrides),data.taxonomy,new Date().toISOString())});};
 return {data:loadedKey===key?data:undefined,error,save};
}
