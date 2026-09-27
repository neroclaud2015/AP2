import importlib.util
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
import numpy as np
import cv2


class AnswerGeometryTests(unittest.TestCase):
    def parser(self):
        self.assertIsNotNone(importlib.util.find_spec('answers'), 'independent answer parser must exist')
        import answers
        return answers

    def grid(self, rings=(1,), missing=None, shift=0):
        image = np.full((155,70), 255, np.uint8)
        centers = [(35,30+24*i) for i in range(5)]
        for row,(x,y) in enumerate(centers,1):
            if row != missing:
                cv2.circle(image,(x,y+shift),2,0,-1)
            if row in rings:
                cv2.circle(image,(x,y+shift),10,0,2)
        return image,centers

    def test_all_five_rows_map_to_one_through_five(self):
        for row in range(1,6):
            result=self.parser().detect_column(*self.grid((row,)))
            self.assertEqual(result['official_answer'],row)
            self.assertEqual(result['status'],'auto_ready')

    def test_absent_double_and_missing_dot_never_guess(self):
        for args in [((),None,0),((2,4),None,0),((3,),5,0),((3,),None,9)]:
            result=self.parser().detect_column(*self.grid(*args))
            self.assertIsNone(result['official_answer'])
            self.assertEqual(result['status'],'needs_review')

    def test_uncertain_header_cannot_be_auto_ready(self):
        result=self.parser().detect_column(*self.grid((2,)),number_verified=False)
        self.assertIsNone(result['official_answer'])
        self.assertIn('question_number_uncertain',result['review_reasons'])

    def test_horizontal_rule_is_not_a_circle(self):
        image,centers=self.grid(())
        cv2.line(image,(0,54),(69,54),0,2)
        self.assertIsNone(self.parser().detect_column(image,centers)['official_answer'])


class AnswerCheckpointTests(unittest.TestCase):
    def test_missing_duplicate_and_invalid_answers_fail_completeness(self):
        import answers
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'public').mkdir();(root/'public/source').write_bytes(b'source')
            rows=[{'question_number':n,'question_id':f'stable-{n}','official_answer':1,'status':'auto_ready','source_pdf':'source','source_crop':'source'} for n in range(1,29)]
            self.assertTrue(answers.completeness(rows,root)['unique_complete'])
            for invalid in [rows[:-1],rows+[rows[0]],[{**r,'official_answer':0} if r['question_number']==3 else r for r in rows]]:
                self.assertFalse(answers.completeness(invalid,root)['unique_complete'])
            (root/'public/source').unlink()
            self.assertFalse(answers.completeness(rows,root)['unique_complete'])

    def test_checkpoint_resume_and_complete_skip_never_open_pdf(self):
        import answers
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=root/f'public/assets/pdfs/{answers.DOC}.pdf';source.parent.mkdir(parents=True);source.write_bytes(b'test fixture')
            fingerprint=answers.digest(source)
            result={'answers':[{'question_number':1,'status':'auto_ready','source_crop':'crop.png'}],'overlay':'overlay.png','completeness':{'unique_complete':False}}
            (root/'public/crop.png').write_bytes(b'crop');(root/'public/overlay.png').write_bytes(b'overlay')
            with patch.dict(answers.LAYOUT,{'verified_pdf_sha256':fingerprint}),patch.object(answers,'render_page',return_value=result) as render:
                first=answers.run(root,True);self.assertEqual(first['status'],'interrupted_after_checkpoint');render.assert_called_once()
            with patch.dict(answers.LAYOUT,{'verified_pdf_sha256':fingerprint}),patch.object(answers,'render_page',side_effect=AssertionError('unexpected PDF processing')):
                self.assertEqual(answers.run(root)['status'],'resumed')
                self.assertEqual(answers.run(root)['status'],'skipped')
            (root/'public/crop.png').write_bytes(b'damaged crop')
            with patch.dict(answers.LAYOUT,{'verified_pdf_sha256':fingerprint}),patch.object(answers,'render_page',return_value=result) as render:
                self.assertEqual(answers.run(root)['status'],'processed');render.assert_called_once()
            with patch.dict(answers.LAYOUT,{'verified_pdf_sha256':fingerprint}),patch.object(answers,'LAYOUT_HASH','new-layout-hash'),patch.object(answers,'render_page',return_value=result) as render:
                self.assertEqual(answers.run(root)['status'],'processed');render.assert_called_once()
            # Changed parser revision cannot silently reuse the old processing key.
            with patch.dict(answers.LAYOUT,{'verified_pdf_sha256':fingerprint}),patch.object(answers,'VERSION','next'),patch.object(answers,'REVISION','next'),patch.object(answers,'render_page',return_value=result) as render:
                self.assertEqual(answers.run(root)['status'],'processed');render.assert_called_once()

    def test_json_artifact_hash_ignores_checkout_line_endings(self):
        import answers
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);p=root/'artifact.json';p.write_bytes(b'{"a":1}')
            expected=answers.digest(p)
            p.write_bytes(b'{\r\n  "a": 1\r\n}')
            self.assertTrue(answers.artifacts_valid(root,{'artifact.json':expected}))

    def test_unverified_source_is_rejected_before_page_processing(self):
        import answers
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=root/f'public/assets/pdfs/{answers.DOC}.pdf';source.parent.mkdir(parents=True);source.write_bytes(b'unknown PDF')
            with patch.object(answers,'render_page',side_effect=AssertionError('must not process unknown scope')):
                with self.assertRaisesRegex(ValueError,'Unverified source'):
                    answers.run(root)


if __name__=='__main__': unittest.main()
