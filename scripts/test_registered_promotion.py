import unittest
from pathlib import Path
from ingest import read
from promote_registered_modules import validated_bundle
from manual_review_queue import queue

class RegisteredPromotionSafety(unittest.TestCase):
 def setUp(self):self.root=Path(__file__).resolve().parents[1]
 def test_uncertain_fa_cannot_promote_or_mutate_registry(self):
  before=(self.root/'data/source_registry.json').read_bytes()
  with self.assertRaisesRegex(ValueError,'Unresolved'):validated_bundle(self.root,self.root/'scripts/layout_profiles/winter2019_20_fa.json')
  self.assertEqual(before,(self.root/'data/source_registry.json').read_bytes())
 def test_legacy_review_queue_unchanged(self):
  self.assertEqual(queue(self.root),read(self.root/'public/data/manual_answer_review_queue.json'))
 def test_new_review_only_contains_uncertain_source_bound_answer(self):
  q=queue(self.root,scope='winter-2019-20',targets={'funktionsanalyse':[21]},exam='2019_20_winter')
  self.assertEqual(q,read(self.root/'public/data/manual_answer_review_winter2019_20.json'))
  self.assertEqual(len(q['items']),1);self.assertIsNone(q['items'][0]['official_answer'])
  self.assertFalse(q['items'][0]['locked'])
if __name__=='__main__':unittest.main()
