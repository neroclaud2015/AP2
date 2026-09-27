import copy,unittest
from source_registry import empty_registry,register_source,transition_source,record_identity_decision,production_sources,STAGES
class SourceContractTests(unittest.TestCase):
 def register(self,registry=None,**kw):
  return register_source(registry or empty_registry(),exam='2018-sommer',module='arbeitsplanung',source_type='question_pdf',filename='AP.pdf',sha256='a'*64,**kw)
 def evidence(self,h='a'*64):return {'source_sha256':h,'result':'passed','artifacts':{'public/data/fixture_segmented.json':'c'*64},'question_ids':['q1','q2']}
 def test_registration_does_not_mutate_and_is_idempotent(self):
  original=empty_registry();r,s=self.register(original);self.assertEqual(original['sources'],[]);r2,s2=self.register(r);self.assertEqual((r2,s2),(r,s));self.assertEqual(r['sources'][0]['status'],'registered')
 def test_no_stage_skipping_or_wrong_hash(self):
  r,s=self.register()
  with self.assertRaises(ValueError):transition_source(r,s,'production',self.evidence())
  with self.assertRaises(ValueError):transition_source(r,s,'hash_verified',self.evidence('b'*64))
 def test_no_overwrite_or_duplicate_version(self):
  r,s=self.register()
  with self.assertRaises(ValueError):register_source(r,exam='2018-sommer',module='arbeitsplanung',source_type='question_pdf',filename='different.pdf',sha256='b'*64)
  with self.assertRaises(ValueError):self.register(r,supersedes_source_id=s,version=2)
 def test_replacement_preserves_old_and_blocks_unknown_mapping(self):
  r,s=self.register();old=copy.deepcopy(r['sources'][0]);r,new=register_source(r,exam='2018-sommer',module='arbeitsplanung',source_type='question_pdf',filename='AP2.pdf',sha256='b'*64,version=2,supersedes_source_id=s)
  r=record_identity_decision(r,new,'blocked',{'reason':'Cannot safely map IDs'})
  self.assertEqual(r['sources'][0],old);self.assertEqual(r['sources'][1]['status'],'blocked')
 def test_replacement_production_requires_explicit_mapping(self):
  r,s=self.register(layout_profile='old@1',answer_profile='old@1')
  for stage in STAGES[1:-1]:r=transition_source(r,s,stage,self.evidence())
  r,new=register_source(r,exam='2018-sommer',module='arbeitsplanung',source_type='question_pdf',filename='AP2.pdf',sha256='b'*64,version=2,supersedes_source_id=s,layout_profile='portrait@2',answer_profile='grid@2')
  for stage in STAGES[1:-1]:r=transition_source(r,new,stage,self.evidence('b'*64))
  with self.assertRaises(ValueError):transition_source(r,new,'production',self.evidence('b'*64))
  with self.assertRaisesRegex(ValueError,'complete validated datasets'):record_identity_decision(r,new,'preserve_ids',{'old_question_ids':['q1'],'new_question_ids':['q1'],'mapping':{'q1':'q1'},'reviewed_by':'partial'})
  r=record_identity_decision(r,new,'preserve_ids',{'old_question_ids':['q1','q2'],'new_question_ids':['q1','q2'],'mapping':{'q1':'q1','q2':'q2'},'reviewed_by':'explicit-review'})
  r=transition_source(r,new,'production',self.evidence('b'*64));self.assertEqual(r['sources'][0]['status'],'validated')
 def test_production_pair_required(self):
  r,s=self.register(layout_profile='portrait@1',answer_profile='grid@1')
  for stage in STAGES[1:]:r=transition_source(r,s,stage,self.evidence())
  with self.assertRaises(ValueError):production_sources(r,'2018-sommer','arbeitsplanung')
 def test_persistence_rejects_direct_historical_overwrite(self):
  import tempfile
  from source_registry import save_registry
  r,s=self.register()
  with tempfile.TemporaryDirectory() as directory:
   save_registry(directory,r);changed=copy.deepcopy(r);changed['sources'][0]['sha256']='b'*64
   with self.assertRaises(ValueError):save_registry(directory,changed)
   self.assertEqual(r['sources'][0]['sha256'],'a'*64)
 def test_persistence_rejects_source_deletion(self):
  import tempfile
  from source_registry import save_registry
  r,s=self.register()
  with tempfile.TemporaryDirectory() as directory:
   save_registry(directory,r)
   with self.assertRaises(ValueError):save_registry(directory,empty_registry())
 def test_existing_sources_indexed_without_pdf_access(self):
  from pathlib import Path
  from unittest.mock import patch
  from source_registry import load_registry,migrate_existing,validate_registry
  root=Path(__file__).resolve().parents[1];before=load_registry(root)
  with patch('pymupdf.open',side_effect=AssertionError('No PDF scan')),patch('zipfile.ZipFile',side_effect=AssertionError('No archive scan')):after=migrate_existing(root,before)
  self.assertEqual(after,before);validate_registry(after)
  self.assertEqual(sum(s['exam'] in ('2017-sommer','2017-18-winter') for s in after['sources']),12)
  for exam in ('2017-sommer','2017-18-winter'):
   for module in ('arbeitsplanung','funktionsanalyse','wiso'):self.assertEqual(len(production_sources(after,exam,module)),2)
 def test_replacement_checks_both_actual_dataset_files(self):
  import tempfile,json,hashlib
  from pathlib import Path
  from source_registry import validate_identity_artifacts
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);datasets={};r,old=self.register(layout_profile='old@1',answer_profile='old@1')
   for label,sha in [('old','a'*64),('new','b'*64)]:
    data={'exam':'2018_sommer','module':'Arbeitsplanung','source_sha256':sha,'questions':[{'question_id':'q1'},{'question_id':'q2'}]};path=label+'_segmented.json';(root/path).write_text(json.dumps(data),encoding='utf-8');datasets[label]=(path,hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':')).encode()).hexdigest())
   old_e=self.evidence();old_e['artifacts']=dict([datasets['old']])
   for stage in STAGES[1:-1]:r=transition_source(r,old,stage,old_e)
   r,new=register_source(r,exam='2018-sommer',module='arbeitsplanung',source_type='question_pdf',filename='new.pdf',sha256='b'*64,version=2,supersedes_source_id=old,layout_profile='new@2',answer_profile='new@2')
   new_e=self.evidence('b'*64);new_e['artifacts']=dict([datasets['new']])
   for stage in STAGES[1:-1]:r=transition_source(r,new,stage,new_e)
   r=record_identity_decision(r,new,'preserve_ids',{'old_question_ids':['q1','q2'],'new_question_ids':['q1','q2'],'mapping':{'q1':'q1','q2':'q2'},'reviewed_by':'explicit'})
   source=r['sources'][-1];validate_identity_artifacts(root,r,source)
   for label in ['old','new']:
    path=root/datasets[label][0];original=path.read_text();data=json.loads(original);data['questions'].pop();path.write_text(json.dumps(data))
    with self.assertRaisesRegex(ValueError,'Actual replacement dataset'):validate_identity_artifacts(root,r,source)
    path.write_text(original)
if __name__=='__main__':unittest.main()
