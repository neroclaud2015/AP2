import unittest
from pathlib import Path
from ingest import read
from answers import artifact_digest,artifacts_valid

ROOT=Path(__file__).resolve().parents[1]
class OfficialCorrectionTests(unittest.TestCase):
 def test_notice_provenance_and_exact_question_association(self):
  notices=read(ROOT/'public/data/official_corrections.json')
  for n in notices:
   dataset=read(ROOT/f"public/data/{n['exam']}_{n['module'].lower()}_segmented.json")
   matches=[q for q in dataset['questions'] if q['question_id']==n['question_id']]
   self.assertEqual(len(matches),1)
   self.assertEqual(matches[0]['question_number'],n['question_number'])
   self.assertEqual(artifact_digest(ROOT/'public'/n['source_pdf']),n['source_sha256'])
   self.assertEqual(artifact_digest(ROOT/'public'/n['source_image']),n['source_image_sha256'])
   self.assertFalse(n['automatic_grading'])
  n=next(n for n in notices if n['question_id']=='2020-21-wiso-p4-U1')
  self.assertEqual(n['affected_subparts'],['1']);self.assertEqual(n['official_points'],4)
  self.assertTrue(artifacts_valid(ROOT,read(ROOT/'data/ingest/2020-21-wiso-correction.json')['artifacts']))

if __name__=='__main__':unittest.main()
