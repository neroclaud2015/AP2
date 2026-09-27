import unittest
import numpy as np,cv2
class CachedOfficialTests(unittest.TestCase):
 def test_ring_policy_rejects_ambiguous_geometry(self):
  from cached_official import detect_mark
  policy={'min_ring':.4,'support':.83,'possible_ring':.32,'possible_support':.58,'margin':.15,'center':.1}
  for rings in [(1,),(2,),(3,),(4,),(5,),(),(2,4)]:
   im=np.full((175,80),255,np.uint8);centers=[(40,30+27*i) for i in range(5)]
   for i,(x,y) in enumerate(centers,1):
    cv2.circle(im,(x,y),2,0,-1)
    if i in rings:cv2.circle(im,(x,y),10,0,2)
   result=detect_mark(im,centers,policy)
   self.assertEqual(result['official_answer'],rings[0] if len(rings)==1 else None)


class PublishedFAContractTests(unittest.TestCase):
 def test_production_artifacts_and_cache_independent_skip(self):
  from pathlib import Path
  from unittest.mock import patch
  import cached_official as official
  import portrait_dataset as portrait
  from PIL import Image
  root=Path(__file__).resolve().parents[1]
  dataset=portrait.read(root/'public/data/2017_18_winter_funktionsanalyse_segmented.json')
  answers=portrait.read(root/'public/data/2017_18_winter_funktionsanalyse_answers.json')
  written=portrait.read(root/'public/data/2017_18_winter_funktionsanalyse_u_solutions.json')
  self.assertEqual(len(dataset['questions']),36);self.assertEqual(len(answers['answers']),28);self.assertEqual(len(written['solutions']),8)
  ids={q['question_id'] for q in dataset['questions']}
  for r in answers['answers']:
   self.assertIn(r['question_id'],ids);self.assertIn(r['official_answer'],range(1,6));self.assertEqual(r['source_page'],11)
   self.assertFalse(r['source_pdf_available'])
   with Image.open(root/'public'/r['source_crop']) as crop:self.assertGreater(crop.width,20)
  for r in written['solutions']:
   self.assertIn(r['question_id'],ids);self.assertFalse(r['solution_source_pdf_available']);self.assertTrue((root/'public'/r['cropped_solution_image']).is_file())
   self.assertFalse(any('numeric' in s for s in r['subparts']))
  original=official.read
  def guarded(path,*args):
   if 'winter_solution_cache' in str(path):raise AssertionError('Private solution cache unnecessary for completed skip')
   return original(path,*args)
  with patch('pymupdf.open',side_effect=AssertionError('No PDF reopening')),patch.object(official,'read',side_effect=guarded):
   self.assertEqual(official.run(root,root/'scripts/layout_profiles/winter_fa_official.json')['status'],'skipped')
  original2=portrait.read
  def guarded2(path,*args):
   if 'source_manifest' in str(path):raise AssertionError('Completed portrait artifacts skip source reads')
   return original2(path,*args)
  with patch.object(portrait,'read',side_effect=guarded2):
   self.assertEqual(portrait.run_profile(root,root/'scripts/layout_profiles/winter_fa_2017_18.json',True)['status'],'skipped')

class PublishedWiSoContractTests(unittest.TestCase):
 def test_private_cache_free_resume_and_tampered_formal_rejected(self):
  from pathlib import Path
  from unittest.mock import patch
  import copy
  import cached_official as official
  import portrait_dataset as portrait
  root=Path(__file__).resolve().parents[1];config=root/'scripts/layout_profiles/winter_wiso_official.json'
  dataset=portrait.read(root/'data/exams/2017_18_winter_wiso_segmented.json')
  self.assertEqual(len(dataset['questions']),24)
  for q in dataset['questions']:
   self.assertEqual(q['source_page_image'],'');self.assertFalse(q['source_page_available'])
   self.assertTrue(all(not r['source_page_image'] for r in q['source_regions']))
  original=official.read
  def guarded(path,*args):
   if 'winter_solution_cache' in str(path):raise AssertionError('Private solution cache read')
   return original(path,*args)
  with patch.object(official,'read',side_effect=guarded),patch('pymupdf.open',side_effect=AssertionError('PDF reopened')):
   self.assertEqual(official.run(root,config)['status'],'skipped')
  original2=portrait.read
  def guarded2(path,*args):
   if 'source_manifest' in str(path):raise AssertionError('Private source cache read')
   return original2(path,*args)
  with patch.object(portrait,'read',side_effect=guarded2):
   self.assertEqual(portrait.run_profile(root,root/'scripts/layout_profiles/winter_wiso_2017_18.json',True)['status'],'skipped')
  # Simulate a changed formal JSON with unchanged IDs. Artifact verification must reject it.
  from answers import artifact_digest as real_digest
  target=root/'data/exams/2017_18_winter_wiso_segmented.json'
  with patch('answers.artifact_digest',side_effect=lambda p:'tampered' if Path(p)==target else real_digest(p)):
   with self.assertRaisesRegex(ValueError,'segmentation artifacts'):official.run(root,config)
if __name__=='__main__':unittest.main()
