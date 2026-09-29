import unittest
from copy import deepcopy
from review_u_crops import validate_adjustments

class CropReviewTests(unittest.TestCase):
 def setUp(self):
  self.original={'solutions':[{'question_id':'exam-fa-U1','question_number':'U1','regions':[{'source_page':4,'bbox':[25,142,580,810]}]}]}
  self.changes={'U1':[{'source_page':4,'bbox':[25,121,580,810]}]}
 def test_accepts_small_same_page_vertical_change_without_mutating_original(self):
  before=deepcopy(self.original);validate_adjustments(self.original,self.changes,{'4':{'geometry':[595,842]}});self.assertEqual(before,self.original)
 def test_rejects_wrong_question(self):
  with self.assertRaises(ValueError):validate_adjustments(self.original,{'U2':self.changes['U1']},{'4':{'geometry':[595,842]}})
 def test_rejects_page_or_horizontal_or_large_change(self):
  for change in ({'source_page':5,'bbox':[25,121,580,810]},{'source_page':4,'bbox':[26,121,580,810]},{'source_page':4,'bbox':[25,100,580,810]},{'source_page':4,'bbox':[25,142,580,850]}):
   with self.subTest(change=change),self.assertRaises(ValueError):validate_adjustments(self.original,{'U1':[change]},{'4':{'geometry':[595,842]}})
 def test_rejects_overlap_with_another_u(self):
  self.original['solutions'].append({'question_id':'exam-fa-U2','question_number':'U2','regions':[{'source_page':4,'bbox':[25,100,580,130]}]})
  with self.assertRaises(ValueError):validate_adjustments(self.original,self.changes,{'4':{'geometry':[595,842]}})

class ReviewWriteSafetyTests(unittest.TestCase):
 def test_changed_proposal_rejected_before_any_extraction_or_write(self):
  from unittest.mock import patch
  from pathlib import Path
  import tempfile
  from ingest import save
  from review_u_crops import prepare
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);c={'name':'exam_fa','scope':'scope','source_id':'q','solution_source_id':'a'}
   u={'extractor_revision':'old','solutions':[{'question_id':'id','question_number':'U1','regions':[{'source_page':4,'bbox':[25,142,580,810]}]}]}
   save(root/'public/data/exam_fa_u_solutions.json',u);save(root/'data/reviews/scope-u-crop-review.json',{'revision':'already-accepted','changes':{}});save(root/'official.json',{'source_hash':'sha','scope':'scope'})
   original=(root/'public/data/exam_fa_u_solutions.json').read_bytes()
   with patch('promote_registered_modules.validated_bundle',return_value=(c,{}, {'source_pdf_sha256':'sha'},u)),patch('source_registry.load_registry',return_value={'sources':[{'source_id':'q','status':'validated'}]}),patch('registered_ingest.cache_metadata',return_value={'pages':{'4':{'geometry':[595,842]}}}),patch('review_u_crops.verify_cache'),patch('cached_official.extract_written') as extract:
    with self.assertRaisesRegex(ValueError,'immutable'):prepare(root,'layout',root/'official.json',{'U1':[{'source_page':4,'bbox':[25,121,580,810]}]},'changed')
    extract.assert_not_called()
   self.assertEqual(original,(root/'public/data/exam_fa_u_solutions.json').read_bytes())
 def test_published_source_cannot_be_revised(self):
  from unittest.mock import patch
  from review_u_crops import prepare
  c={'source_id':'q','solution_source_id':'a'}
  with patch('promote_registered_modules.validated_bundle',return_value=(c,{},{},{})),patch('source_registry.load_registry',return_value={'sources':[{'source_id':'q','status':'production'}]}):
   with self.assertRaisesRegex(ValueError,'Published'):prepare('.','layout','official',{},'review')

class CacheIntegrityTests(unittest.TestCase):
 def test_changed_cache_rejected_before_recrop(self):
  from unittest.mock import patch
  from review_u_crops import verify_cache
  u={'solutions':[{'question_number':'U1','regions':[{'source_page':4}], 'source_cache_hashes':{'4':'original'}}]}
  cache={'pages':{'4':{'image':'cached.png','artifacts':{'cached.png':'changed'}}}}
  with patch('review_u_crops.artifacts_valid',return_value=True),self.assertRaisesRegex(ValueError,'cache evidence changed'):verify_cache('.',u,{'U1':[]},cache)
if __name__=='__main__':unittest.main()
