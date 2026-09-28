import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {IndexedDBProgressRepository} from '../storage/storage';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import HistoryView from './HistoryView';
import type {ProgressRepository} from '../types';
import {describe,it,expect} from 'vitest';
import {reduceSession,restoreStatus,isEligibleForAnalysis,elapsedMs,type TestSession} from './model';
import {filterHistory,historyPage,dashboardHistory,DEFAULT_HISTORY_FILTERS} from './history';
const make=(n=0):TestSession=>({test_id:String(n),exam_session_id:String(n),userId:'local',test_type:n%2?'module':'original',exam:'2017-sommer',module:'arbeitsplanung',mode:'kurz',seed:'seed',question_ids:['q'],question_models:{q:{kind:'multiple_choice',subpart_ids:[],number:'1',part:'A'}},source_mix:[{question_id:'q',exam:n%3?'2017-sommer':'2017-18-winter',module:'arbeitsplanung',question_number:'1',source_pdf:'source.pdf',source_page:1,revision:'v1'}],answers:{q:{choice:'1'}},subpart_assessments:{},official_answers:{q:1},started_at:new Date(1000+n*1000).toISOString(),completed_at:null,status:'active',current_question:'q',elapsed_time:0,active_since:1000,revision:0,duration_minutes:null,result:null});
describe('recorded restore',()=>{
 it('restores active as paused without running time while archived',()=>{const initial=make();const discarded=reduceSession(initial,{type:'discard'},6000);expect(discarded.previous_status).toBe('active');expect(discarded.discarded_from).toBe('active');const restored=reduceSession(discarded,{type:'restore'},999999);expect(restored.status).toBe('paused');expect(restored.active_since).toBeNull();expect(elapsedMs(restored,2000000)).toBe(5000);expect(restored.answers).toEqual(initial.answers);expect(restored.source_mix).toEqual(initial.source_mix);expect(discarded.status).toBe('discarded');expect(restored.revision).toBe(2);});
 it('restores completed eligibility and exact saved result',()=>{const completed=reduceSession(make(),{type:'submit'},3000);const discarded=reduceSession(completed,{type:'discard'},4000);expect(isEligibleForAnalysis(discarded)).toBe(false);const restored=reduceSession(discarded,{type:'restore'},9000);expect(isEligibleForAnalysis(restored)).toBe(true);expect(restored.result).toEqual(completed.result);expect(restored.completed_at).toBe(completed.completed_at);expect(restored.discarded_at).toBeUndefined();});
 it('supports the legacy discarded_from field but never guesses missing status',()=>{const discarded=reduceSession(make(),{type:'discard'},6000);delete discarded.previous_status;expect(restoreStatus(discarded)).toBe('paused');delete discarded.discarded_from;expect(()=>reduceSession(discarded,{type:'restore'})).toThrow();expect(()=>reduceSession(make(),{type:'restore'})).toThrow();});
 it('restores abandoned only to the archive and rejects deleted records',()=>{const abandoned=reduceSession(make(),{type:'abandon'},3000);const discarded=reduceSession(abandoned,{type:'discard'},4000);const restored=reduceSession(discarded,{type:'restore'});expect(restored.status).toBe('abandoned');expect(isEligibleForAnalysis(restored)).toBe(false);expect(()=>reduceSession({...discarded,deleted_at:'2026-01-01'},{type:'restore'})).toThrow();});
});
describe('restore repository integration',()=>{
 it('rejects stale revisions and conflicting open sessions without changing the discarded record',async()=>{
  const name='restore-'+crypto.randomUUID();const repository=new IndexedDBProgressRepository(name);
  try{
   const original={...make(0),answers:{}};await repository.createTestSession(original);const discarded=await repository.discardTestSession('local',original.test_id,0);
   await expect(repository.updateTestSession('local',original.test_id,0,{type:'restore'})).rejects.toThrow();
   const other={...make(2),answers:{}};await repository.createTestSession(other);
   await expect(repository.updateTestSession('local',original.test_id,discarded.revision,{type:'restore'})).rejects.toThrow(/offener Versuch/);
   expect((await repository.getTestSession('local',original.test_id))?.status).toBe('discarded');
   await repository.discardTestSession('local',other.test_id,0);expect((await repository.updateTestSession('local',original.test_id,discarded.revision,{type:'restore'})).status).toBe('paused');
  }finally{repository.close();await Dexie.delete(name);}
 });
});
describe('bounded immutable history',()=>{
 const sessions=Array.from({length:120},(_,i)=>({...make(i),status:(['active','paused','completed','abandoned','discarded'] as const)[i%5]}));
 it('shows twenty then forty and keeps archive outside defaults',()=>{const before=structuredClone(sessions);const normal=filterHistory(sessions);expect(normal).toHaveLength(72);expect(historyPage(normal)).toHaveLength(20);expect(historyPage(normal,40)).toHaveLength(40);expect(filterHistory(sessions,DEFAULT_HISTORY_FILTERS,{archive:true})).toHaveLength(48);expect(sessions).toEqual(before);expect(dashboardHistory(sessions,50)).toHaveLength(5);});
 it('combines type, source-year and status filters without mixing histories',()=>{const result=filterHistory(sessions,{type:'module',exam:'2017-18-winter',status:'paused'});expect(result.length).toBeGreaterThan(0);expect(result.every(s=>s.test_type==='module'&&s.source_mix[0].exam==='2017-18-winter'&&s.status==='paused')).toBe(true);expect(filterHistory(sessions,{...DEFAULT_HISTORY_FILTERS,status:'archived'})).toHaveLength(0);expect(filterHistory(sessions,{...DEFAULT_HISTORY_FILTERS,status:'archived'},{archive:true})).toHaveLength(48);});
 it('renders twenty rows and accepts an embedded selected year with all year options',()=>{
  const props={sessions,repository:{} as ProgressRepository,onOpen:()=>{},onUpdated:()=>{},onDeleted:()=>{}};
  const normal=renderToStaticMarkup(createElement(HistoryView,props));expect(normal.match(/data-test-id=/g)).toHaveLength(20);expect(normal).toContain('record-actions');expect(normal).toContain('Mehr anzeigen');
  const filtered=renderToStaticMarkup(createElement(HistoryView,{...props,initialExam:'2017-18-winter'}));expect(filtered.match(/data-test-id=/g)?.length??0).toBe(Math.min(20,filterHistory(sessions,{...DEFAULT_HISTORY_FILTERS,exam:'2017-18-winter'}).length));expect(filtered).toContain('Sommer 2018');
 });
 it('does not display soft-deleted records in either section',()=>{expect(filterHistory(sessions.map(s=>({...s,deleted_at:'now'})))).toHaveLength(0);expect(filterHistory(sessions.map(s=>({...s,deleted_at:'now'})),DEFAULT_HISTORY_FILTERS,{archive:true})).toHaveLength(0);});
});
