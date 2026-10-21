import unittest
from wiso_knowledge import resolve_knowledge

class KnowledgeTests(unittest.TestCase):
 def version(self,id,date,**kw):
  return dict(id=id,verified_at=date,effective_from=None,effective_until=None,source_exam_season=None,verified=True,bullets=[id],references=[{'url':'https://example.test/official'}],**kw)
 def test_latest_verified_wins_not_frequency(self):
  a=self.version('old','2020-01-01');b=self.version('new','2024-01-01',supersedes=['old'])
  r=resolve_knowledge([a,b],'2026-10-21');self.assertEqual(r['current_version_id'],'new');self.assertEqual(r['bullets'],['new']);self.assertFalse(r['versions'][0]['current']);self.assertNotIn('current',a)
 def test_new_uncertain_conflict_blocks_current(self):
  a=self.version('old','2020-01-01');b=self.version('new','2024-01-01',supersedes=['old']);b['verified']=False
  self.assertEqual(resolve_knowledge([a,b],'2026-10-21')['status'],'needs_review')
 def test_future_and_expired_not_current(self):
  a=self.version('old','2020-01-01');a['effective_until']='2025-01-01'
  b=self.version('future','2026-01-01',supersedes=['old']);b['effective_from']='2027-01-01'
  self.assertIsNone(resolve_knowledge([a,b],'2026-10-21')['current_version_id'])
 def test_unlinked_versions_require_review(self):
  self.assertEqual(resolve_knowledge([self.version('a','2020-01-01'),self.version('b','2024-01-01')],'2026-10-21')['status'],'needs_review')
 def test_unknown_effective_date_not_invented(self):
  r=resolve_knowledge([self.version('a','2026-10-21')],'2026-10-21');self.assertIsNone(r['versions'][0]['effective_from']);self.assertEqual(r['status'],'current')
 def test_no_verified_source_no_current_claim(self):
  a=self.version('a','2026-10-21');a['references']=[]
  self.assertEqual(resolve_knowledge([a],'2026-10-21')['bullets'],[])
