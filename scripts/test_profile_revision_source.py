import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch
from source_registry import load_registry,save_registry
from profile_revision_source import resume_confirmed_profile

ROOT=Path(__file__).resolve().parents[1]

class ProfileRevisionTests(unittest.TestCase):
 def test_confirmed_resume_is_idempotent_and_does_not_open_pdf(self):
  before=load_registry(ROOT)
  with patch('pymupdf.open',side_effect=AssertionError('No PDF')),patch('source_registry.save_registry',side_effect=AssertionError('No write on repeat')):
   sid=resume_confirmed_profile(ROOT,ROOT/'docs/evidence/phase2k1/confirmed/proposal.json',ROOT/'docs/evidence/phase2k1/confirmed/confirmation.json')
  self.assertEqual(load_registry(ROOT),before)
  child=next(s for s in before['sources'] if s['source_id']==sid)
  parent=next(s for s in before['sources'] if s['source_id']==child['profile_revision_of_source_id'])
  self.assertEqual(parent['status'],'blocked');self.assertNotIn('formal_segmented',parent['gates'])
  self.assertEqual(child['sha256'],parent['sha256'])

 def test_no_second_processing_revision_after_formal_dataset(self):
  registry=load_registry(ROOT);child=next(s for s in registry['sources'] if s.get('profile_revision_of_source_id'))
  duplicate=deepcopy(child);duplicate['source_id']='invalid-new-processing-revision';duplicate['version']+=1
  registry['sources'].append(duplicate)
  with patch('ingest.save',side_effect=AssertionError('No write')),self.assertRaisesRegex(ValueError,'cannot bypass identity migration'):
   save_registry(ROOT,registry)

 def test_tampered_confirmation_proof_is_rejected(self):
  registry=load_registry(ROOT);child=next(s for s in registry['sources'] if s.get('profile_revision_of_source_id'))
  child['profile_confirmation']['confirmation_sha256']='0'*64
  with patch('ingest.save',side_effect=AssertionError('No write')),self.assertRaisesRegex(ValueError,'proof changed'):
   save_registry(ROOT,registry)

if __name__=='__main__':unittest.main()
