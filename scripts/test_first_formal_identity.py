import copy, unittest
from source_registry import (empty_registry, register_source, transition_source,
    record_first_formal_identity, STAGES, validate_registry)

class FirstFormalIdentityTests(unittest.TestCase):
 def fixture(self, formal=False):
  r,old=register_source(empty_registry(),exam='2023-sommer',module='funktionsanalyse',source_type='question_pdf',filename='old.pdf',sha256='a'*64,layout_profile='p@1',answer_profile='a@1')
  def proof(h):return {'source_sha256':h,'result':'passed','artifacts':{'new_segmented.json':'c'*64},'question_ids':['q1','q2']}
  stages=STAGES[1:6] if formal else ['hash_verified']
  for stage in stages:r=transition_source(r,old,stage,proof('a'*64))
  r=transition_source(r,old,'blocked',{'reason':'incomplete original'})
  r,new=register_source(r,exam='2023-sommer',module='funktionsanalyse',source_type='question_pdf',filename='new.pdf',sha256='b'*64,version=2,supersedes_source_id=old,layout_profile='p@2',answer_profile='a@2')
  for stage in STAGES[1:-1]:r=transition_source(r,new,stage,proof('b'*64))
  return r,old,new,proof('b'*64)
 def test_first_formal_preserves_history_and_allows_production(self):
  r,old,new,p=self.fixture();before=copy.deepcopy(r['sources'][0])
  result=record_first_formal_identity(r,new,reviewed_by='user-approved-source-completion')
  self.assertEqual(result['sources'][0],before);self.assertIsNone(r['sources'][1]['identity_migration'])
  result=transition_source(result,new,'production',p);validate_registry(result)
 def test_rejects_any_previous_formal_dataset(self):
  r,old,new,p=self.fixture(True)
  with self.assertRaisesRegex(ValueError,'previous formal'):record_first_formal_identity(r,new,reviewed_by='review')
 def test_requires_validated_new_identity_set(self):
  r,old,new,p=self.fixture();r['sources'][1]['gates']['validated'].pop('question_ids')
  with self.assertRaises(ValueError):record_first_formal_identity(r,new,reviewed_by='review')
 def test_requires_review_and_rejects_replay(self):
  r,old,new,p=self.fixture()
  with self.assertRaises(ValueError):record_first_formal_identity(r,new,reviewed_by='')
  r=record_first_formal_identity(r,new,reviewed_by='review')
  with self.assertRaises(ValueError):record_first_formal_identity(r,new,reviewed_by='review')
 def test_stale_predecessor_or_new_binding_cannot_promote(self):
  r,old,new,p=self.fixture();r=record_first_formal_identity(r,new,reviewed_by='review')
  for target in ('old','new'):
   changed=copy.deepcopy(r)
   if target=='old':changed['sources'][0]['gates']['formal_segmented']=p
   else:changed['sources'][1]['gates']['validated']['question_ids']=['q3']
   with self.assertRaises(ValueError):transition_source(changed,new,'production',p)
