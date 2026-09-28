import unittest,tempfile,shutil,json
from pathlib import Path
from unittest.mock import patch
from validate_source_registry import validate
class ProductionRegistryArtifactTests(unittest.TestCase):
 def test_registered_production_artifacts_without_source_access(self):
  root=Path(__file__).resolve().parents[1]
  with patch('pymupdf.open',side_effect=AssertionError('No source access')),patch('zipfile.ZipFile',side_effect=AssertionError('No archive access')):
   self.assertGreaterEqual(validate(root)['production_modules'],6)
 def test_changed_shipped_dataset_is_rejected(self):
  original=Path(__file__).resolve().parents[1]
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp)
   for name in ['data/source_registry.json','public/data/source_registry.json']:
    target=root/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(original/name,target)
   registry=json.loads((root/'data/source_registry.json').read_text(encoding='utf-8-sig'))
   paths={p for s in registry['sources'] if s['status']=='production' for stage in ['validated','production'] for p in s['gates'][stage]['artifacts']}
   paths.update(f'public/data/{s["exam"].replace("-","_")}_{s["module"]}_{suffix}.json' for s in registry['sources'] if s['status']=='production' for suffix in ['segmented','answers','u_solutions'])
   for name in paths:
    target=root/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(original/name,target)
   name='public/data/2017_sommer_arbeitsplanung_segmented.json'
   target=root/name;value=json.loads(target.read_text(encoding='utf-8-sig'));value['questions'][0]['question_number']='changed';target.write_text(json.dumps(value),encoding='utf8')
   with self.assertRaisesRegex(ValueError,'Production evidence changed'):validate(root)
 def test_final_reviewed_crop_hash_is_verified(self):
  original=Path(__file__).resolve().parents[1]
  registry=json.loads((original/'data/source_registry.json').read_text(encoding='utf-8-sig'))
  registry['sources']=[s for s in registry['sources'] if s['exam']=='2019-sommer' and s['module']=='wiso']
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp)
   for name in ['data/source_registry.json','public/data/source_registry.json']:
    p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(registry),encoding='utf8')
   paths={p for s in registry['sources'] for stage in ['validated','production'] for p in s['gates'][stage]['artifacts']}
   for name in paths:
    p=root/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(original/name,p)
   self.assertEqual(validate(root)['production_modules'],1)
   crop=next(p for p in paths if p.endswith('/U1.png'))
   (root/crop).write_bytes(b'changed crop')
   with self.assertRaisesRegex(ValueError,'Production evidence changed'):validate(root)
if __name__=='__main__':unittest.main()
