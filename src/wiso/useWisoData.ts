import {useEffect,useState} from 'react';
import {useAppServices} from '../services/context';
import {asset} from '../segmented/types';
import type {InventoryQuestion} from '../bank/model';
import {reconcileWisoClassifications,type WisoDataset,type WisoClassification} from './model';
const eventName='ap2:wiso-classifications-changed';
export function parseWisoOverrides(raw:unknown,data:WisoDataset,inventory:InventoryQuestion[],stale=false):WisoClassification[]{
 const value=raw as {schema_version:number;classifications:WisoClassification[]};
 if(!value||value.schema_version!==1||!Array.isArray(value.classifications))throw Error('Ungültiger WiSo-Klassifikationsspeicher.');
 const seen=new Set<string>();
 const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim();
 return value.classifications.map(c=>{
  if(!c||typeof c!=='object'||!text(c.question_id)||!text(c.question_source_revision)||!text(c.taxonomy_version)||!text(c.updated_at)||!Number.isFinite(Date.parse(c.updated_at))||seen.has(c.question_id)||c.source!=='human_confirmed'||c.locked!==true||!Array.isArray(c.topic_ids)||new Set(c.topic_ids).size!==c.topic_ids.length||c.topic_ids.some(id=>!text(id)||!data.taxonomy.nodes.some(n=>n.id===id&&(stale||n.active)))||!Array.isArray(c.review_reasons)||!c.review_reasons.every(text)||!Array.isArray(c.evidence)||!c.evidence.every(text)||!Number.isFinite(c.confidence)||c.confidence<0||c.confidence>1)throw Error('Ungültiger WiSo-Klassifikationsdatensatz.');
  const q=inventory.find(q=>q.question_id===c.question_id&&q.module==='wiso');
  if(!stale&&(!q||q.question_source_revision!==c.question_source_revision||c.taxonomy_version!==data.taxonomy.version))throw Error('Veraltete WiSo-Klassifikation.');
  seen.add(c.question_id);return c;
 });
}
export function mergeWisoEdits(current:WisoClassification[],expected:WisoClassification[],record:WisoClassification){if(JSON.stringify(current.find(c=>c.question_id===record.question_id))!==JSON.stringify(expected.find(c=>c.question_id===record.question_id)))throw Error('Diese WiSo-Zuordnung wurde inzwischen geändert. Bitte den gespeicherten Stand neu laden.');return [...current.filter(c=>c.question_id!==record.question_id),record];}
export function useWisoData(){
 const {user}=useAppServices(),key='ap2:technical-review:wiso:'+user.id;
 const [base,setBase]=useState<{dataset:WisoDataset;inventory:InventoryQuestion[];key:string}>(),[overrides,setOverrides]=useState<WisoClassification[]>([]),[error,setError]=useState('');
 useEffect(()=>{let alive=true;setBase(undefined);setError('');const controller=new AbortController();const get=async(path:string)=>{const r=await fetch(asset('data/'+path),{signal:controller.signal});if(!r.ok)throw Error('WiSo-Daten konnten nicht geladen werden.');return r.json()};void Promise.all([get('wiso_focus.json'),get('question_inventory.json')]).then(([dataset,inventory])=>{const saved=localStorage.getItem(key);const parsed=saved?parseWisoOverrides(JSON.parse(saved),dataset,inventory,true):[];if(alive){setOverrides(parsed);setBase({dataset,inventory,key})}}).catch(e=>{if(alive)setError(String(e))});return()=>{alive=false;controller.abort()}},[key]);
 useEffect(()=>{const refresh=(event:Event)=>{if(event instanceof StorageEvent&&event.key!==key&&event.key!==null)return;if(event instanceof CustomEvent&&event.detail!==key)return;if(!base||base.key!==key)return;try{const saved=localStorage.getItem(key);setOverrides(saved?parseWisoOverrides(JSON.parse(saved),base.dataset,base.inventory,true):[]);setError('')}catch(e){setError(String(e))}};window.addEventListener('storage',refresh);window.addEventListener(eventName,refresh);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener(eventName,refresh)}},[base,key]);
 const save=(record:WisoClassification,expected:WisoClassification[])=>{if(!base||base.key!==key)throw Error('WiSo-Daten fehlen.');parseWisoOverrides({schema_version:1,classifications:[record]},base.dataset,base.inventory);const raw=localStorage.getItem(key),current=raw?parseWisoOverrides(JSON.parse(raw),base.dataset,base.inventory,true):[];const next=mergeWisoEdits(current,expected,record);localStorage.setItem(key,JSON.stringify({schema_version:1,classifications:next}));setOverrides(next);window.dispatchEvent(new CustomEvent(eventName,{detail:key}));};
 const current=base?.key===key?base:undefined;
 const data=current?{...current.dataset,classifications:reconcileWisoClassifications(current.inventory,[...current.dataset.classifications.filter(c=>!overrides.some(o=>o.question_id===c.question_id)),...overrides],current.dataset.taxonomy)}:undefined;
 return {data,inventory:current?.inventory,overrides,error,save};
}
