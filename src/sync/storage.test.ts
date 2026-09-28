import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import Dexie from 'dexie';
import {IndexedDBProgressRepository} from '../storage/storage';
it('durably queues local writes and never acknowledges a newer in-flight edit',async()=>{
 const name='sync-'+crypto.randomUUID(),r=new IndexedDBProgressRepository(name);await r.saveCorrection('alice','q','note','first');const first=(await r.getOutbox('alice'))[0];expect((first.value as any).fields.note.value).toBe('first');await r.saveCorrection('alice','q','note','second');await r.acknowledge('alice',first,{entity:'records',id:'q',revision:1,cursor:1,updatedAt:'now',deviceId:'a',deleted:false,value:first.value});expect(await r.getOutbox('alice')).toHaveLength(1);expect((await r.get('alice','q'))?.fields.note.value).toBe('second');r.close();await Dexie.delete(name);
});
it('upgrades real v6 stores losslessly and creates no upload queue for old local data',async()=>{
 const name='legacy-v6-'+crypto.randomUUID(),old=new Dexie(name);old.version(6).stores({records:'[userId+questionId],userId',reviews:'[userId+question_id],userId',answerReviews:'[userId+question_id],userId',attempts:'[userId+attempt_id],userId,[userId+question_id]',learningSessions:'[userId+question_id],userId',testSessions:'[userId+test_id],userId,[userId+module],[userId+status]'});
 const values={records:{userId:'local',questionId:'q',fields:{note:'old'}},reviews:{userId:'local',question_id:'q',source_revision:'old'},answerReviews:{userId:'local',question_id:'q',parser_revision:'old'},attempts:{userId:'local',attempt_id:'a',question_id:'q',source_revision:'immutable'},learningSessions:{userId:'local',question_id:'q',draft:{note:'old'}},testSessions:{userId:'local',test_id:'t',source_mix:[{revision:'old'}],status:'completed'}};
 for(const [table,value]of Object.entries(values))await old.table(table).put(value);old.close();const r=new IndexedDBProgressRepository(name);const snapshot=await r.exportSnapshot('local');for(const [table,value]of Object.entries(values))expect(snapshot[table as keyof typeof values]).toEqual([value]);expect(await r.getOutbox('local')).toEqual([]);expect(await r.getSettings('local')).toEqual([]);r.close();await Dexie.delete(name);
});
