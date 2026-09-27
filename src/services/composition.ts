import {IndexedDBProgressRepository,LocalUserProvider} from '../storage/storage';
import type {SyncProvider,SyncResult,UserContext,SyncConflict} from '../types';
import type {AppServices} from './context';
export class NoopSyncProvider implements SyncProvider {
 private result():SyncResult{return {status:'noop',reason:'Local mode: network synchronization is unavailable.'};}
 async pull(_user:UserContext){return this.result();}
 async push(_user:UserContext){return this.result();}
 async sync(_user:UserContext){return this.result();}
 async resolveConflict(_user:UserContext,_conflict:SyncConflict,_resolution:'local'|'remote'){return this.result();}
}
export async function createLocalServices():Promise<AppServices>{const auth=new LocalUserProvider();return {repository:new IndexedDBProgressRepository(),auth,sync:new NoopSyncProvider(),user:await auth.restoreSession()};}
