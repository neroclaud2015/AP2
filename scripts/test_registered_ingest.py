import unittest,tempfile,zipfile,hashlib
from pathlib import Path
from unittest.mock import patch
import pymupdf
from source_registry import empty_registry,register_source,save_registry,load_registry
class RegisteredCacheTests(unittest.TestCase):
 def fixture(self,root):
  doc=pymupdf.open();doc.new_page();doc.new_page();data=doc.tobytes();doc.close();archive=root/'input.zip'
  with zipfile.ZipFile(archive,'w') as z:z.writestr('exam.pdf',data)
  sha=hashlib.sha256(data).hexdigest();reg,sid=register_source(empty_registry(),exam='fixture',module='m',source_type='question_pdf',filename='exam.pdf',sha256=sha);save_registry(root,reg)
  return archive,sid,sha
 def test_unregistered_source_never_opens_pdf(self):
  from registered_ingest import cache_registered
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);archive,sid,sha=self.fixture(root)
   with patch('pymupdf.open',side_effect=AssertionError('Must reject before PDF access')):
    with self.assertRaises(ValueError):cache_registered(root,archive,'unknown',sha)
 def test_checkpoint_resume_and_shared_hash_deduplication(self):
  from registered_ingest import cache_registered
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);archive,sid,sha=self.fixture(root)
   self.assertEqual(cache_registered(root,archive,sid,sha,max_pages=1)['pages_processed'],1)
   self.assertEqual(cache_registered(root,archive,sid,sha)['pages_processed'],1)
   reg,sid2=register_source(load_registry(root),exam='fixture',module='another',source_type='solution_pdf',filename='exam.pdf',sha256=sha);save_registry(root,reg)
   with patch('pymupdf.open',side_effect=AssertionError('No PDF repeat')):
    self.assertEqual(cache_registered(root,archive,sid2,sha)['pages_processed'],0)
   self.assertEqual([s['status'] for s in load_registry(root)['sources']],['hash_verified','hash_verified'])
class RegisteredLayoutGateTests(unittest.TestCase):
 def test_profile_source_allowlist_blocks_before_cached_images(self):
  from registered_ingest import verify_profile_binding
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);archive,sid,sha=RegisteredCacheTests().fixture(root)
   with self.assertRaisesRegex(ValueError,'validated_sources'):
    verify_profile_binding(root,{'source_id':sid,'source_hash':sha,'validated_sources':[]})
 def test_geometry_gate_refuses_incomplete_physical_coverage(self):
  from registered_ingest import validate_cached_layout
  config={'expected':['1'],'pages':{'1':{}},'scope':'fixture'}
  with self.assertRaisesRegex(ValueError,'physical page'):
   validate_cached_layout(Path('.'),config,{'pages':{'1':{},'2':{}}},Path('unused'))

class RegisteredProductionContractTests(unittest.TestCase):
 def test_blocked_ap_resumes_without_source_or_render_and_cannot_promote(self):
  import registered_ingest as engine
  root=Path(__file__).resolve().parents[1];config=root/'scripts/layout_profiles/sommer2018_ap_blocked.json'
  with patch.object(engine,'cache_metadata',side_effect=AssertionError('No private cache')),patch.object(engine,'validate_cached_layout',side_effect=AssertionError('No layout rerun')),patch('pymupdf.open',side_effect=AssertionError('No PDF')):
   self.assertEqual(engine.run_layout(root,config)['status'],'skipped')
   with self.assertRaisesRegex(ValueError,'Blocked'):engine.run_layout(root,config,promote=True)
 def test_incomplete_fa_configuration_never_promotes(self):
  import registered_ingest as engine
  root=Path(__file__).resolve().parents[1]
  with patch.object(engine,'cache_metadata',side_effect=AssertionError('No private cache')):
   with self.assertRaisesRegex(ValueError,'Incomplete'):engine.run_layout(root,root/'scripts/layout_profiles/sommer2018_fa.json',promote=True)
 def test_accepted_configuration_tamper_rejected(self):
  import registered_ingest as engine
  root=Path(__file__).resolve().parents[1];original=engine.read
  def changed(path,*args):
   result=original(path,*args)
   if str(path).endswith('sommer2018_ap_blocked.json'):result['pages']['3']['slots'][0]['regions'][0][0]+=1
   return result
  # Actual on-disk config digest is the accepted registry boundary; mock changed digest to model edited file.
  with patch.object(engine,'artifact_digest',return_value='0'*64):
   with self.assertRaisesRegex(ValueError,'Bound profile'):engine.run_layout(root,root/'scripts/layout_profiles/sommer2018_ap_blocked.json')

class SommerWiSoFinalTests(unittest.TestCase):
 def test_final_bundle_and_cache_free_resume(self):
  import registered_ingest as engine
  from ingest import read
  root=Path(__file__).resolve().parents[1];layout=root/'scripts/layout_profiles/sommer2018_wiso.json';answers=root/'scripts/layout_profiles/sommer2018_wiso_official.json'
  q=read(root/'public/data/2018_sommer_wiso_segmented.json');a=read(root/'public/data/2018_sommer_wiso_answers.json');u=read(root/'public/data/2018_sommer_wiso_u_solutions.json')
  self.assertEqual(len(q['questions']),24);self.assertEqual(len(a['answers']),18);self.assertEqual(len(u['solutions']),6)
  ids={x['question_id'] for x in q['questions']};self.assertEqual(len(ids),24)
  self.assertTrue(all(x['question_id'] in ids and x['official_answer'] in range(1,6) for x in a['answers']))
  self.assertTrue(all(x['question_id'] in ids for x in u['solutions']))
  self.assertFalse(q['source_pdf_available']);self.assertTrue(all(not x['source_page_image'] and not x['source_page_available'] for x in q['questions']))
  self.assertEqual({x['page'] for x in q['attachment_images']},{2,3,13})
  with patch.object(engine,'cache_metadata',side_effect=AssertionError('No private cache reads')),patch.object(engine,'validate_cached_layout',side_effect=AssertionError('No page analysis')),patch('cached_official.extract_grid',side_effect=AssertionError('No grid rescan')),patch('cached_official.extract_written',side_effect=AssertionError('No U recrop')),patch('pymupdf.open',side_effect=AssertionError('No PDF open')):
   self.assertEqual(engine.run_layout(root,layout,promote=True)['status'],'skipped')
   self.assertEqual(engine.run_answers(root,layout,answers)['status'],'skipped')
 def test_formal_artifact_mutation_rejects_answer_resume(self):
  import registered_ingest as engine
  from answers import artifact_digest
  root=Path(__file__).resolve().parents[1];target=root/'public/data/2018_sommer_wiso_segmented.json'
  with patch('answers.artifact_digest',side_effect=lambda p:'bad' if Path(p)==target else artifact_digest(p)):
   with self.assertRaisesRegex(ValueError,'Accepted segmentation'):engine.run_answers(root,root/'scripts/layout_profiles/sommer2018_wiso.json',root/'scripts/layout_profiles/sommer2018_wiso_official.json')

if __name__=="__main__":unittest.main()
