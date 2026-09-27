"""WiSo cache-only official answer contracts."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import cv2
import numpy as np
from PIL import Image

class WisoAnswerTests(unittest.TestCase):
 def parser(self):
  self.assertIsNotNone(importlib.util.find_spec('wiso_answers'),'WiSo cache-only extractor must exist')
  import wiso_answers
  return wiso_answers
 def grid(self,rings=(1,),missing=None,shift=0):
  image=np.full((165,75),255,np.uint8);centers=[(36,30+25*i) for i in range(5)]
  for row,(x,y) in enumerate(centers,1):
   if row!=missing:cv2.circle(image,(x,y+shift),2,0,-1)
   if row in rings:cv2.circle(image,(x,y+shift),10,0,2)
  return image,centers
 def test_all_five_rows_and_ambiguities(self):
  p=self.parser()
  for n in range(1,6):self.assertEqual(p.classify_column(*self.grid((n,)))['official_answer'],n)
  for args in [((),None,0),((2,4),None,0),((3,),5,0),((3,),None,10)]:
   self.assertIsNone(p.classify_column(*self.grid(*args))['official_answer'])
  self.assertIsNone(p.classify_column(*self.grid((2,)),number_verified=False)['official_answer'])
 def test_identity_completeness_rejects_duplicate_or_foreign(self):
  p=self.parser();q=[{'question_id':f'wiso-{n}','question_number':str(n)} for n in range(1,19)]
  q += [{'question_id':f'wiso-U{n}','question_number':f'U{n}'} for n in range(1,7)]
  source={'exam':'2017_sommer','module':'WiSo','questions':q}
  p.validate_identity(source)
  for change in [dict(source,module='Arbeitsplanung'),dict(source,questions=q+[q[0]]),dict(source,questions=q[:-1])]:
   with self.assertRaises(ValueError):p.validate_identity(change)
 def test_unverified_pixels_rejected(self):
  p=self.parser()
  with tempfile.TemporaryDirectory() as tmp:
   with self.assertRaises((ValueError,FileNotFoundError)):p.verify_cache(Path(tmp))
 def test_explicit_subparts_only(self):
  p=self.parser()
  self.assertEqual({k:len(p.subparts(k)) for k in p.REGIONS},{'U1':1,'U2':1,'U3':1,'U4':3,'U5':3,'U6':4})
  for number in p.REGIONS:
   self.assertFalse(any('numeric' in s for s in p.subparts(number)))
  self.assertEqual(p.subparts('U3')[0]['type'],'diagram')



class WisoCachePipelineTests(unittest.TestCase):
 def test_cache_only_resume_skip_and_recovery(self):
  import shutil
  import wiso_answers as p
  repo=Path(__file__).resolve().parents[1]
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp)
   for page in p.CACHE:
    for rel in [f'public/assets/pages/{p.DOC}/{page:03}.png',f'data/ingest/pages/{p.DOC}/{page:03}.json']:
     target=root/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(repo/rel,target)
   questions=[{'question_id':f'wiso-test-{n}','question_number':str(n)} for n in range(1,19)]
   questions += [{'question_id':f'wiso-test-U{n}','question_number':f'U{n}'} for n in range(1,7)]
   p.save(root/'data/exams/2017_sommer_wiso_segmented.json',{'exam':'2017_sommer','module':p.MODULE,'questions':questions})
   with patch('pymupdf.open',side_effect=AssertionError('PDF must never be reopened')):
    first=p.run(root,True);self.assertEqual(first['status'],'interrupted_after_checkpoint')
    with patch.object(p,'extract_choices',side_effect=AssertionError('Must resume choices')),patch.object(p,'extract_u',side_effect=AssertionError('Must resume U')):
     resumed=p.run(root);self.assertEqual(resumed['status'],'resumed');self.assertEqual(resumed['auto_ready'],18)
     self.assertEqual(p.run(root)['status'],'skipped')
    answers=p.read(root/'public/data/2017_sommer_wiso_answers.json')
    self.assertEqual([r['question_number'] for r in answers['answers']],list(range(1,19)))
    self.assertTrue(answers['completeness']['unique_complete'])
    for r in answers['answers']:
     self.assertTrue(r['source_crop'].startswith('assets/wiso-answers/'))
     self.assertEqual(r['source_page'],3);self.assertIn(r['official_answer'],range(1,6))
     with Image.open(root/'public'/r['source_crop']) as crop:
      b=r['source_crop_bbox_pixels'];self.assertEqual(crop.size,(b[2]-b[0],b[3]-b[1]))
    u=p.read(root/'public/data/2017_sommer_wiso_u_solutions.json')['solutions']
    self.assertEqual(len(u),6)
    for record in u:
     page,box=p.REGIONS[record['question_number']]
     with Image.open(p.cache_path(root,page)) as original,Image.open(root/'public'/record['cropped_solution_image']) as crop:
      self.assertTrue(np.array_equal(np.asarray(original.crop(tuple(box))),np.asarray(crop)))
     self.assertEqual(record['solution_bbox'],p.points(box))
    self.assertEqual([s['solution_source_page'] for s in u],[10,10,11,11,11,11])
    (root/'public'/answers['answers'][0]['source_crop']).write_bytes(b'corrupt')
    self.assertEqual(p.run(root)['choice_pages_processed'],1)
    with patch.object(p,'CONFIG_HASH','different-reviewed-config'):
     self.assertEqual(p.run(root)['choice_pages_processed'],1)
    with patch.object(p,'VERSION','next-version'):
     self.assertEqual(p.run(root)['choice_pages_processed'],1)
    # Checkpoint metadata may never be trusted after corruption.
    checkpoint=root/f'data/ingest/wiso-answers/{p.REVISION}/page-003.json'
    bad=p.read(checkpoint);bad['value']['answers'][0]['official_answer']=99;p.save(checkpoint,bad)
    (root/'public/data/2017_sommer_wiso_answers.json').write_text('{}')
    with patch.object(p,'VERSION','next-version'):
     with self.assertRaises(ValueError):p.run(root)
    # A cache mutation must be rejected even when a completed manifest exists.
    (root/f'public/assets/pages/{p.DOC}/003.png').write_bytes(b'unverified source')
    with self.assertRaises(ValueError):p.run(root)


if __name__=='__main__':unittest.main()


