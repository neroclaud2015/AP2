import {IndexedDBProgressRepository} from '../storage/storage';
import type {SyncProvider,SyncResult,UserContext,SyncConflict} from '../types';
import type {AppServices} from './context';
import {FirebaseAuthProvider} from '../sync/FirebaseAuthProvider';
import {FirestoreTransport} from '../sync/firestoreTransport';
import {FirestoreSyncProvider} from '../sync/FirestoreSyncProvider';
export class NoopSyncProvider implements SyncProvider {
 private result():SyncResult{return {status:'noop',reason:'Local mode: network synchronization is unavailable.'};}
 async pull(_user:UserContext){return this.result();}
 async push(_user:UserContext){return this.result();}
 async sync(_user:UserContext){return this.result();}
 async resolveConflict(_user:UserContext,_conflict:SyncConflict,_resolution:'local'|'remote'){return this.result();}
}
export async function createLocalServices():Promise<AppServices>{const repository=new IndexedDBProgressRepository(),auth=new FirebaseAuthProvider();let device=await repository.getDeviceState<{deviceId:string;deviceName:string}>('device');if(!device){device={deviceId:crypto.randomUUID(),deviceName:'Dieses Gerät'};await repository.setDeviceState('device',device);}const user=await auth.restoreSession(),syncControl=new FirestoreSyncProvider(repository,auth,new FirestoreTransport(auth,device.deviceId,device.deviceName));syncControl.deviceName=device.deviceName;syncControl.startAutomaticSync();return {repository,auth,sync:syncControl,user,syncControl};}
