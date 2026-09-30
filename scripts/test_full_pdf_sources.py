import unittest
from full_pdf_sources import alias
class FullPdfAliasTests(unittest.TestCase):
 def test_conflicting_original_is_rejected(self):
  index={'aliases':{}};alias(index,'source.pdf','old');alias(index,'source.pdf','old')
  with self.assertRaises(ValueError):alias(index,'source.pdf','replacement')
  self.assertEqual(index['aliases']['source.pdf'],'old')
