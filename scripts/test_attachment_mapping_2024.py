import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch
from ingest import read
from answers import artifacts_valid
from attachment_mapping_2024 import summer_config,winter_config,validate_winter_proposal,apply_winter,decision
ROOT=Path(__file__).resolve().parents[1]

class MappingReviewTests(unittest.TestCase):
 def test_revised_scope_future_manual_review(self):
  from manual_answer_promotion import prepare,FIELDS
  payload={'schema_version':1,'scope':'winter-2024-25-fa-mapping-v2','confirmations':[]}
  with patch('pymupdf.open',side_effect=AssertionError('No PDF scan')):
   pending=prepare(ROOT,payload,{})
  self.assertEqual(len(pending['pending']['funktionsanalyse']),17)
  for item in read(ROOT/'public/data/manual_answer_review_winter2024_25_fa_mapping_v2.json')['items']:
   payload['confirmations'].append({k:item[k] for k in FIELDS}|{'official_answer':1,'official_answer_status':'confirmed','user_corrected':True,'locked':True,'confirmation_method':'manual_source_review','updated_at':'2026-09-30T12:00:00Z','machine_answer_at_confirmation':item['official_answer']})
  # Synthetic confirmations only exercise a read-only plan; never publish guessed answers.
  plan=prepare(ROOT,payload,{})
  self.assertEqual(plan['ready']['funktionsanalyse']['config']['name'],'2024_25_winter_funktionsanalyse_mapping_v2')
 def test_summer_only_u3_and_original_unchanged(self):
  c=read(ROOT/'scripts/layout_profiles/sommer2024_fa.json');original=deepcopy(c)
  revised,proof=summer_config(ROOT,c)
  self.assertTrue(proof);self.assertEqual(c,original)
  self.assertTrue(all(a['question_numbers']==['U3'] for a in revised['external_attachments']))
  self.assertTrue(all(a['question_numbers']==['25','U3'] for a in c['external_attachments']))
 def test_winter_excludes_only_confirmed_pages(self):
  old=read(ROOT/'scripts/layout_profiles/winter2024_25_fa.json');new=winter_config(old)
  self.assertEqual([a['page'] for a in new['attachment_crops']],[13,23,24])
  self.assertEqual(new['attachment_refs']['U2'],[13,23,24])
  self.assertFalse(any(p in (25,26) for ps in new['attachment_refs'].values() for p in ps))
 def test_extra_unreviewed_change_rejected(self):
  p=read(ROOT/'data/reviews/winter2024-fa-mapping-v2/proposal.json');validate_winter_proposal(p)
  p['corrected_config']['timing_minutes']=1
  with self.assertRaises(ValueError):validate_winter_proposal(p)
 def test_stale_export_rejected(self):
  from attachment_mapping_2024 import read as original
  def altered(path):
   value=original(path)
   if str(path).endswith('overnight-user-export-2026-09-30-2.json'):
    for row in value['mapping_decisions']:row['evidence_hash']='0'*64
   return value
  with patch('attachment_mapping_2024.read',side_effect=altered):
   with self.assertRaises(ValueError):decision(ROOT,'summer')
 def test_old_evidence_and_new_answer_gate(self):
  registry=read(ROOT/'data/source_registry.json')
  old=next(s for s in registry['sources'] if s['source_id']=='src-f99f89ce0d2f0dc39a437440')
  self.assertEqual(old['status'],'blocked');self.assertNotIn('formal_segmented',old['gates'])
  for gate in old['gates'].values():self.assertTrue(artifacts_valid(ROOT,gate['artifacts']))
  q=read(ROOT/'public/data/manual_answer_review_winter2024_25_fa_mapping_v2.json')
  self.assertEqual(len(q['items']),17);self.assertTrue(all(r['official_answer'] is None for r in q['items']))

if __name__=='__main__':unittest.main()
