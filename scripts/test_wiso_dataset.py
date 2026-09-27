import unittest
from pathlib import Path
from unittest.mock import patch
from copy import deepcopy
from ingest import read
from answers import artifact_digest
import refine_wiso,wiso_dataset
from acceptance_artifacts import active_evidence
ROOT=Path(__file__).resolve().parents[1]
class WiSoDatasetTests(unittest.TestCase):
 def test_coverage_and_preserved_anchors(self):
  folder,report=active_evidence(ROOT,'wiso_2017')
  self.assertEqual(report['status'],'compatible')
  for n in range(1,10):
   old=read(ROOT/refine_wiso.BASE/f'page-{n:03}.json');new=read(folder/f'page-{n:03}.json')
   for a in old['anchors']:self.assertIn(a,new['anchors'])
   for r in old['regions']:
    if r['owner'] is not None:self.assertIn(r,new['regions'])
  data=read(ROOT/'public/data/2017_sommer_wiso_segmented.json')
  self.assertEqual(len(data['questions']),24)
  self.assertEqual([q['question_number'] for q in data['questions']],[str(i) for i in range(1,19)]+['U'+str(i) for i in range(1,7)])
  self.assertEqual(data['review_queue'],[])
  for q in data['questions']:
   self.assertTrue((ROOT/'public'/q['cropped_question_image']).is_file())
   self.assertTrue(all(r['owner']==q['question_id'] for r in q['source_regions']))
  q8=next(q for q in data['questions'] if q['question_number']=='8')
  self.assertEqual(q8['bounding_box'][3],550)
  u6=next(q for q in data['questions'] if q['question_number']=='U6')
  self.assertEqual([r['page'] for r in u6['source_regions']],[5,4])
  self.assertEqual(read(ROOT/'data/exams/2017_sommer_wiso_segmented.json'),data)
 def test_resume_no_pdf_or_ocr(self):
  with patch('pymupdf.open',side_effect=AssertionError('PDF rescan')),patch('refine_wiso.LabelOCR',side_effect=AssertionError('Repeated OCR')):
   self.assertEqual(refine_wiso.run(ROOT)['status'],'skipped')
   for promote in [True,False]:self.assertEqual(wiso_dataset.run(ROOT,promote)['status'],'skipped')
 def test_source_cache_tamper_stops(self):
  with patch('refine_wiso.content_hash',return_value='corrupt'):
   with self.assertRaisesRegex(ValueError,'integrity'):refine_wiso.run(ROOT)
 def test_incomplete_layout_cannot_promote(self):
  folder,report=active_evidence(ROOT,'wiso_2017');report=deepcopy(report);report['detected_question_count']=23
  with patch('wiso_dataset.active_evidence',return_value=(folder,report)):
   with self.assertRaisesRegex(ValueError,'completeness'):wiso_dataset.run(ROOT,True)
 def test_heading_evidence_tamper_stops_without_ocr(self):
  original=refine_wiso.content_hash
  with patch('refine_wiso.content_hash',side_effect=lambda p:'corrupt' if 'wiso-headings' in str(p) else original(p)),patch('refine_wiso.LabelOCR',side_effect=AssertionError('Repeated OCR')):
   with self.assertRaisesRegex(ValueError,'integrity'):refine_wiso.run(ROOT)
 def test_source_metadata_tamper_stops_before_skip(self):
  original=wiso_dataset.read
  def changed(path,*args):
   value=original(path,*args)
   if str(path).endswith('2017_sommer.json'):
    value=deepcopy(value);next(d for d in value['documents'] if d['id']==wiso_dataset.DOC)['sha256']='wrong'
   return value
  with patch('wiso_dataset.read',side_effect=changed):
   with self.assertRaisesRegex(ValueError,'metadata integrity'):wiso_dataset.run(ROOT,True)
if __name__=='__main__':unittest.main()
