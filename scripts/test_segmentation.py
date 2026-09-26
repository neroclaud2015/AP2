import importlib.util
from pathlib import Path
import unittest

path = Path(__file__).with_name('segment.py')
spec = importlib.util.spec_from_file_location('segment', path)
segment = importlib.util.module_from_spec(spec)
if path.exists():
    spec.loader.exec_module(segment)

class LayoutTests(unittest.TestCase):
    def test_side_by_side_questions_never_share_regions(self):
        self.assertTrue(hasattr(segment, 'assign_cells'), 'coordinate region assignment required')
        markers = [{'number': '3', 'row': 0, 'col': 0}, {'number': '4', 'row': 1, 'col': 0},
                   {'number': '5', 'row': 1, 'col': 1}, {'number': '6', 'row': 2, 'col': 0}]
        regions = segment.assign_cells(markers, [50, 300, 550], [50, 290, 530, 780])
        self.assertEqual(regions['4'], [[50, 290, 300, 530]])
        self.assertEqual(regions['5'], [[300, 290, 550, 530]])
        self.assertEqual(regions['3'], [[50, 50, 550, 290]])

    def test_l_shape_keeps_top_diagram_without_neighbor(self):
        self.assertTrue(hasattr(segment, 'assign_cells'), 'non-rectangular question regions required')
        markers = [{'number': '24', 'row': 0, 'col': 0}, {'number': '25', 'row': 1, 'col': 1}]
        regions = segment.assign_cells(markers, [50, 300, 550], [50, 290, 530, 780])
        self.assertEqual(regions['24'], [[50, 50, 550, 290], [50, 290, 300, 780]])
        self.assertEqual(regions['25'], [[300, 290, 550, 780]])

    def test_numbered_work_area_belongs_to_named_question(self):
        markers = [{'number': '24', 'row': 0, 'col': 0}, {'number': '25', 'row': 1, 'col': 1}]
        regions = segment.assign_cells(markers, [50, 300, 550], [50, 290, 530, 780], {(2, 0): '25'})
        self.assertEqual(regions['24'], [[50, 50, 550, 290], [50, 290, 300, 530]])
        self.assertEqual(regions['25'], [[300, 290, 550, 530], [50, 530, 550, 780]])

    def test_missing_question_prevents_auto_ready_publication(self):
        self.assertTrue(hasattr(segment, 'assess_coverage'), 'missing-label checks required')
        questions = [{'question_number': '1', 'review_status': 'auto_ready', 'extraction_confidence': .96, 'review_reasons': []}]
        report = segment.assess_coverage(questions, {'1', '2'})
        self.assertEqual(report['missing'], ['2'])
        self.assertEqual(questions[0]['review_status'], 'needs_review')

    def test_corrected_ocr_number_does_not_change_source_identity(self):
        self.assertTrue(hasattr(segment, 'question_identity'), 'stable source anchor identity required')
        first = segment.question_identity('document', 3, {'anchor': 'h0-r0-c0', 'number': '24'})
        corrected = segment.question_identity('document', 3, {'anchor': 'h0-r0-c0', 'number': '29'})
        neighbor = segment.question_identity('document', 3, {'anchor': 'h0-r1-c1', 'number': '24'})
        self.assertEqual(first, corrected)
        self.assertNotEqual(first, neighbor)

    def test_auxiliary_text_excludes_other_column(self):
        self.assertTrue(hasattr(segment, 'region_text'), 'coordinate-filtered text required')
        lines = [{'text': 'left question', 'bbox': [55, 310, 180, 324]},
                 {'text': 'RIGHT QUESTION', 'bbox': [310, 310, 490, 324]},
                 {'text': 'left answer', 'bbox': [55, 350, 200, 364]}]
        self.assertEqual(segment.region_text(lines, [[50, 290, 300, 530]]), 'left question\nleft answer')

if __name__ == '__main__': unittest.main()
