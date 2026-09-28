import {collection,doc,getDocsFromServer,query,where,orderBy,limit as queryLimit,runTransaction,type Firestore} from 'firebase/firestore';
import type {FirebaseAuthProvider} from './FirebaseAuthProvider';
import type {SyncEnvelope,PushMutation,PushResult,PullResponse,PushResponse,SyncValue} from './protocol';
import {canonical,planMutation,validateMutation} from './firestorePolicy';
interface StoredRecord {userId:string;envelope:SyncEnvelope;history:SyncValue}
interface Receipt {userId:string;mutation:PushMutation;result:PushResult;recordKey:string;createdAt:string}
export async function syncKey(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
export class FirestoreTransport {
 constructor(private auth:FirebaseAuthProvider,readonly deviceId:string,readonly deviceName:string){if(!deviceId||deviceId.length>128||deviceId.includes('/')||!deviceName||deviceName.length>100)throw Error('Ungültige Gerätekennung.');}
 private capture(expectedUid?:string){const uid=this.auth.account()?.uid;if(!uid||expectedUid&&expectedUid!==uid)throw Error('Google-Konto wurde gewechselt. Synchronisierung erneut starten.');return uid;}
 private assert(uid:string){if(this.auth.account()?.uid!==uid)throw Error('Google-Konto wurde gewechselt.');}
 async pull(cursor:number,limit=100,expectedUid?:string):Promise<PullResponse>{
  const uid=this.capture(expectedUid);if(!Number.isSafeInteger(cursor)||cursor<0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Ungültiger Sync-Cursor.');
  const db=this.auth.firestore();this.assert(uid);
  const result=await getDocsFromServer(query(collection(db,'users',uid,'records'),where('envelope.cursor','>',cursor),orderBy('envelope.cursor'),queryLimit(limit+1)));this.assert(uid);
  const changes=result.docs.slice(0,limit).map(d=>(d.data() as StoredRecord).envelope);
  return{changes,cursor:changes.at(-1)?.cursor??cursor,hasMore:result.size>limit};
 }
 async push(mutations:PushMutation[],expectedUid?:string):Promise<PushResponse>{
  const uid=this.capture(expectedUid);if(!Array.isArray(mutations)||mutations.length>100)throw Error('Zu viele Sync-Datensätze.');
  const clean=JSON.parse(JSON.stringify(mutations)) as PushMutation[];for(const m of clean)validateMutation(m,uid);
  if(new Set(clean.map(m=>m.mutationId)).size!==clean.length)throw Error('Doppelte Mutationskennung.');
  const results:PushResult[]=[];const db=this.auth.firestore();
  for(const m of clean){this.assert(uid);results.push(await this.apply(db,uid,m));this.assert(uid);}
  return{results};
 }
 private async apply(db:Firestore,uid:string,m:PushMutation):Promise<PushResult>{
  const recordKey=await syncKey(m.entity+'\0'+m.id),mutationKey=await syncKey(m.mutationId);this.assert(uid);
  const recordRef=doc(db,'users',uid,'records',recordKey),receiptRef=doc(db,'users',uid,'mutations',mutationKey),stateRef=doc(db,'users',uid,'sync','state'),deviceRef=doc(db,'users',uid,'devices',this.deviceId),conflictRef=doc(db,'users',uid,'conflicts',mutationKey);
  return runTransaction(db,async tx=>{
   this.assert(uid);const [receiptSnap,recordSnap,stateSnap,deviceSnap]=await Promise.all([tx.get(receiptRef),tx.get(recordRef),tx.get(stateRef),tx.get(deviceRef)]);this.assert(uid);
   if(receiptSnap.exists()){
    const receipt=receiptSnap.data() as Receipt;if(canonical(receipt.mutation)!==canonical(m))throw Error('Mutationskennung wurde für andere Daten wiederverwendet.');
    return{...receipt.result,status:receipt.result.status==='applied'?'duplicate':receipt.result.status};
   }
   const stored=recordSnap.exists()?recordSnap.data() as StoredRecord:undefined;const current=stored?.envelope;const decision=planMutation(m,current,stored?.history??null);const now=new Date().toISOString();let result:PushResult;
   if(decision.reason){
    const remote=current??{entity:m.entity,id:m.id,revision:0,cursor:0,updatedAt:new Date(0).toISOString(),deviceId:'none',deleted:true,value:null};
    result={mutationId:m.mutationId,status:'conflict',record:remote,conflictId:mutationKey,reason:decision.reason};
    tx.set(conflictRef,{userId:uid,recordKey,mutation:m,remote,reason:decision.reason,createdAt:now});
   }else{
    const cursor=Number(stateSnap.data()?.cursor??0)+1;if(!Number.isSafeInteger(cursor))throw Error('Sync-Cursor erschöpft.');
    const envelope:SyncEnvelope={entity:m.entity,id:m.id,revision:(current?.revision??0)+1,cursor,updatedAt:now,deviceId:this.deviceId,deleted:m.deleted,value:m.value};
    const history=['attempts','testSessions'].includes(m.entity)?m.deleted?(stored?.history??null):m.value:null;
    tx.set(recordRef,{userId:uid,envelope,history});tx.set(stateRef,{userId:uid,cursor});result={mutationId:m.mutationId,status:'applied',record:envelope};
   }
   tx.set(receiptRef,{userId:uid,mutation:m,result,recordKey,createdAt:now} satisfies Receipt);
   const old=deviceSnap.data();tx.set(deviceRef,{user_id:uid,device_id:this.deviceId,device_name:this.deviceName,created_at:old?.created_at??now,last_seen:now,revoked_at:old?.revoked_at??null});
   return result;
  });
 }
}
