import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
import pymupdf

SPEC = importlib.util.spec_from_file_location('ingest', Path(__file__).with_name('ingest.py'))
pipeline = importlib.util.module_from_spec(SPEC) if SPEC else None
if SPEC and SPEC.loader and Path(SPEC.origin).exists():
    SPEC.loader.exec_module(pipeline)

class IngestionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.archive = self.root / 'exam.zip'
        doc = pymupdf.open()
        for number in range(1, 4):
            page = doc.new_page()
            page.insert_text((40, 60), f'Aufgabe {number}\nCalculate force.\n(4 Punkte)')
        with zipfile.ZipFile(self.archive, 'w') as archive:
            archive.writestr('2017 Sommer/Arbeitsplanung.pdf', doc.tobytes())
        doc.close()

    def run_pipeline(self, **kwargs):
        self.assertTrue(hasattr(pipeline, 'run'), 'resumable pipeline must exist')
        return pipeline.run(self.archive, self.root / 'project', '2017_sommer', **kwargs)

    def test_resume_keeps_completed_page_and_skips_unchanged_pdf(self):
        first = self.run_pipeline(max_pages=1)
        self.assertEqual(first['processed_now'], 1)
        pages = list((self.root / 'project/data/ingest/pages').rglob('*.json'))
        stamp = pages[0].stat().st_mtime_ns
        second = self.run_pipeline()
        self.assertEqual(second['processed_now'], 2)
        self.assertEqual(pages[0].stat().st_mtime_ns, stamp)
        third = self.run_pipeline()
        self.assertEqual(third['processed_now'], 0)
        self.assertEqual(third['skipped_documents'], 1)
        self.assertEqual(third['questions'], 3)

    def test_zip_traversal_rejected_before_any_extraction(self):
        with zipfile.ZipFile(self.archive, 'a') as archive:
            archive.writestr('../escape.pdf', b'bad')
        self.assertTrue(hasattr(pipeline, 'run'), 'safe extractor must exist')
        with self.assertRaises(ValueError):
            self.run_pipeline()
        self.assertFalse((self.root / 'escape.pdf').exists())

    def test_source_mutation_is_rejected(self):
        self.run_pipeline(max_pages=1)
        source = next((self.root / 'project/raw').rglob('*.pdf'))
        source.write_bytes(b'changed')
        with self.assertRaises(ValueError):
            self.run_pipeline()

    def test_uncertain_answers_not_accepted_and_source_is_retained(self):
        self.run_pipeline()
        exam = json.loads((self.root / 'project/data/exams/2017_sommer.json').read_text())
        self.assertEqual(len(exam['questions']), 3)
        question = exam['questions'][0]
        self.assertIsNone(question['official_solution'])
        self.assertEqual(question['review_status'], 'needs_review')
        self.assertEqual(question['source_reference']['page'], 1)
        self.assertEqual(question['points'], 4)
        self.assertTrue((self.root / 'project/public' / question['source_reference']['image']).exists())

if __name__ == '__main__':
    unittest.main()
