import json
from unittest.mock import patch
import test_ingest
pipeline = test_ingest.pipeline

class RecoveryTests(test_ingest.unittest.TestCase):
    setUp = test_ingest.IngestionTests.setUp
    run_pipeline = test_ingest.IngestionTests.run_pipeline
    def test_interrupted_public_copy_resumes(self):
        def interrupted_copy(source, target):
            target.write_bytes(b'truncated')
            raise OSError('simulated process interruption')
        with patch.object(pipeline.shutil, 'copyfile', side_effect=interrupted_copy):
            with self.assertRaises(OSError):
                self.run_pipeline()
        result = self.run_pipeline()
        self.assertEqual(result['pages'], 3)

    def test_derived_document_count_is_current_on_first_run(self):
        self.run_pipeline()
        exam = json.loads((self.root / 'project/data/exams/2017_sommer.json').read_text())
        self.assertEqual(exam['documents'][0]['questions_extracted'], 3)

if __name__ == '__main__':
    import unittest
    unittest.main()
