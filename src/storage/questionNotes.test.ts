import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import Dexie from 'dexie';
import {IndexedDBProgressRepository} from './storage';
import type {Attempt} from '../learning/model';
const attempt=(id:string,note:string,time:string,q='q'):Attempt=>({attempt_id:id,userId:'local',question_id:q,timestamp:time,user_answer:{choice:2},correctness:'richtig',partial_status:false,unsure:false,confidence:'sure',hints_used:[],error_reason:'legacy reason',note,self_assessed:false,auto_scored:true,subparts:[]});
async function setup(){const name='question-notes-'+crypto.randomUUID();return {name,repo:new IndexedDBProgressRepository(name),close:async(r:IndexedDBProgressRepository)=>{r.close();await Dexie.delete(name)}}}
it('migrates session first, else latest nonempty attempt; snapshots remain exact',async()=>{const x=await setup();try{
 const old=[attempt('a','first','2024-01-01'),attempt('b','latest','2024-02-01'),attempt('c',' ','2024-03-01'),attempt('d','fallback','2024-02-01','other'),attempt('e','earlier','2024-01-01','other'),attempt('f','','2024-03-01','other')];for(const a of old)await x.repo.saveAttempt(a);
 await x.repo.saveLearningSession({userId:'local',question_id:'q',draft:{note:'session priority'},revealed:false});
 const notes=await x.repo.getQuestionNotes('local');expect(notes.find(n=>n.question_id==='q')?.text).toBe('session priority');expect(notes.find(n=>n.question_id==='other')?.text).toBe('fallback');expect(await x.repo.getAttempts('local')).toEqual(old);
 expect((await x.repo.getOutbox('local')).filter(m=>m.entity==='questionNotes')).toHaveLength(2);
}finally{await x.close(x.repo)}});
it('saved note survives reopen, draft reset, later attempts; stale edit fails; clear stays clear',async()=>{const x=await setup();let r=x.repo;try{
 const n=await r.saveQuestionNote('local','q','persistent',0,'');await r.saveAttempt(attempt('a','old snapshot','2024-01-01'));await r.saveLearningSession({userId:'local',question_id:'q',draft:{},revealed:false});r.close();r=new IndexedDBProgressRepository(x.name);expect((await r.getQuestionNote('local','q'))?.text).toBe('persistent');
 const next=await r.saveQuestionNote('local','q','new',n.revision,n.text);await expect(r.saveQuestionNote('local','q','stale',n.revision,n.text)).rejects.toThrow();await r.saveQuestionNote('local','q','',next.revision,next.text);expect((await r.getQuestionNote('local','q'))?.text).toBe('');expect((await r.getAttempts('local'))[0].note).toBe('old snapshot');expect(await r.getQuestionNote('other','q')).toBeUndefined();
}finally{await x.close(r)}});
it('backup includes notes, old backups migrate, existing note wins and import is atomic',async()=>{const x=await setup();try{
 await x.repo.saveAttempt(attempt('a','historical','2024-01-01'));const snap=await x.repo.exportSnapshot('local');expect(snap.questionNotes?.[0].text).toBe('historical');await x.repo.importSnapshot(snap,'copy',false);expect((await x.repo.getQuestionNote('copy','q'))?.text).toBe('historical');expect(await x.repo.getOutbox('copy')).toEqual([]);
 const legacy={...snap,userId:'local',questionNotes:undefined};await x.repo.importSnapshot(legacy,'legacy',false);expect((await x.repo.getQuestionNote('legacy','q'))?.text).toBe('historical');await x.repo.saveQuestionNote('legacy','q','newest',1,'historical');await x.repo.importSnapshot(legacy,'legacy',false);expect((await x.repo.getQuestionNote('legacy','q'))?.text).toBe('newest');
 const before=await x.repo.exportSnapshot('copy');await expect(x.repo.importSnapshot({...snap,questionNotes:[{...snap.questionNotes![0],text:123 as any}]},'copy',false)).rejects.toThrow();expect(await x.repo.exportSnapshot('copy')).toEqual(before);
}finally{await x.close(x.repo)}});
