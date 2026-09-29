import unittest
from pathlib import Path
from unittest.mock import patch
from ingest import read
from manual_answer_promotion import prepare,FIELDS
from shared_region_review import validate_confirmation
ROOT=Path(__file__).resolve().parents[1]
class Winter202122Safety(unittest.TestCase):
 def test_review_gate_and_confirmed_profile_resume(self):
  q=read(ROOT/'public/data/manual_answer_review_winter2021_22.json');self.assertEqual([x['question_number'] for x in q['items']],[23,24,26])
  payload={'schema_version':1,'scope':'winter-2021-22','confirmations':[]}
  with patch('pymupdf.open',side_effect=AssertionError('No PDF')):
   self.assertEqual(prepare(ROOT,payload,{})['pending'],{'funktionsanalyse':[23,24,26]})
   payload['confirmations']=[{**{k:i[k] for k in FIELDS},'official_answer':1,'official_answer_status':'confirmed','user_corrected':True,'locked':True,'confirmation_method':'manual_source_review','updated_at':'2026-09-29T12:00:00Z','machine_answer_at_confirmation':None} for i in q['items']]
   ready=prepare(ROOT,payload,{})['ready']['funktionsanalyse'];self.assertEqual(ready['config']['scope'],'2021-22-fa-r2');self.assertEqual(len(ready['answers']['answers']),28)
 def test_bound_repair_is_authorized_and_old_evidence_preserved(self):
  folder=ROOT/'docs/evidence/winter2021-22/fa-bounds';p=read(folder/'proposal.json');c=read(folder/'confirmation.json');validate_confirmation(p,c)
  reg=read(ROOT/'data/source_registry.json');old=next(s for s in reg['sources'] if s['source_id']==p['source_id']);self.assertEqual(old['status'],'blocked');self.assertNotIn('formal_segmented',old['gates'])
  self.assertEqual(p['previous_config']['attachment_crops'][1]['bbox'][3],1189.969);self.assertEqual(p['corrected_config']['attachment_crops'][1]['bbox'][3],1188)
 def test_production_scope_and_identity(self):
  modules=[m for m in read(ROOT/'public/data/promoted_modules.json') if m['examId']=='2021-22-winter'];self.assertEqual([m['slug'] for m in modules],['arbeitsplanung','wiso','funktionsanalyse'])
  for slug,n in [('arbeitsplanung',36),('funktionsanalyse',36),('wiso',24)]:
   q=read(ROOT/f'public/data/2021_22_winter_{slug}_segmented.json')['questions'];self.assertEqual(len(q),n);self.assertEqual(len({x['question_id'] for x in q}),n)
