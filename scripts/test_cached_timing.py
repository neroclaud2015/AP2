import unittest,tempfile
from pathlib import Path
from ingest import save
from answers import artifact_digest
from promote_registered_modules import ensure_timing_image
class CachedTimingTest(unittest.TestCase):
 def test_copies_only_verified_cached_page_and_reuses_existing(self):
  with tempfile.TemporaryDirectory() as d:
   r=Path(d);p=r/'cached.png';p.write_bytes(b'cached-test-bytes');sha='a'*64
   save(r/f'data/ingest/registered-{sha[:24]}_source_manifest.json',{'source_hash':sha,'status':'complete','pages':{'2':{'image':'cached.png','artifacts':{'cached.png':artifact_digest(p)}}}})
   c={'source_hash':sha,'timing_source_page':2};images={};paths=[]
   ensure_timing_image(r,c,images,paths);self.assertEqual(paths[0].read_bytes(),p.read_bytes())
   original=dict(images);ensure_timing_image(r,c,images,paths);self.assertEqual(images,original);self.assertEqual(len(paths),1)
 def test_rejects_changed_cache(self):
  with tempfile.TemporaryDirectory() as d:
   r=Path(d);p=r/'cached.png';p.write_bytes(b'x');sha='b'*64
   save(r/f'data/ingest/registered-{sha[:24]}_source_manifest.json',{'source_hash':sha,'status':'complete','pages':{'2':{'image':'cached.png','artifacts':{'cached.png':'0'*64}}}})
   with self.assertRaises(ValueError):ensure_timing_image(r,{'source_hash':sha,'timing_source_page':2},{},[])
if __name__=='__main__':unittest.main()
