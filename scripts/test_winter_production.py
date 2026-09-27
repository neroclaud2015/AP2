import unittest,json
from pathlib import Path
from unittest.mock import patch
import numpy as np
from PIL import Image,ImageDraw
from winter_answers import detect_column,run,SOURCE
from winter_ap_dataset import NAME,validated_dataset,digest,artifacts_valid
ROOT=Path(__file__).resolve().parents[1]
class WinterOfficialTests(unittest.TestCase):
 def fixture(self,chosen,missing=False):
  scale=3;x=30;y=25;im=Image.new('L',(180,300),255);d=ImageDraw.Draw(im)
  for i in range(5):
   cx=x*scale;cy=(y+11.48*i)*scale
   if not(missing and i==2):d.ellipse((cx-3,cy-3,cx+3,cy+3),fill=0)
   if i+1 in chosen:d.ellipse((cx-17,cy-17,cx+17,cy+17),outline=0,width=3)
  return np.asarray(im),scale,x,y
 def test_all_rows(self):
  for answer in range(1,6):self.assertEqual(detect_column(*self.fixture([answer]))[0],answer)
 def test_missing_or_multiple_marks_fail_closed(self):
  for chosen in ([],[1,4]):self.assertIsNone(detect_column(*self.fixture(chosen))[0])
 def test_missing_center_fails_closed(self):self.assertIsNone(detect_column(*self.fixture([1],True))[0])
 def test_outside_page_rejected(self):
  with self.assertRaises(ValueError):detect_column(np.ones((30,30)),1,2,2)
 def test_public_integrity_and_identity(self):
  ds,_=validated_dataset(ROOT);questions={q['question_id']:q for q in ds['questions']}
  a=json.loads((ROOT/f'public/data/{NAME}_answers.json').read_text());u=json.loads((ROOT/f'public/data/{NAME}_u_solutions.json').read_text())
  self.assertEqual(len(a['answers']),28);self.assertEqual(len(u['solutions']),8)
  self.assertTrue(a['parser_revision']);self.assertTrue((ROOT/'public'/a['overlay']).is_file());self.assertTrue(a['completeness']['unique_complete']);self.assertEqual(a['completeness']['problems'],[])
  self.assertEqual({r['question_id'] for r in a['answers']+u['solutions']},set(questions))
  for r in a['answers']:
   self.assertEqual(r['official_answer_status'],'auto_ready');self.assertEqual(r['parser_revision'],a['parser_revision']);self.assertIsInstance(r['question_number'],int);self.assertFalse(r['source_pdf_available']);self.assertEqual(r['source_pdf_sha256'],SOURCE);self.assertIn(r['official_answer'],range(1,6));self.assertEqual(r['question_number'],int(questions[r['question_id']]['question_number']))
  for r in u['solutions']:self.assertFalse(r['solution_source_pdf_available']);self.assertEqual(r['source_hash'],SOURCE)
  manifest=json.loads((ROOT/'data/ingest/winter_ap_answers_manifest.json').read_text());state=manifest['versions'][manifest['active_key']]
  self.assertTrue(artifacts_valid(ROOT,state['artifacts']))
 def test_completed_resume_does_not_read_private_cache_or_pdf(self):
  import winter_answers,pymupdf,zipfile
  original=winter_answers.read
  def guarded(path):
   if 'winter_solution_cache' in str(path) or 'winter-solutions' in str(path):raise AssertionError('Private source accessed during completed resume')
   return original(path)
  with patch.object(winter_answers,'read',side_effect=guarded),patch.object(pymupdf,'open',side_effect=AssertionError('PDF opened')),patch.object(zipfile,'ZipFile',side_effect=AssertionError('ZIP opened')):
   self.assertEqual(run(ROOT)['status'],'skipped')
if __name__=='__main__':unittest.main()
