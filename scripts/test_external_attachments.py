import tempfile,unittest
from pathlib import Path
from PIL import Image
from ingest import save
from answers import artifact_digest
from external_attachments import publish_external_attachments
class SupplementTests(unittest.TestCase):
 def fixture(self,r):
  Image.new('RGB',(80,100),'white').save(r/'page.png');sha='a'*64
  save(r/f'data/ingest/registered-{sha[:24]}_source_manifest.json',{'source_hash':sha,'status':'complete','member':'drawing.pdf','pages':{'1':{'image':'page.png','geometry':[80,100],'artifacts':{'page.png':artifact_digest(r/'page.png')}}}})
  return {'exam':'2021_sommer','module':'Arbeitsplanung','expected':['U1','U2'],'external_attachments':[{'id':'drawing','sha256':sha,'filename':'drawing.pdf','source_page':1,'bbox':[0,0,80,100],'rotation_degrees':90,'label':'Drawing','question_numbers':['U1','U2']}]}
 def test_single_source_multiple_references_and_repeat(self):
  with tempfile.TemporaryDirectory() as d:
   r=Path(d);c=self.fixture(r);a=publish_external_attachments(r,c,[]);self.assertEqual(len(a),1);self.assertEqual(a[0]['question_numbers'],['U1','U2']);self.assertEqual(Image.open(r/'public'/a[0]['image']).size,(100,80));self.assertEqual(a,publish_external_attachments(r,c,[]))
 def test_rejects_changed_cache_and_unknown_owner(self):
  with tempfile.TemporaryDirectory() as d:
   r=Path(d);c=self.fixture(r);c['external_attachments'][0]['question_numbers']=['U8']
   with self.assertRaises(ValueError):publish_external_attachments(r,c,[])
   c['external_attachments'][0]['question_numbers']=['U1'];(r/'page.png').write_bytes(b'changed')
   with self.assertRaises(ValueError):publish_external_attachments(r,c,[])
if __name__=='__main__':unittest.main()
