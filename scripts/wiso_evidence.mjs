import {createServer} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const out='docs/evidence/phase3d';await mkdir(out,{recursive:true});
const inventory=JSON.parse(await readFile('public/data/question_inventory.json','utf8')),data=JSON.parse(await readFile('public/data/wiso_focus.json','utf8'));
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
const {deriveWiso}=await server.ssrLoadModule('/src/wiso/model.ts'),{trainingDefinitionKey}=await server.ssrLoadModule('/src/training/model.ts');
const empty={attempts:[],testSessions:[],learningSessions:[],trainingRuns:[],wrongQuestions:[],questionUncertainty:[]};
const now=new Date('2026-10-21T12:00:00Z'),stats=deriveWiso(inventory,data,empty,'acceptance',now);
const topic=stats.topics.find(t=>t.id==='betriebsrat');assert.ok(topic.questionIds.length>=3);
const snapshot=structuredClone(empty);snapshot.attempts=topic.questionIds.slice(0,3).map((id,i)=>({userId:'acceptance',attempt_id:'fixture-'+i,question_id:id,timestamp:'2026-10-20T12:00:00Z',user_answer:{choice:1},correctness:i===2?'richtig':'falsch',partial_status:false,unsure:false,confidence:'sure',hints_used:[],error_reason:'',note:'',self_assessed:false,auto_scored:true,subparts:[]}));
snapshot.questionUncertainty=[0,2].map(i=>({userId:'acceptance',question_id:topic.questionIds[i],active:true,entered_at:'2026-10-20T12:00:00Z',updated_at:'2026-10-20T12:00:00Z',revision:1}));
const personal=deriveWiso(inventory,data,snapshot,'acceptance',now),focus=personal.topics.find(t=>t.id==='betriebsrat');assert.equal(focus.answered,3);assert.equal(focus.accuracy,100/3);assert.equal(focus.needIds.length,3);
const legacy={knowledgeTopicIds:[],questionTypeIds:[],moduleIds:['wiso'],examIds:[]};assert.equal(trainingDefinitionKey(legacy),'{"knowledgeTopicIds":[],"questionTypeIds":[],"moduleIds":["wiso"],"examIds":[]}');assert.equal(trainingDefinitionKey({...legacy,wisoTopicIds:[]}),trainingDefinitionKey(legacy));
const changed=execFileSync('git',['diff','71facb201d7129dc352ed4cc922fd53cd5fabc1a','--name-only'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);assert.ok(!changed.some(p=>/^(data\/exams\/|public\/assets\/|data\/source_registry|public\/data\/(source_registry|promoted_modules|.*_segmented|.*_answers|.*_u_solutions))/.test(p)));
const evidence={inventory:stats.total,seasons:stats.seasons.length,classified:stats.classified,unclassified:stats.unclassified,ranking:stats.frequentTopics.map(({id,label,count,seasonCount,recentSeasonCount,relevance,firstSeen,lastSeen})=>({id,label,count,seasonCount,recentSeasonCount,relevance,firstSeen,lastSeen})),personal_fixture:{note:'Synthetic in-memory results only; never written to personal IndexedDB',topic:focus.id,answered:focus.answered,accuracy:focus.accuracy,wrong:focus.wrongIds.length,unsure:focus.unsureIds.length,unique_need:focus.needIds.length,priority:focus.priorityLabel,reasons:focus.reasons,nextFocus:personal.nextFocus?.id},legacy_key_unchanged:true,source_datasets_unchanged:true,config:stats.config,verified_legal_cards:data.summaries.filter(s=>s.legal_freshness.relevant&&!s.legal_freshness.review_needed).map(s=>s.topic_id)};
await writeFile(out+'/acceptance.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{await server.close()}
