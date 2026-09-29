import unittest
from pathlib import Path
from unittest.mock import patch
from ingest import read
from answers import artifact_digest
from manual_answer_promotion import prepare,FIELDS
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parents[1]
class Sommer2021Safety(unittest.TestCase):
 def test_review_gate_and_wiso_actual_counts(self):
  q=read(ROOT/'public/data/manual_answer_review_sommer2021.json');self.assertEqual(len(q['items']),3);self.assertEqual(q['module_coverage']['WiSo'],{'mc':18,'u':6})
  empty={'schema_version':1,'scope':'sommer-2021','confirmations':[]}
  with patch('pymupdf.open',side_effect=AssertionError('No PDF')):
   result=prepare(ROOT,empty,{});self.assertEqual(result['ready'],{});self.assertEqual(result['pending'],{'funktionsanalyse':[4,23],'wiso':[18]})
   # Synthetic selections validate shape only; never apply or save these values.
   rows=[{**{k:i[k] for k in FIELDS},'official_answer':1,'official_answer_status':'confirmed','user_corrected':True,'locked':True,'confirmation_method':'manual_source_review','updated_at':'2026-09-29T12:00:00Z','machine_answer_at_confirmation':None} for i in q['items']]
   ready=prepare(ROOT,{**empty,'confirmations':rows},{})['ready'];self.assertEqual(ready['wiso']['answers']['completeness']['expected'],18);self.assertEqual(len(ready['wiso']['solutions']['solutions']),6)
 def test_upright_display_is_exact_rotation_with_original_preserved(self):
  for item in read(ROOT/'public/data/attachment_presentations.json'):
   self.assertEqual(artifact_digest(ROOT/'public'/item['source_image']),item['source_image_sha256']);self.assertEqual(artifact_digest(ROOT/'public'/item['display_image']),item['display_image_sha256'])
   with Image.open(ROOT/'public'/item['source_image']) as original,Image.open(ROOT/'public'/item['display_image']) as shown:self.assertIsNone(ImageChops.difference(original.rotate(180),shown).getbbox())
 def test_production_only_ap_and_all_question_identity_sets(self):
  modules=[m for m in read(ROOT/'public/data/promoted_modules.json') if m['examId']=='2021-sommer'];self.assertEqual([m['slug'] for m in modules],['arbeitsplanung'])
  for slug,mc,u in [('arbeitsplanung',28,8),('funktionsanalyse',28,8),('wiso',18,6)]:
   d=read(ROOT/f'public/data/2021_sommer_{slug}_segmented.json');ids=[q['question_id'] for q in d['questions']];self.assertEqual(len(ids),mc+u);self.assertEqual(len(set(ids)),len(ids));self.assertEqual({q['question_number'] for q in d['questions']},{str(i) for i in range(1,mc+1)}|{f'U{i}' for i in range(1,u+1)})
if __name__=='__main__':unittest.main()
