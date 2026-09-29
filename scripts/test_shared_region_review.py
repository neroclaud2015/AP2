import unittest
from copy import deepcopy
from pathlib import Path
from shared_region_review import shared_revision,validate_confirmation
from ingest import read
class SharedRevisionTest(unittest.TestCase):
 def test_original_config_and_primary_regions_unchanged(self):
  c=read(Path(__file__).parent/'layout_profiles/sommer2020_ap.json');old=deepcopy(c);new=shared_revision(c,5,['7','8'],'shared-m3','2k.1.1')
  self.assertEqual(c,old);self.assertEqual(c['pages']['5']['slots'],new['pages']['5']['slots'])
  self.assertEqual(new['pages']['5']['explicit_regions'],[])
  self.assertEqual(new['shared_regions']['shared-m3']['referenced_by'],['7','8'])
  self.assertEqual(sum(x.get('shared_region_id')=='shared-m3' for x in new['attachment_crops']),1)
 def test_confirmation_requires_exact_evidence_and_mapping(self):
  p={k:k for k in ['proposal_hash','source_id','source_sha256','previous_profile_revision','new_profile_revision','config_sha256']};p.update(evidence_hashes={'Q7':'hash'},references={'7':['shared-m3'],'8':['shared-m3']})
  row={**p,'status':'confirmed','confirmed':True,'confirmation_method':'manual_shared_region_review','confirmed_at':'2026-09-29T12:00:00Z'}
  self.assertEqual(validate_confirmation(p,row),row)
  for key,value in [('source_sha256','other'),('references',{'7':[],'8':['shared-m3']}),('confirmed',False),('status','needs_review'),('evidence_hashes',{})]:
   with self.subTest(key=key),self.assertRaises(ValueError):validate_confirmation(p,{**row,key:value})
 def test_pending_revision_cannot_enter_formal_pipeline(self):
  from registered_ingest import run_layout
  root=Path(__file__).resolve().parents[1];before=(root/'data/source_registry.json').read_bytes()
  with self.assertRaises(ValueError):run_layout(root,root/'scripts/layout_profiles/sommer2020_ap_shared_v2.json',promote=True)
  self.assertEqual(before,(root/'data/source_registry.json').read_bytes())
 def test_superseded_review_cannot_be_imported(self):
  from shared_region_review import require_current_proposal
  source={'events':[{'stage':'profile_revision_proposed','proposal_hash':'old'},{'stage':'profile_revision_proposed','proposal_hash':'new'}]}
  with self.assertRaises(ValueError):require_current_proposal(source,{'proposal_hash':'old'})
  require_current_proposal(source,{'proposal_hash':'new'})
 def test_import_rejects_proposal_tampering_before_confirmation(self):
  import tempfile
  from unittest.mock import patch
  from shared_region_review import import_confirmation
  from portrait_dataset import objhash
  from ingest import save
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);proposal={'source_id':'fixture','references':{'7':['shared-m3'],'8':['shared-m3']},'artifact_hashes':{}}
   proposal['proposal_hash']=objhash(proposal);proposal['references']['7']=[]
   save(root/'proposal.json',proposal)
   with patch('shared_region_review.append_event') as append, self.assertRaisesRegex(ValueError,'Proposal content hash mismatch'):
    import_confirmation(root,root/'proposal.json',root/'confirmation.json')
   append.assert_not_called()
if __name__=='__main__':unittest.main()
