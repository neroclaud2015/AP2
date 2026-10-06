import 'fake-indexeddb/auto';
import {expect,test} from 'vitest';
import Dexie from 'dexie';
import {IndexedDBProgressRepository} from './storage';
test('dashboard snapshot is a read-only transaction, with no migration, outbox or derived-state writes',async()=>{
 const name='dashboard-'+crypto.randomUUID(),repo=new IndexedDBProgressRepository(name);
 await repo.getAttempts('u');const db=new Dexie(name);await db.open();
 await db.table('attempts').put({userId:'u',attempt_id:'legacy',question_id:'q',unsure:true});
 const dump=()=>Promise.all(db.tables.map(async t=>[t.name,await t.toArray()]));const before=await dump();
 expect((await repo.getDashboardSnapshot('u')).attempts).toHaveLength(1);
 expect(await dump()).toEqual(before);db.close();
});
