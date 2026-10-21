import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const d=JSON.parse(await readFile('public/data/wiso_focus.json','utf8')),before=JSON.parse(execFileSync('git',['show','08751eb:public/data/wiso_focus.json'],{encoding:'utf8',maxBuffer:5e6}));
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {eligibleRecallCards}=await server.ssrLoadModule('/src/wiso/recall.tsx'),{legalReviewReasons}=await server.ssrLoadModule('/src/wiso/reviewPolicy.ts');
 const leaves=d.summaries.filter(s=>!d.taxonomy.nodes.some(n=>n.parent_id===s.topic_id&&d.summaries.some(x=>x.topic_id===n.id)));
 const cards=leaves.flatMap(s=>eligibleRecallCards(d.recall_cards,s));assert.equal(cards.length,d.recall_cards.length);
 assert.equal(leaves.filter(s=>cards.some(c=>c.topic_id===s.topic_id)).length,leaves.length);
 assert.deepEqual(d.texts,before.texts);assert.deepEqual(d.config,before.config);
 const changed=execFileSync('git',['diff','08751eb','--name-only'],{encoding:'utf8'}).trim().split('\n');assert.ok(!changed.some(p=>/^public\/assets\/|^data\/exams\/|^src\/services\/|^src\/training\/model.ts$/.test(p)));
 const report={classifications:d.classifications.length,before_manual:before.classifications.filter(c=>!c.topic_ids.length||c.confidence<.8).length,auto_accepted:d.classifications.filter(c=>c.source==='machine_accepted_high_confidence').length,machine_suggested:d.classifications.filter(c=>c.topic_ids.length&&c.confidence>=.8&&c.confidence<.95).length,manual_review:d.classifications.filter(c=>!c.topic_ids.length||c.confidence<.8).length,legal_review_topics:leaves.filter(s=>legalReviewReasons(s).length).map(s=>({topic:s.topic_id,reasons:legalReviewReasons(s)})),legal_review_questions:d.classifications.filter(c=>c.legal_review||c.legal_review_reasons?.length).length,recall_cards:cards.length,recall_topics:leaves.length,bullets:leaves.reduce((n,s)=>n+s.bullets.length,0),text_records_unchanged:true,frequency_formula_unchanged:true,confidence_note:'Operational rule confidence is not calibrated probability. Existing evidence stays at 0.80; no scores inflated to reach 0.95.',legal_note:'Legal review counts are independent topics, not ordinary per-question classification confirmations. Verified-as-of facts do not invent statutory commencement dates.'};
 await writeFile('docs/evidence/phase3d1/acceptance.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{await server.close()}
