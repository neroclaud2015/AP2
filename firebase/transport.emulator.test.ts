import {beforeAll,afterAll,beforeEach,describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import type {Firestore} from 'firebase/firestore';
import {FirestoreTransport} from '../src/sync/firestoreTransport';
import type {FirebaseAuthProvider} from '../src/sync/FirebaseAuthProvider';
import type {PushMutation} from '../src/sync/protocol';
const enabled=!!process.env.FIRESTORE_EMULATOR_HOST;
describe.skipIf(!enabled)('real Firestore emulator transport integration; not hosted acceptance',()=>{
 let env:RulesTestEnvironment;
 beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-ap2-sync',firestore:{rules:await readFile('firestore.rules','utf8')}});});
 afterAll(async()=>{await env?.cleanup();});beforeEach(async()=>{await env.clearFirestore();});
 function transport(uid:string,device='A'){
  const context={value:uid};const db=env.authenticatedContext(uid).firestore() as unknown as Firestore;
  const auth={account:()=>({uid:context.value}),firestore:()=>db} as unknown as FirebaseAuthProvider;
  return{transport:new FirestoreTransport(auth,device,device),context};
 }
 const mutation=(mutationId='m',baseRevision=0,note='first'):PushMutation=>({mutationId,entity:'attempts',id:'a',baseRevision,deleted:false,value:{userId:'alice',attempt_id:'a',answer:{choice:'1'},source_revision:'r1',note}});
 it('push retry, concurrent CAS conflict, retained remote and explicit resolution',async()=>{
  const a=transport('alice','A').transport,b=transport('alice','B').transport;
  expect((await a.push([mutation()],'alice')).results[0].status).toBe('applied');
  expect((await a.push([mutation()],'alice')).results[0].status).toBe('duplicate');
  const conflict=(await b.push([mutation('other',0,'second')],'alice')).results[0];expect(conflict.status).toBe('conflict');expect(conflict.record.value?.note).toBe('first');
  expect((await b.push([mutation('resolve',1,'second')],'alice')).results[0].status).toBe('applied');
  const pulled=await a.pull(1,100,'alice');expect(pulled.changes).toHaveLength(1);expect(pulled.cursor).toBe(2);expect(pulled.changes[0].value?.note).toBe('second');
 });
 it('tombstone, stale edit conflict, immutable resurrection and uid isolation',async()=>{
  const a=transport('alice').transport,b=transport('bob').transport;await a.push([mutation()]);
  await a.push([{...mutation('delete',1),deleted:true,value:null}]);expect((await a.pull(1)).changes[0].deleted).toBe(true);
  expect((await a.push([mutation('stale',1)])).results[0].status).toBe('conflict');
  const forged={...mutation('forge',2),value:{...mutation().value,source_revision:'changed'}};
  expect((await a.push([forged])).results[0].reason).toBe('immutable_history');expect((await b.pull(0)).changes).toHaveLength(0);
 });
 it('account snapshot prevents in-flight work from adopting newly selected uid',async()=>{
  const {transport:a,context}=transport('alice');const pending=a.push([mutation()],'alice');context.value='bob';await expect(pending).rejects.toThrow('gewechselt');
  expect((await transport('alice').transport.pull(0)).changes).toHaveLength(0);
 });
});
