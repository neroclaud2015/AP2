"""Narrow user-confirmed attachment bounds revision; no PDF or ownership inference."""
from copy import deepcopy
import hashlib,json
def config_hash(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode('utf-8')).hexdigest()

def validate_bounds_revision(old,new):
 expected=deepcopy(old);changed=False
 for item in expected['attachment_crops']:
  w,h=expected['pages'][str(item['page'])]['geometry'];b=item['bbox'];clipped=[max(0,b[0]),max(0,b[1]),min(w,b[2]),min(h,b[3])]
  if clipped[0]>=clipped[2] or clipped[1]>=clipped[3]:raise ValueError('Empty attachment')
  changed|=clipped!=b;item['bbox']=clipped
 if not changed:raise ValueError('No out-of-paper bounds to repair')
 # A fresh processing scope preserves immutable historical evidence paths.
 # Prefix substitution is mechanical; question numbers and ownership stay identical.
 previous=expected['scope'];scope=new['scope'];expected['scope']=scope;expected['version']=new['version']
 for page in expected['pages'].values():
  for region in page.get('explicit_regions',[]):
   if region['owner'].startswith(previous+'-'):region['owner']=scope+region['owner'][len(previous):]
 for key in ['previous_profile_revision','supersedes_profile_revision','change_reason']:
  if key in new:expected[key]=new[key]
 if expected!=new:raise ValueError('Bounds revision may only remove outside-paper pixels; ownership/content must remain identical')

def validate_bounds_proposal(proposal):
 old=proposal['previous_config'];new=proposal['corrected_config']
 if config_hash(old)!=proposal['previous_config_sha256'] or config_hash(new)!=proposal['config_sha256']:raise ValueError('Bounds config hash mismatch')
 if proposal['artifact_hashes'].get(proposal['previous_config_path'])!=proposal['previous_config_sha256'] or proposal['artifact_hashes'].get(proposal['config_path'])!=proposal['config_sha256']:raise ValueError('Bounds config artifacts not bound')
 if old['source_id']!=proposal['source_id'] or new['source_id']!=proposal['source_id'] or old['source_hash']!=proposal['source_sha256']:raise ValueError('Bounds source mismatch')
 validate_bounds_revision(old,new)
