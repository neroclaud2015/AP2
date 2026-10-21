import {test,expect} from 'vitest';
import {knowledgeStillCurrent} from './knowledgeValidity';
import type {TopicKnowledge} from './KnowledgeHistory';
test('known expiry never remains current in an old deployed build',()=>{
 const k:TopicKnowledge={status:'current',as_of:'2026-01-01',current_version_id:'a',versions:[{id:'a',current:true,verified:true,verified_at:'2026-01-01',effective_from:null,effective_until:'2026-07-01',source_exam_season:null,supersedes:[],bullets:[],references:[]}]};
 expect(knowledgeStillCurrent(k,'2026-06-30')).toBe(true);expect(knowledgeStillCurrent(k,'2026-07-01')).toBe(false);
 k.versions[0].effective_until=null;k.versions.push({...k.versions[0],id:'b',current:false,effective_from:'2026-08-01'});expect(knowledgeStillCurrent(k,'2026-08-01')).toBe(false);
});
