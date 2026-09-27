import unittest
import numpy as np
import cv2
from fa_answers import classify_column

class FAMarkTests(unittest.TestCase):
    def make(self,marked):
        im=np.full((150,90),170,np.uint8);centers=[(45,25+i*23) for i in range(5)]
        for i,(x,y) in enumerate(centers,1):
            cv2.circle(im,(x,y),1,65,-1)
            if i in marked:cv2.circle(im,(x,y),10,100,2)
        return im,centers
    def test_row_mapping_1_to_5(self):
        for row in range(1,6):
            im,c=self.make([row]);self.assertEqual(classify_column(im,c)['official_answer'],row)
    def test_two_or_zero_rings_are_review(self):
        for marked in [[],[2,4]]:
            im,c=self.make(marked);r=classify_column(im,c)
            self.assertIsNone(r['official_answer']);self.assertEqual(r['status'],'needs_review')



from pathlib import Path
from unittest.mock import patch
from copy import deepcopy
import fa_dataset, fa_answers, fa_u_solutions, promote_fa
from ingest import read
from answers import artifact_digest
ROOT=Path(__file__).resolve().parents[1]
class FAProductionTests(unittest.TestCase):
 def test_production_sources(self):
  data,_=fa_dataset.validated_dataset(ROOT)
  self.assertEqual({q['question_number'] for q in data['questions']},{str(i) for i in range(1,29)}|{'U'+str(i) for i in range(1,9)})
  self.assertEqual([q['question_number'] for q in data['questions'] if q['review_status']=='needs_review'],['9'])
  ids={q['question_id'] for q in data['questions']}
  ap=read(ROOT/'public/data/2017_sommer_arbeitsplanung_segmented.json')
  self.assertFalse(ids & {q['question_id'] for q in ap['questions']})
  for kind in ['segmented','answers','u_solutions']:
   name='2017_sommer_funktionsanalyse_'+kind+'.json'
   self.assertEqual(read(ROOT/'data/exams'/name),read(ROOT/'public/data'/name))
  answers=read(ROOT/'public/data/2017_sommer_funktionsanalyse_answers.json')['answers']
  self.assertEqual(sorted(a['question_number'] for a in answers),list(range(1,29)))
  for a in answers:
   self.assertIn(a['question_id'],ids);self.assertIn(a['official_answer'],range(1,6))
   self.assertEqual(a['source_page'],1);self.assertEqual(len(a['answer_bbox']),4)
   self.assertTrue((ROOT/'public'/a['source_crop']).is_file())
  solutions=read(ROOT/'public/data/2017_sommer_funktionsanalyse_u_solutions.json')['solutions']
  self.assertEqual(len(solutions),8)
  for a in solutions:
   self.assertIn(a['question_id'],ids);self.assertTrue(a['subparts'])
   self.assertTrue((ROOT/'public'/a['cropped_solution_image']).is_file())
 def test_ap_unchanged(self):
  for p,h in read(ROOT/'docs/evidence/phase2b2/ap_baseline.json').items():self.assertEqual(artifact_digest(ROOT/p),h,p)
 def test_resume_never_opens_pdf(self):
  with patch('pymupdf.open',side_effect=AssertionError('No rescan')):
   for pipeline in [promote_fa,fa_answers,fa_u_solutions]:self.assertEqual(pipeline.run(ROOT)['status'],'skipped')
 def test_preview_tamper(self):
  _,_,preview=fa_dataset.accepted_preview(ROOT)
  for field,value in [('question_number','999'),('regions',[]),('review_reasons',[])]:
   modified=deepcopy(preview);next(i for i in modified['items'] if i['question_number']=='9')[field]=value
   with patch('fa_dataset.verify_preview',return_value=modified):
    with self.assertRaises(ValueError):fa_dataset.accepted_preview(ROOT)
 def test_identity_rejected_before_cache(self):
  original=fa_dataset.read
  def changed(path,*args):
   value=original(path,*args)
   if str(path).endswith('2017_sommer_funktionsanalyse_segmented.json'):
    value=deepcopy(value);value['questions'][0]['question_id']='foreign-id'
   return value
  with patch('fa_dataset.read',side_effect=changed):
   for pipeline in [fa_answers,fa_u_solutions]:
    with self.assertRaises(ValueError):pipeline.run(ROOT)
 def test_u_checkpoint_tamper(self):
  original=fa_u_solutions.read
  def changed(path,*args):
   value=original(path,*args)
   if str(path).endswith('fa_u_solution_manifest.json'):return {'entries':{}}
   if str(path).endswith('U1.json'):
    value=deepcopy(value);value['record']['question_id']='foreign-id'
   return value
  with patch('fa_u_solutions.read',side_effect=changed):
   with self.assertRaisesRegex(ValueError,'metadata integrity'):fa_u_solutions.run(ROOT)
if __name__=='__main__':unittest.main()
