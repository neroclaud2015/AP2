import {beforeEach,describe,it,expect,vi} from 'vitest';
const memory=vi.hoisted(()=>({rows:new Map<string,unknown>(),tail:Promise.resolve(),beforeRead:null as null|(()=>void)}));
vi.mock('firebase/firestore',()=>({
 doc:(_db:unknown,...parts:string[])=>({path:parts.join('/')}),collection:(_db:unknown,...parts:string[])=>({path:parts.join('/')}),where:(_field:string,_op:string,value:number)=>({cursor:value}),orderBy:()=>({}),limit:(value:number)=>({limit:value}),query:(base:{path:string},...clauses:Record<string,number>[])=>({path:base.path,...Object.assign({},...clauses)}),
 getDocsFromServer:async(q:{path:string;cursor:number;limit:number})=>{memory.beforeRead?.();const rows=[...memory.rows].filter(([k,v])=>k.startsWith(q.path+'/')&&(v as any).envelope?.cursor>q.cursor).map(([,v])=>v as any).sort((a,b)=>a.envelope.cursor-b.envelope.cursor).slice(0,q.limit);return{size:rows.length,docs:rows.map(v=>({data:()=>structuredClone(v)}))};},
 runTransaction:async(_db:unknown,callback:(tx:unknown)=>Promise<unknown>)=>{
  const previous=memory.tail;let done!:()=>void;memory.tail=new Promise<void>(resolve=>{done=resolve;});await previous;const pending=new Map<string,unknown>();
  try{const result=await callback({get:async(ref:{path:string})=>{memory.beforeRead?.();const value=memory.rows.get(ref.path);return{exists:()=>value!==undefined,data:()=>structuredClone(value)};},set:(ref:{path:string},value:unknown)=>pending.set(ref.path,structuredClone(value))});for(const [k,v] of pending)memory.rows.set(k,v);return result;}finally{done();}
 }
}));
import {FirestoreTransport} from './firestoreTransport';
import type {FirebaseAuthProvider} from './FirebaseAuthProvider';
import type {PushMutation} from './protocol';
const auth=(uid:{value:string})=>({account:()=>({uid:uid.value}),firestore:()=>({})}) as unknown as FirebaseAuthProvider;
const m=(id='m',baseRevision=0,note='one'):PushMutation=>({mutationId:id,entity:'attempts',id:'attempt',baseRevision,deleted:false,value:{userId:'alice',attempt_id:'attempt',answer:{choice:'1'},source_revision:'v1',note}});
beforeEach(()=>{memory.rows.clear();memory.tail=Promise.resolve();memory.beforeRead=null;});
describe('Firestore transport transaction simulation, not security-rules or real-cloud acceptance',()=>{
 it('stable retry returns duplicate and leaves one remote record',async()=>{const a=new FirestoreTransport(auth({value:'alice'}),'A','Laptop');expect((await a.push([m()],'alice')).results[0].status).toBe('applied');expect((await a.push([m()],'alice')).results[0].status).toBe('duplicate');expect((await a.pull(0,100,'alice')).changes).toHaveLength(1);await expect(a.push([m('m',0,'changed')],'alice')).rejects.toThrow('wiederverwendet');});
 it('two devices conflict, both proposals retained, explicit current-revision write resolves',async()=>{const a=new FirestoreTransport(auth({value:'alice'}),'A','Laptop'),b=new FirestoreTransport(auth({value:'alice'}),'B','Phone');await a.push([m()]);const result=(await b.push([m('second',0,'other')])).results[0];expect(result.status).toBe('conflict');expect(result.record.value?.note).toBe('one');expect([...memory.rows.keys()].filter(k=>k.includes('/conflicts/'))).toHaveLength(1);expect((await b.push([m('resolve',1,'other')])).results[0].status).toBe('applied');expect((await a.pull(1)).changes[0].value?.note).toBe('other');});
 it('deletion vs editing retains a tombstone and conflict',async()=>{const a=new FirestoreTransport(auth({value:'alice'}),'A','Laptop');await a.push([m()]);await a.push([{...m('delete',1),deleted:true,value:null}]);const result=(await a.push([m('stale-edit',1)])).results[0];expect(result.status).toBe('conflict');expect(result.record.deleted).toBe(true);});
 it('account switch during asynchronous operation cannot read/write new uid',async()=>{const uid={value:'alice'},a=new FirestoreTransport(auth(uid),'A','Laptop');memory.beforeRead=()=>{uid.value='bob';};await expect(a.push([m()],'alice')).rejects.toThrow('gewechselt');expect(memory.rows.size).toBe(0);await expect(a.pull(0,100,'alice')).rejects.toThrow('gewechselt');});
});
