import unittest
from pathlib import Path
from unittest.mock import patch
from manual_answer_promotion import prepare,module_config
from ingest import read
R=Path(__file__).resolve().parents[1]
class OvernightPromotionTests(unittest.TestCase):
 def test_empty_confirmations_cannot_promote_new_scopes(self):
  for s in read(R/'data/ingest/overnight_manual_scopes.json'):
   with patch('pymupdf.open',side_effect=AssertionError('No PDF')):
    plan=prepare(R,{'schema_version':1,'scope':s['scope'],'confirmations':[]},{})
   self.assertEqual(plan['ready'],{});self.assertEqual(plan['pending'],s['targets'])
 def test_all_answer_confirmations_do_not_bypass_attachment_hold(self):
  q=read(R/'public/data/manual_answer_review_sommer2024.json');rows=[]
  from manual_answer_promotion import FIELDS
  for item in q['items']:
   rows.append({k:item[k] for k in FIELDS}|{'official_answer':1,'official_answer_status':'confirmed','user_corrected':True,'locked':True,'confirmation_method':'manual_source_review','updated_at':'2026-09-29T12:00:00Z','machine_answer_at_confirmation':item['official_answer']})
  with patch('attachment_mapping_2024.summer_config',side_effect=lambda root,c:(c,[])):
   plan=prepare(R,{'schema_version':1,'scope':'sommer-2024','confirmations':rows},{})
  self.assertNotIn('funktionsanalyse',plan['ready']);self.assertIn('source_mapping_review',plan['pending']['funktionsanalyse'][0])
 def test_external_material_survives_manual_promotion_config(self):
  c=read(R/'scripts/layout_profiles/sommer2024_ap.json');q=read(R/'public/data/2024_sommer_arbeitsplanung_segmented.json');a=read(R/'public/data/2024_sommer_arbeitsplanung_answers.json');published={'label':'Drawing','image':'existing.png','question_numbers':['U4']}
  with patch('promote_registered_modules.ensure_timing_image',side_effect=lambda root,c,images,paths:images.update({'2':'timing.png'})),patch('external_attachments.publish_external_attachments',return_value=[published]):
   cfg=module_config({'config':c,'questions':q,'answers':a},R)
  self.assertEqual(cfg['externalAttachments'],[published])
if __name__=='__main__':unittest.main()
