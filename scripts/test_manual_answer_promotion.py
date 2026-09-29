"""Manual source review acceptance tests. Synthetic selections never reach production."""
import copy,json,unittest
from pathlib import Path
from unittest.mock import patch
from manual_answer_promotion import prepare,merge_confirmed,apply
ROOT=Path(__file__).resolve().parents[1]
def blocked_registry_fixture(registry):
 """Reconstruct the historical pre-review state only inside synthetic test fixtures."""
 result=copy.deepcopy(registry)
 for source in result['sources']:
  if source['exam']=='2018-19-winter' and source['module'] in ['arbeitsplanung','funktionsanalyse']:
   source['status']='blocked';source['blocked_after']='answers_extracted'
   source['gates']={k:v for k,v in source['gates'].items() if k not in ['validated','production']}
   cutoff=next((i for i,e in enumerate(source['events']) if e['stage']=='manual_source_review_resolved'),len(source['events']))
   source['events']=source['events'][:cutoff]
 return result
class ManualPromotionTests(unittest.TestCase):
 def setUp(self):
  self.queue=json.loads((ROOT/'public/data/manual_answer_review_queue.json').read_text(encoding='utf-8-sig'))
  self.records=[]
  for q in self.queue['items']:
   self.records.append({k:q[k] for k in ['question_id','question_number','exam','module','parser_revision','source_pdf_sha256','source_crop','source_crop_sha256','evidence_hash'] }|{'official_answer':1,'official_answer_status':'confirmed','user_corrected':True,'locked':True,'confirmation_method':'manual_source_review','updated_at':'2026-09-28T10:00:00Z','machine_answer_at_confirmation':q['official_answer']})
 def payload(self,rows=None):return {'schema_version':1,'scope':'winter-2018-19-ap-fa','confirmations':self.records if rows is None else rows}
 def test_complete_promotes_two_modules_without_pdf_access(self):
  with patch('pymupdf.open',side_effect=AssertionError('No PDF')),patch('zipfile.ZipFile',side_effect=AssertionError('No archive')):result=prepare(ROOT,self.payload(),{})
  self.assertEqual(set(result['ready']),{'arbeitsplanung','funktionsanalyse'})
  for plan in result['ready'].values():
   self.assertEqual(len(plan['answers']['answers']),28);self.assertTrue(plan['answers']['completeness']['unique_complete']);self.assertEqual(len(plan['solutions']['solutions']),8)
 def test_partial_confirmation_cannot_clear_incomplete_module(self):
  result=prepare(ROOT,self.payload(self.records[:4]),{});self.assertEqual(result['ready'],{})
  result=prepare(ROOT,self.payload(self.records[:5]),{});self.assertEqual(list(result['ready']),['arbeitsplanung'])
 def test_invalid_duplicate_and_stale_binding_rejected(self):
  for field,value in [('official_answer',6),('locked',False),('confirmation_method','machine'),('source_crop_sha256','0'*64),('evidence_hash','0'*64),('question_id','other')]:
   rows=copy.deepcopy(self.records);rows[0][field]=value
   with self.subTest(field=field),self.assertRaises(ValueError):prepare(ROOT,self.payload(rows),{})
  with self.assertRaises(ValueError):prepare(ROOT,self.payload(self.records+[self.records[0]]),{})
 def test_locked_ledger_is_idempotent_and_rejects_overwrite(self):
  ledger={r['question_id']:r for r in self.records};result=prepare(ROOT,self.payload(),ledger);self.assertEqual(result['confirmations'],ledger)
  repeated=copy.deepcopy(self.records);repeated[0]['updated_at']='2026-09-28T11:00:00Z';self.assertEqual(prepare(ROOT,self.payload(repeated),ledger)['confirmations'],ledger)
  rows=copy.deepcopy(self.records);rows[0]['official_answer']=2
  with self.assertRaisesRegex(ValueError,'locked'):prepare(ROOT,self.payload(rows),ledger)
 def test_apply_is_atomic_idempotent_and_preserves_machine_and_old_sources(self):
  import tempfile,shutil
  from source_registry import load_registry,validate_registry
  from ingest import save,read
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);paths={'public/data/manual_answer_review_queue.json','data/source_registry.json','public/data/source_registry.json'}
   before=blocked_registry_fixture(load_registry(ROOT))
   for code in ['ap','fa']:
    paths.add(f'scripts/layout_profiles/winter2018_19_{code}.json')
    for kind in ['answers','layout']:
     rel=f'data/ingest/2018-19-{code}_registered_{kind}.json';paths.add(rel);paths.update(read(ROOT/rel)['artifacts'])
   for source in before['sources']:
    if source['exam']=='2018-19-winter' and source['module'] in ['arbeitsplanung','funktionsanalyse']:
     for gate in source['gates'].values():paths.update(gate['artifacts'])
   for rel in paths:
    dest=root/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/rel,dest)
   save(root/'data/source_registry.json',before);save(root/'public/data/source_registry.json',before)
   raw={p:(root/p).read_bytes() for p in paths if p.endswith('_answers.json') or p.endswith('_segmented.json')}
   with patch('pymupdf.open',side_effect=AssertionError('No PDF')):result=apply(root,self.payload())
   self.assertEqual(len(result['ready']),2);registry=load_registry(root);validate_registry(registry)
   for old in before['sources']:
    new=next(s for s in registry['sources'] if s['source_id']==old['source_id'])
    if old['status']=='production':self.assertEqual(old,new)
    elif old['exam']=='2018-19-winter':self.assertEqual(new['status'],'production');self.assertEqual({k:new['gates'][k] for k in old['gates']},old['gates'])
   self.assertEqual(len(read(root/'public/data/promoted_modules.json')),2)
   from answers import artifact_digest
   for source in registry['sources']:
    if source['exam']=='2018-19-winter' and source['module'] in ['arbeitsplanung','funktionsanalyse']:
     for rel,expected in source['gates']['validated']['artifacts'].items():self.assertEqual(artifact_digest(root/rel),expected,rel)
   fa=next(m for m in read(root/'public/data/promoted_modules.json') if m['slug']=='funktionsanalyse');self.assertEqual(fa['questionContextPages']['13'],[8]);self.assertEqual(fa['questionContextPages']['U2'],[19,29])
   self.assertTrue(all((root/p).read_bytes()==content for p,content in raw.items()))
   apply(root,self.payload());self.assertEqual(load_registry(root),registry)
   changed=copy.deepcopy(self.records);changed[0]['official_answer']=2
   with self.assertRaises(ValueError):apply(root,self.payload(changed))
   self.assertEqual(load_registry(root),registry)
 def test_changed_machine_never_overwrites_manual_confirmation(self):
  machine=copy.deepcopy(self.queue['items'][0]);manual=self.records[0];machine['official_answer']=5;machine['parser_revision']='new';result=merge_confirmed(machine,manual)
  self.assertEqual(result['official_answer'],1);self.assertTrue(result['machine_suggestion_changed']);self.assertEqual(result['measurements'],machine['measurements']);self.assertEqual(result['manual_source_evidence']['source_crop_sha256'],manual['source_crop_sha256'])
class Winter2019ManualTests(unittest.TestCase):
 def test_actual_user_confirmation_and_no_pdf_access(self):
  payload=json.loads((ROOT/'data/reviews/winter-2019-20-user-export.json').read_text())
  with patch('pymupdf.open',side_effect=AssertionError('No PDF')),patch('zipfile.ZipFile',side_effect=AssertionError('No archive')):
   plan=prepare(ROOT,payload,{})
  answer=next(a for a in plan['ready']['funktionsanalyse']['answers']['answers'] if a['question_number']==21)
  self.assertEqual(answer['official_answer'],2);self.assertTrue(answer['locked']);self.assertIsNone(answer['machine_official_answer']);self.assertEqual(len(plan['ready']['funktionsanalyse']['solutions']['solutions']),8)
  pending=prepare(ROOT,{**payload,'confirmations':[]},{})
  self.assertEqual(pending['ready'],{});self.assertEqual(pending['pending']['funktionsanalyse'],[21])
  for field,value in [('source_crop_sha256','bad'),('locked',False),('confirmation_method','machine'),('official_answer',0)]:
   broken=copy.deepcopy(payload);broken['confirmations'][0][field]=value
   with self.subTest(field=field),self.assertRaises(ValueError):prepare(ROOT,broken,{})
  ledger={r['question_id']:r for r in payload['confirmations']};broken=copy.deepcopy(payload);broken['confirmations'][0]['official_answer']=3
  with self.assertRaisesRegex(ValueError,'locked'):prepare(ROOT,broken,ledger)
if __name__=='__main__':unittest.main()
