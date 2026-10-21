// Editorial integrity checks; semantic source review remains a human responsibility.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const cards = read('scripts/wiso_recall_cards.json');
const versions = read('scripts/wiso_knowledge_versions.json');
const dataset = read('public/data/wiso_focus.json');
const ids = new Set(dataset.texts.map(t => t.question_id));
const unique = new Set();
for (const topic of dataset.taxonomy.nodes.filter(t => t.parent_id)) {
 const summary=dataset.summaries.find(s => s.topic_id===topic.id);
 if (!summary?.question_ids.length) continue;
 const current=versions[topic.id]?.find(v=>v.current&&v.verified);
 assert(current, `populated topic lacks verified summary: ${topic.id}`);
 assert(current.bullets.length >= 3 && current.bullets.length <= 8, `summary length: ${topic.id}`);
 assert(cards.some(c=>c.topic_id===topic.id), `populated topic lacks recall card: ${topic.id}`);
}
for (const card of cards) {
 assert(!unique.has(card.id), `duplicate ${card.id}`); unique.add(card.id);
 assert(card.question.trim() && card.answer.trim(), card.id);
 assert(card.question_ids.length && card.question_ids.every(id => ids.has(id)), `missing historical question: ${card.id}`);
 const summary=dataset.summaries.find(s=>s.topic_id===card.topic_id);
 assert(summary && card.question_ids.every(id=>summary.question_ids.includes(id)), `question outside topic summary: ${card.id}`);
 const version = versions[card.topic_id]?.find(v => v.id === card.knowledge_version_id);
 assert(version?.verified && version.current, `unverified or expired summary: ${card.id}`);
 assert(summary.knowledge?.status === 'current' && summary.knowledge.current_version_id === card.knowledge_version_id, `runtime summary does not resolve card version: ${card.id}; regenerate dataset`);
 assert(summary.knowledge.versions.some(v=>v.id===card.knowledge_version_id && v.verified), `runtime verified version missing: ${card.id}`);
 assert(!version.effective_from || version.effective_from <= summary.knowledge.as_of, `future version ${card.id}`);
 assert(!version.effective_until || version.effective_until >= summary.knowledge.as_of, `runtime expired ${card.id}`);
 assert(!version.effective_until || version.effective_until >= card.verified_at, `expired ${card.id}`);
 assert(card.verified_at === version.verified_at, `date mismatch ${card.id}`);
 assert(card.references.length && card.references.every(r => r.title && /^https:\/\//.test(r.url)), `missing source ${card.id}`);
 assert(card.references.every(r => version.references.some(v => v.url === r.url)), `unbound source ${card.id}`);
 // Answers deliberately reuse verified summary sentences, making unsupported expansion detectable.
 let rest=card.answer;
 for (const bullet of version.bullets) rest=rest.replace(bullet,'');
 assert(!rest.trim(), `answer not derived from verified summary ${card.id}`);
}
console.log(`Validated ${cards.length} cards across ${new Set(cards.map(c => c.topic_id)).size} topics.`);
