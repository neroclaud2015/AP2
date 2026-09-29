import {validateEnvelope,canonical} from './validation';
import Dexie from 'dexie';
import type {EntityType,SyncEnvelope} from './protocol';
import {ID_FIELDS,PERSONAL_STORES,SYNC_STORES,type OutboxItem,type SyncMetadata,type StoredConflict} from './localTypes';
export class SyncPersistence {
 constructor(private db:Dexie){}
 tables(){return [...PERSONAL_STORES,...SYNC_STORES];}
 async mark(entity:EntityType,userId:string,id:string,value:Record<string,unknown>|null){
  const key=[userId,entity,id],old=await this.db.table<SyncMetadata>('syncMeta').get(key);let device=await this.db.table('deviceState').get('device');if(!device){device={key:'device',value:{deviceId:crypto.randomUUID(),deviceName:'Dieses Gerät'}};await this.db.table('deviceState').put(device);}const stamp=new Date().toISOString();
  const localRevision=(old?.localRevision??0)+1;
  const item:OutboxItem={userId,entity,id,mutationId:crypto.randomUUID(),baseRevision:old?.revision??0,deleted:value===null,value,updated_at:stamp,localRevision};
  await this.db.table('outbox').put(item);const conflict=await this.db.table('syncConflicts').get(key);if(conflict)await this.db.table('syncConflicts').put({...conflict,local:item});await this.db.table('syncMeta').put({userId,entity,id,revision:old?.revision??0,localRevision,updated_at:stamp,device_id:device.value.deviceId,sync_state:'pending'});
  if(value===null)await this.db.table('tombstones').put({userId,entity,id,updated_at:stamp});else await this.db.table('tombstones').delete(key);
 }
 async put(entity:EntityType,value:Record<string,unknown>,add=false){
  const userId=String(value.userId),id=String(value[ID_FIELDS[entity]]);
  await this.db.transaction('rw',this.tables(),async()=>{if(add)await this.db.table(entity).add(value);else await this.db.table(entity).put(value);await this.mark(entity,userId,id,value);});
 }
 async remove(entity:EntityType,userId:string,id:string){await this.db.table(entity).delete([userId,id]);await this.mark(entity,userId,id,null);}
 async outbox(userId:string):Promise<OutboxItem[]>{const conflicts=await this.conflicts(userId);const blocked=new Set(conflicts.map(c=>c.entity+'\0'+c.id));return (await this.db.table<OutboxItem>('outbox').where('userId').equals(userId).toArray()).filter(m=>!blocked.has(m.entity+'\0'+m.id));}
 async conflicts(userId:string){return this.db.table<StoredConflict>('syncConflicts').where('userId').equals(userId).toArray();}
 async ack(userId:string,sent:OutboxItem,remote:SyncEnvelope){validateEnvelope(userId,remote);if(remote.entity!==sent.entity||remote.id!==sent.id)throw Error('Falsche Bestätigung');await this.db.transaction('rw',this.tables(),async()=>{
  const key=[userId,sent.entity,sent.id],pending=await this.db.table<OutboxItem>('outbox').get(key),meta=await this.db.table<SyncMetadata>('syncMeta').get(key);
  if(!meta)return;
  if(pending?.mutationId===sent.mutationId){await this.db.table('outbox').delete(key);await this.db.table('syncMeta').put({...meta,revision:remote.revision,sync_state:'synced'});}
  else if(pending&&pending.baseRevision<=sent.baseRevision){await this.db.table('outbox').put({...pending,baseRevision:remote.revision});await this.db.table('syncMeta').put({...meta,revision:remote.revision});}
 });}
 async receive(userId:string,remote:SyncEnvelope){validateEnvelope(userId,remote);await this.db.transaction('rw',this.tables(),async()=>{
  if(!PERSONAL_STORES.includes(remote.entity))throw Error('Unknown sync entity');
  const key=[userId,remote.entity,remote.id],meta=await this.db.table<SyncMetadata>('syncMeta').get(key),pending=await this.db.table<OutboxItem>('outbox').get(key);
  if(meta&&remote.revision<=meta.revision)return;
  if(pending){await this.db.table('syncConflicts').put({userId,entity:remote.entity,id:remote.id,local:pending,remote});await this.db.table('syncMeta').put({...meta,sync_state:'conflict'});return;}
  await this.apply(userId,remote);await this.db.table('syncMeta').put({userId,entity:remote.entity,id:remote.id,revision:remote.revision,localRevision:meta?.localRevision??0,updated_at:remote.updatedAt,device_id:remote.deviceId,sync_state:'synced'});
 });}
 async conflict(userId:string,sent:OutboxItem,remote:SyncEnvelope){validateEnvelope(userId,remote);await this.db.transaction('rw',this.tables(),async()=>{const key=[userId,sent.entity,sent.id],pending=await this.db.table('outbox').get(key);await this.db.table('syncConflicts').put({userId,entity:sent.entity,id:sent.id,local:pending??sent,remote});const meta=await this.db.table('syncMeta').get(key);await this.db.table('syncMeta').put({...meta,sync_state:'conflict'});});}
 private async apply(userId:string,r:SyncEnvelope){
  const existing=await this.db.table(r.entity).get([userId,r.id]);
  if(existing&&r.value){
    if(r.entity==='moduleProgress'&&Number(r.value.generation)<existing.generation)throw Error('Eine ältere Lernrunde darf den aktuellen Fortschritt nicht ersetzen.');
    if(r.entity==='moduleRuns'&&canonical(existing)!==canonical(r.value))throw Error('Historische Lernrunde wurde verändert.');
    const keys=r.entity==='attempts'?Object.keys(existing).filter(k=>!['note','error_reason','unsure','confidence'].includes(k)):r.entity==='testSessions'?['question_ids','question_models','source_mix','official_answers','started_at','seed','sourceExams','exam','module']:[];
    if(keys.some(k=>canonical(existing[k])!==canonical(r.value![k])))throw Error('Historische Herkunft oder Antwort wurde verändert. Keine Daten überschrieben.');
  }
  if(r.deleted){await this.db.table(r.entity).delete([userId,r.id]);await this.db.table('tombstones').put({userId,entity:r.entity,id:r.id,updated_at:r.updatedAt});}else{if(!r.value||String(r.value[ID_FIELDS[r.entity]])!==r.id)throw Error('Invalid remote identity');await this.db.table(r.entity).put(r.value);await this.db.table('tombstones').delete([userId,r.entity,r.id]);}}
 async resolve(userId:string,entity:EntityType,id:string,choice:'local'|'remote',expected?:{mutationId:string;revision:number}){await this.db.transaction('rw',this.tables(),async()=>{
  const key=[userId,entity,id],c=await this.db.table<StoredConflict>('syncConflicts').get(key);if(!c)throw Error('Conflict no longer exists');if(expected&&(expected.mutationId!==c.local.mutationId||expected.revision!==c.remote.revision))throw Error('Der Konflikt wurde geändert. Bitte beide Versionen erneut prüfen.');const pending=await this.db.table<OutboxItem>('outbox').get(key);
  if(entity==='moduleProgress'){const selected=choice==='local'?(pending??c.local).value:c.remote.value,other=choice==='local'?c.remote.value:(pending??c.local).value;if(selected&&other&&Number(selected.generation)<Number(other.generation))throw Error('Eine neuere Lernrunde ist vorhanden. Bitte die neuere Version übernehmen.');}
  if(choice==='remote'&&pending?.mutationId!==c.local.mutationId)throw Error('Local data changed. Review the new conflict before replacing it.');
  const meta=await this.db.table('syncMeta').get(key);
  if(choice==='remote'){await this.apply(userId,c.remote);await this.db.table('outbox').delete(key);await this.db.table('syncMeta').put({...meta,revision:c.remote.revision,sync_state:'synced'});}
  else{await this.db.table('outbox').put({...pending??c.local,mutationId:crypto.randomUUID(),baseRevision:c.remote.revision});await this.db.table('syncMeta').put({...meta,revision:c.remote.revision,sync_state:'pending'});}
  await this.db.table('syncConflicts').delete(key);
 });}
}
