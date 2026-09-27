import unittest
from pathlib import Path
from unittest.mock import patch
from tempfile import TemporaryDirectory
import shutil
import u_solutions
from validate_u_solutions import validate

class USolutionTests(unittest.TestCase):
 def test_saved_scope_and_sources(self):
  self.assertEqual(validate(Path(__file__).resolve().parents[1])['solutions'],8)

 def test_resume_without_opening_pdf(self):
  source=Path(__file__).resolve().parents[1]
  with TemporaryDirectory() as directory:
   root=Path(directory)
   paths=['public/assets/pdfs/'+u_solutions.DOC+'.pdf','public/assets/u-solutions','data/ingest/u-solutions','data/exams/2017_sommer_arbeitsplanung_segmented.json']
   for path in paths:
    target=root/path;target.parent.mkdir(parents=True,exist_ok=True)
    if (source/path).is_dir():shutil.copytree(source/path,target)
    else:shutil.copyfile(source/path,target)
   with patch('u_solutions.pymupdf.open',side_effect=AssertionError('must reuse checkpoints')):
    self.assertEqual(u_solutions.run(root)['questions_processed'],0)
    self.assertEqual(u_solutions.run(root)['status'],'skipped')

if __name__=='__main__': unittest.main()
