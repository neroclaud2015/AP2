import unittest,tempfile,zipfile
from pathlib import Path
from unittest.mock import patch
import pymupdf
class ScopedCacheTests(unittest.TestCase):
 def test_checkpoint_reuses_pages_and_rejects_changed_cache(self):
  from portrait_dataset import cache_source,read
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);archive=root/'input.zip';doc=pymupdf.open();doc.new_page();doc.new_page();data=doc.tobytes();doc.close()
   with zipfile.ZipFile(archive,'w') as z:z.writestr('only.pdf',data);z.writestr('unrelated.pdf',b'do not read')
   first=cache_source(root,archive,'only.pdf','winter-fa',max_pages=1);self.assertEqual(first['pages_processed'],1)
   final=cache_source(root,archive,'only.pdf','winter-fa');self.assertEqual(final['pages_processed'],1)
   with patch('pymupdf.open',side_effect=AssertionError('completed source must not reopen')):
    self.assertEqual(cache_source(root,archive,'only.pdf','winter-fa')['pages_processed'],0)
   m=read(root/'data/ingest/winter-fa_source_manifest.json');(root/m['pages']['1']['image']).write_bytes(b'changed')
   with self.assertRaises(ValueError):cache_source(root,archive,'only.pdf','winter-fa')


class PortraitValidationTests(unittest.TestCase):
 def test_missing_and_overlapping_owners_are_blocked(self):
  from portrait_dataset import verify_layout
  import copy
  config={'expected':['1','2'],'pages':{'1':{}}}
  record={'page':1,'geometry':[100,100],'issues':[],
   'anchors':[{'anchor_id':'q1','number':'1','bbox':[1,1,5,5]},{'anchor_id':'q2','number':'2','bbox':[55,1,60,5]}],
   'regions':[{'page':1,'owner':'q1','role':'primary','bbox':[0,0,50,100]},{'page':1,'owner':'q2','role':'primary','bbox':[50,0,100,100]}]}
  self.assertEqual(verify_layout([record],config)['status'],'compatible')
  bad=copy.deepcopy(record);bad['anchors'].pop();self.assertEqual(verify_layout([bad],config)['status'],'blocked')
  bad=copy.deepcopy(record);bad['regions'][0]['bbox'][2]=70;self.assertEqual(verify_layout([bad],config)['status'],'blocked')
if __name__=='__main__':unittest.main()
