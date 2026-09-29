import unittest
from copy import deepcopy
from attachment_bounds_review import validate_bounds_revision
class BoundsRevisionTests(unittest.TestCase):
 def fixture(self):return {'scope':'x','version':'1','pages':{'1':{'geometry':[842,1188],'explicit_regions':[{'owner':'x-p1-U1'}]}},'attachment_crops':[{'page':1,'bbox':[0,0,842,1189.969],'question_numbers':['U1']}],'expected':['U1']}
 def test_only_outside_paper_is_removed(self):
  old=self.fixture();new=deepcopy(old);new['version']='2';new['scope']='x-r2';new['pages']['1']['explicit_regions'][0]['owner']='x-r2-p1-U1';new['attachment_crops'][0]['bbox'][3]=1188;validate_bounds_revision(old,new)
 def test_in_bounds_crop_or_owner_change_rejected(self):
  for change in ['crop','owner','question']:
   old=self.fixture();new=deepcopy(old);new['attachment_crops'][0]['bbox'][3]=1188
   if change=='crop':new['attachment_crops'][0]['bbox'][0]=1
   if change=='owner':new['attachment_crops'][0]['question_numbers']=['U2']
   if change=='question':new['expected']=['U2']
   with self.assertRaises(ValueError):validate_bounds_revision(old,new)
 def test_no_repair_or_changed_geometry_rejected(self):
  old=self.fixture()
  with self.assertRaises(ValueError):validate_bounds_revision(old,deepcopy(old))
  new=deepcopy(old);new['pages']['1']['geometry'][1]=1190
  with self.assertRaises(ValueError):validate_bounds_revision(old,new)
