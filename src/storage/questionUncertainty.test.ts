import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {IndexedDBProgressRepository} from './storage';
import {uncertaintyQuestionIds} from '../learning/questionUncertainty';
import type {Attempt} from '../learning/model';
const attempt=(id:string,unsure=true):Attempt=>({attempt_id:id,userId:'u',question_id:'q',timestamp:'2026-01-01',user_answer:{choice:1},correctness:'richtig',partial_status:false,unsure,confidence:unsure?'unsure':'sure',hints_used:[],error_reason:'',note:'legacy',self_assessed:false,auto_scored:true,subparts:[]});
it('migrates latest formal snapshot once without rewriting history and rejects stale toggles',async()=>{
 const r=new IndexedDBProgressRepository('uncertainty-'+crypto.randomUUID());
 const old=[attempt('a'),attempt('b',false),{...attempt('c'),correctness:null},{...attempt('d'),test_id:'deleted'}];for(const a of old)await r.saveAttempt(a);
 const before=JSON.stringify(await r.getAttempts('u'));
 const state=await r.getQuestionUncertainty('u','q');expect(state).toMatchObject({active:false,last_result_id:'b',revision:1});
 const active=await r.saveQuestionUncertainty('u','q',true,1);expect(active.entered_at).not.toBeNull();
 await expect(r.saveQuestionUncertainty('u','q',false,1)).rejects.toThrow();
 await r.saveQuestionUncertainty('u','q',false,2);expect((await r.getQuestionUncertainty('u','q'))?.active).toBe(false);
 expect(JSON.stringify(await r.getAttempts('u'))).toBe(before);expect((await r.getOutbox('u')).some(x=>String(x.entity)==='questionUncertainty')).toBe(false);r.close();
});
it('backs up local state, remaps ownership, accepts legacy exports and atomically rejects malformed records',async()=>{
 const r=new IndexedDBProgressRepository('uncertainty-backup-'+crypto.randomUUID());await r.saveQuestionUncertainty('u','manual',true,0);await r.saveAttempt(attempt('a'));
 const snap=await r.exportSnapshot('u');await r.importSnapshot(snap,'copy',true);expect((await r.getQuestionUncertainty('copy','manual'))?.active).toBe(true);
 const legacy={...snap,questionUncertainty:undefined};await r.importSnapshot(legacy,'legacy',false);expect((await r.getQuestionUncertainty('legacy','q'))?.active).toBe(true);
 await expect(r.importSnapshot({...snap,questionUncertainty:[{...snap.questionUncertainty![0],revision:0}]},'bad',false)).rejects.toThrow();expect(await r.getAttempts('bad')).toEqual([]);r.close();
});
it('migrates before reset and deletion and keeps manually marked unanswered questions eligible',async()=>{
 const r=new IndexedDBProgressRepository('uncertainty-reset-'+crypto.randomUUID());await r.saveAttempt({...attempt('a'),exam:'e',module:'m'});let p=await r.ensureModuleProgress('u',{exam:'e',module:'m',question_ids:['q']});
 p=await r.resetModuleProgress('u',p.id,p.revision,p.run_id);await r.deletePracticeAttempt('u',p.id,'a',p.run_id);expect((await r.getQuestionUncertainty('u','q'))?.active).toBe(true);
 const manual=await r.saveQuestionUncertainty('u','manual',true,0);expect([...uncertaintyQuestionIds([manual],[])]).toEqual(['manual']);
 expect(uncertaintyQuestionIds([manual],[{question_id:'manual',active:true,stage:2} as any]).size).toBe(0);
 expect(uncertaintyQuestionIds([manual],[{question_id:'manual',active:false,stage:'mastered'} as any]).size).toBe(1);r.close();
});
it('persists explicit false through reopen and later legacy-looking attempts',async()=>{
 const name='uncertainty-reopen-'+crypto.randomUUID();let r=new IndexedDBProgressRepository(name);
 await r.saveQuestionUncertainty('u','q',false,0);await r.saveAttempt(attempt('a'));r.close();r=new IndexedDBProgressRepository(name);
 expect(await r.getQuestionUncertainty('u','q')).toMatchObject({active:false,revision:1});expect(await r.getQuestionUncertainties('other')).toEqual([]);r.close();
});
import {legacyQuestionUncertainty} from '../learning/questionUncertainty';
import type {TestSession} from '../exams/model';
it('excludes discarded, deleted and unassessed linked results from migration',()=>{
 const test={test_id:'t',userId:'u',status:'completed',question_ids:['q'],result:{byQuestion:{q:'richtig'}}} as unknown as TestSession;
 const rows=[attempt('a',false),{...attempt('b'),test_id:'t'}];
 expect(legacyQuestionUncertainty('u',[],rows,[test],'2026-01-02')[0].active).toBe(true);
 for(const t of [{...test,status:'discarded'},{...test,deleted_at:'2026-01-02'},{...test,result:null}] as TestSession[])expect(legacyQuestionUncertainty('u',[],rows,[t],'2026-01-02')[0]).toMatchObject({active:false,last_result_id:'a'});
 const state=legacyQuestionUncertainty('u',[],rows,[test],'2026-01-02');expect(legacyQuestionUncertainty('u',state,rows,[test],'2026-01-03')).toEqual([]);
});
it('legacy annotation cannot rewrite uncertainty snapshots',async()=>{
 const r=new IndexedDBProgressRepository('uncertainty-snapshot-'+crypto.randomUUID());await r.saveAttempt(attempt('a'));
 await r.annotateAttempt('u','a',{note:'updated',error_reason:'',unsure:false,confidence:'sure'});
 expect((await r.getAttempts('u'))[0]).toMatchObject({unsure:true,confidence:'unsure',note:'updated'});r.close();
});

