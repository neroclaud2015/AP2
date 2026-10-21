import {expect,test} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {eligibleRecallCards,RecallQuestions} from './recall';
import type {WisoSummary} from './model';
const summary={topic_id:'a',question_ids:['q'],legal_freshness:{relevant:true},knowledge:{status:'current',as_of:'2026-01-01',current_version_id:'v1',versions:[{id:'v1',current:true,verified:true,verified_at:'2026-01-01',effective_from:null,effective_until:null}]}} as WisoSummary;
const card={id:'c',topic_id:'a',question:'Wer darf wählen?',answer:'Verifizierte Lernantwort.',question_ids:['q'],knowledge_version_id:'v1',verified_at:'2026-01-01',references:[{title:'Amtliche Quelle',url:'https://example.test/official'}]};
test('recall requires verified current version and historical support',()=>{
 expect(eligibleRecallCards([card],summary,'2026-10-21')).toHaveLength(1);
 expect(eligibleRecallCards([{...card,knowledge_version_id:'old'}],summary,'2026-10-21')).toHaveLength(0);
 expect(eligibleRecallCards([{...card,question_ids:['absent']}],summary,'2026-10-21')).toHaveLength(0);
 expect(eligibleRecallCards([card],{...summary,knowledge:{...summary.knowledge!,status:'needs_review'}},'2026-10-21')).toHaveLength(0);
});
test('native disclosure embeds direct answer without attempt controls or handlers',()=>{
 const html=renderToStaticMarkup(<RecallQuestions cards={[card]}/>);
 expect(html).toContain('<details');expect(html).toContain('<summary>Wer darf wählen?');expect(html).toContain('Verifizierte Lernantwort.');expect(html).not.toContain('Lösung anzeigen');expect(html).not.toContain('<button');expect(html).not.toContain(' open=');
});
