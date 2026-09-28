import type {AuthProvider,UserContext,SyncProvider,SyncResult,SyncConflict,PersonalDataSnapshot} from '../types';
import type {PullResponse,PushResponse,PushMutation,EntityType} from './protocol';
import type {IndexedDBProgressRepository} from '../storage/storage';
import {LOCAL_USER_ID} from '../services/identity';
export interface GoogleAccount {uid:string;email:string|null;displayName:string|null}
export interface CloudAuth extends AuthProvider {configured:boolean;account():GoogleAccount|null;onAuthChanged(cb:(account:GoogleAccount|null)=>void):()=>void}
export interface CloudTransport {pull(cursor:number,limit?:number,expectedUid?:string):Promise<PullResponse>;push(mutations:PushMutation[],expectedUid?:string):Promise<PushResponse>}
export function personalDataChanged(){if(typeof window!=='undefined')window.dispatchEvent(new Event('ap2:personal-data-changed'));}
export interface SyncController extends SyncProvider {
 readonly configured:boolean;readonly auth:CloudAuth;deviceName:string;lastResult:SyncResult;lastSync:string|null;busy:boolean;
 account():GoogleAccount|null;subscribe(cb:()=>void):()=>void;login():Promise<void>;logout():Promise<void>;
 localSummary():Promise<{snapshot:PersonalDataSnapshot;counts:Record<string,number>}>;
 conflicts():Promise<SyncConflict[]>;migrateLocal():Promise<SyncResult>;importBackup(snapshot:PersonalDataSnapshot,mode:'local'|'sync'):Promise<SyncResult>;
}
/** Offline data remain in the local repository; this facade only coordinates authenticated CAS replication. */
export class FirestoreSyncProvider implements SyncController {
 private running:Promise<SyncResult>|null=null;private listeners=new Set<()=>void>();private generation=0;private runningUid:string|null=null;private runningGeneration=0;
 lastResult:SyncResult={status:'noop',reason:'Noch nicht synchronisiert.'};lastSync:string|null=null;busy=false;
 constructor(readonly repository:IndexedDBProgressRepository,readonly auth:CloudAuth,private transport:CloudTransport){auth.onAuthChanged(account=>{const generation=++this.generation;this.lastSync=null;this.lastResult={status:'noop',reason:'Noch nicht synchronisiert.'};this.emit();if(account)void this.repository.getDeviceState<string>('lastSync:'+account.uid).then(value=>{if(this.generation===generation&&this.lastSync===null){this.lastSync=value??null;this.emit();}}).catch(()=>undefined);});}
 deviceName='Dieses Gerät';
 async conflicts():Promise<SyncConflict[]>{const a=this.account();return a?(await this.repository.getSyncConflicts(a.uid)).map(c=>({entity:c.entity,id:c.id,local:c.local,remote:c.remote})):[];}
 get configured(){return this.auth.configured;}
 account(){return this.auth.account();}
 subscribe(cb:()=>void){this.listeners.add(cb);return()=>{this.listeners.delete(cb);};}
 private emit(){for(const cb of this.listeners)cb();}
 private assertUser(uid:string,generation:number){if(this.generation!==generation||this.auth.account()?.uid!==uid)throw Error('Konto geändert. Synchronisierung wurde beendet.');}
 async login(){await this.auth.login({});this.emit();}
 async logout(){await this.auth.logout();this.emit();}
 async localSummary(){const snapshot=await this.repository.exportSnapshot(LOCAL_USER_ID);return {snapshot,counts:Object.fromEntries(Object.entries(snapshot).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,(v as unknown[]).length]))};}
 async migrateLocal(){const account=this.account();if(!account)throw Error('Bitte zuerst mit Google anmelden.');const uid=account.uid,generation=this.generation;const snapshot=await this.repository.exportSnapshot(LOCAL_USER_ID);this.assertUser(uid,generation);await this.repository.importSnapshot(snapshot,uid,true);this.assertUser(uid,generation);personalDataChanged();return this.sync({id:uid,mode:'remote'});}
 async importBackup(snapshot:PersonalDataSnapshot,mode:'local'|'sync'){const uid=mode==='sync'?this.account()?.uid:LOCAL_USER_ID;if(!uid)throw Error('Bitte zuerst anmelden.');const generation=this.generation;if(mode==='sync')this.assertUser(uid,generation);await this.repository.importSnapshot(snapshot,uid,mode==='sync');if(mode==='sync')this.assertUser(uid,generation);personalDataChanged();if(mode==='sync')return this.sync({id:uid,mode:'remote'});return {status:'noop',reason:'Nur lokal importiert. Es wurde nichts hochgeladen.'} as SyncResult;}
 async sync(user:UserContext):Promise<SyncResult>{if(!this.configured||user.mode!=='remote')return {status:'noop',reason:'Cloud-Sync nicht eingerichtet oder nicht angemeldet.'};if(this.running){if(this.runningUid===user.id&&this.runningGeneration===this.generation)return this.running;await this.running;return this.sync(user);}this.runningUid=user.id;this.runningGeneration=this.generation;this.running=this.run(user).finally(()=>{this.running=null;this.runningUid=null;this.busy=false;this.emit();});return this.running;}
 pull(user:UserContext){return this.sync(user);}
 push(user:UserContext){return this.sync(user);}
 private async run(user:UserContext):Promise<SyncResult>{const uid=user.id,generation=this.generation;this.busy=true;this.emit();let pushed=0,pulled=0,changed=false;
  try{this.assertUser(uid,generation);
   // Push first: a stable mutation ID recovers remote success followed by lost local acknowledgement.
   for(const item of await this.repository.getOutbox(uid)){this.assertUser(uid,generation);const response=await this.transport.push([{mutationId:item.mutationId,entity:item.entity,id:item.id,baseRevision:item.baseRevision,deleted:item.deleted,value:item.value}],uid);this.assertUser(uid,generation);const result=response.results.find(r=>r.mutationId===item.mutationId);if(!result)throw Error('Unvollständige Synchronisierungsantwort.');if(result.status==='conflict')await this.repository.recordSyncConflict(uid,item,result.record);else{await this.repository.acknowledge(uid,item,result.record);pushed++;}}
   let cursor=await this.repository.getDeviceState<number>('cursor:'+uid)??0;let more=true;while(more){this.assertUser(uid,generation);const response=await this.transport.pull(cursor,100,uid);this.assertUser(uid,generation);if(response.hasMore&&response.cursor<=cursor)throw Error('Ungültiger Sync-Cursor.');for(const record of response.changes){await this.repository.receiveRemote(uid,record);pulled++;changed=true;}cursor=response.cursor;await this.repository.setDeviceState('cursor:'+uid,cursor);more=response.hasMore;}
   const conflicts=await this.repository.getSyncConflicts(uid);this.lastSync=new Date().toISOString();await this.repository.setDeviceState('lastSync:'+uid,this.lastSync);this.lastResult=conflicts.length?{status:'conflicts',conflicts:conflicts.map(c=>({entity:c.entity,id:c.id,local:c.local,remote:c.remote}))}:{status:'completed',pulled,pushed};
  }catch(e){this.lastResult={status:'error',message:e instanceof Error?e.message:'Offline. Änderungen bleiben auf diesem Gerät gespeichert.',retryable:true};}
  if(this.generation!==generation){this.lastResult={status:'noop',reason:'Konto gewechselt.'};return this.lastResult;}if(changed)personalDataChanged();return this.lastResult;
 }
 async resolveConflict(user:UserContext,conflict:SyncConflict,resolution:'local'|'remote'):Promise<SyncResult>{const generation=this.generation;this.assertUser(user.id,generation);await this.repository.resolveSyncConflict(user.id,conflict.entity as EntityType,conflict.id,resolution,{mutationId:(conflict.local as {mutationId:string}).mutationId,revision:(conflict.remote as {revision:number}).revision});personalDataChanged();return this.sync(user);}
 startAutomaticSync(){if(typeof window==='undefined')return()=>{};const run=()=>{const a=this.account();if(a)void this.sync({id:a.uid,mode:'remote'});};window.addEventListener('online',run);const timer=window.setInterval(run,30000);const off=this.auth.onAuthChanged(()=>run());run();return()=>{window.removeEventListener('online',run);window.clearInterval(timer);off();};}
}

