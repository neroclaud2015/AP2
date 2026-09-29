"""Build only the Sommer 2020 AP Q7/Q8 manual mapping proposal from immutable cache."""
from pathlib import Path
from copy import deepcopy
import shutil
from unittest.mock import patch
from PIL import Image,ImageDraw
from ingest import read,save
from answers import artifact_digest
from registered_ingest import cache_metadata,validate_cached_layout
from shared_region_review import shared_revision,immutable_save,append_event
from layout_profiles.portrait_raster import patch_image
from portrait_dataset import objhash
from source_registry import load_registry
ROOT=Path(__file__).resolve().parents[1]
def build(root=ROOT, correction=False):
 oldpath=root/'scripts/layout_profiles/sommer2020_ap.json';old=read(oldpath);source=next(s for s in load_registry(root)['sources'] if s['source_id']==old['source_id']);previous=source['layout_profile']
 if correction:
  oldpath=root/'scripts/layout_profiles/sommer2020_ap_shared_v2.json';old=read(oldpath);previous=read(root/'docs/evidence/phase2k1/proposal.json')['new_profile_revision'];new=deepcopy(old);new['version']='2k.1.2'
  w=new['pages']['5']['geometry'][0]
  q7=next(s for s in new['pages']['5']['slots'] if s['observed_number']=='7');q8=next(s for s in new['pages']['5']['slots'] if s['observed_number']=='8')
  q7['regions'][0][3]=round(197.7*w/392,3);q8['regions'][0][1]=round(198.4*w/392,3);q8['heading_box'][1]=round(199*w/392,3);q8['heading_box'][3]=round(217*w/392,3)
  cache=cache_metadata(root,old['source_hash'])
  from layout_profiles.portrait_raster import patch_hash
  with Image.open(root/cache['pages']['5']['image']) as im:q8['visual_patch_sha256']=patch_hash(patch_image(im,q8['heading_box'],cache['pages']['5']['geometry']))
  new['boundary_correction_evidence']={'page':5,'separator_pixel_rows':[751,752],'reason':'Observed ruled boundary separates complete Q7 option5 from Q8. Stable page/question identities retained.'}
 else:new=shared_revision(old,5,['7','8'],'shared-m3','2k.1.1')
 new['previous_profile_revision']=previous;new['supersedes_profile_revision']=previous;new['change_reason']='manual_shared_region_review'
 newpath=root/('scripts/layout_profiles/sommer2020_ap_shared_v3.json' if correction else 'scripts/layout_profiles/sommer2020_ap_shared_v2.json');immutable_save(newpath,new)
 revision=new['profile_id']+'@'+new['version']+'-'+artifact_digest(newpath)[:12]
 folder=root/('docs/evidence/phase2k1/revised' if correction else 'docs/evidence/phase2k1');folder.mkdir(parents=True,exist_ok=True)
 auditpath=folder/'old-audit-snapshot.json';original_source={**source,'events':[e for e in source['events'] if not (e.get('stage') in ('profile_revision_proposed','profile_revision_confirmed'))]}
 snapshot={'source':original_source,'old_config_sha256':artifact_digest(oldpath),'old_failure_sha256':artifact_digest(root/'docs/evidence/phase2k/ap-blocked.json')}
 immutable_save(auditpath,snapshot)
 old_checkpoint=(root/'data/ingest/profile-revisions'/previous.replace('@','-')) if correction else root/'data/ingest/2020-ap-layout'/previous.split('@')[1]
 checkpoints=root/'data/ingest/profile-revisions'/revision.replace('@','-')
 checkpoints.mkdir(parents=True,exist_ok=True)
 copied=0
 for p in old_checkpoint.glob('page-*.json'):
  n=str(int(p.stem.split('-')[1]))
  if old['pages'][n]==new['pages'][n]:
   if not (checkpoints/p.name).exists():shutil.copyfile(p,checkpoints/p.name)
   copied+=1
 with patch('pymupdf.open',side_effect=AssertionError('PDF access prohibited')):
  cache=cache_metadata(root,old['source_hash']);records,validation=validate_cached_layout(root,new,cache,checkpoints)
  assert validation['status']=='compatible' and validation['observed']==36
  page=cache['pages']['5'];geometry=page['geometry'];im=Image.open(root/page['image']).convert('RGB')
  images={}
  for num in ['7','8']:
   slot=next(s for s in new['pages']['5']['slots'] if s['observed_number']==num);img=patch_image(im,slot['regions'][0],geometry);dest=folder/f'Q{num}.png';img.save(dest);images['Q'+num]=dest
  dest=folder/'shared-m3.png';patch_image(im,new['shared_regions']['shared-m3']['bbox'],geometry).save(dest);images['shared-m3']=dest
  im.thumbnail((1000,1415));draw=ImageDraw.Draw(im)
  for num in ['7','8']:
   b=next(s for s in new['pages']['5']['slots'] if s['observed_number']==num)['regions'][0];bb=[b[0]*im.width/geometry[0],b[1]*im.height/geometry[1],b[2]*im.width/geometry[0],b[3]*im.height/geometry[1]];draw.rectangle(bb,outline='green',width=4);draw.text((bb[0]+5,bb[1]+24),'Q'+num+' primary',fill='green')
  b=new['shared_regions']['shared-m3']['bbox'];bb=[b[0]*im.width/geometry[0],b[1]*im.height/geometry[1],b[2]*im.width/geometry[0],b[3]*im.height/geometry[1]];draw.rectangle(bb,outline='blue',width=4);draw.text((bb[0]+5,bb[1]+5),'shared-m3: Q7 + Q8',fill='blue');im.save(folder/'ownership-overlay.jpg')
 validation.update(new_profile_revision=revision,previous_profile_revision=previous,old_pdf_rescans=0,new_pages_rendered=0,cached_pages_reused=30,unchanged_page_checkpoints_reused=copied,changed_page=5,human_review='pending',formal_segmentation=False)
 immutable_save(folder/'validation.json',validation)
 artifacts={p.relative_to(root).as_posix():artifact_digest(p) for p in [oldpath,newpath,auditpath,folder/'validation.json',folder/'ownership-overlay.jpg',*images.values(),root/'docs/evidence/phase2k/ap-blocked.json']}
 proposal={'schema_version':1,'source_id':source['source_id'],'source_sha256':source['sha256'],'source_page':5,'exam':'2020-sommer','module':'arbeitsplanung','status':'pending_manual_review','previous_profile_revision':previous,'new_profile_revision':revision,'supersedes_profile_revision':previous,'change_reason':'manual_shared_region_review','config_path':newpath.relative_to(root).as_posix(),'config_sha256':artifact_digest(newpath),'references':{'7':['shared-m3'],'8':['shared-m3']},'shared_regions':new['shared_regions'],'evidence_hashes':{k:artifact_digest(p) for k,p in images.items()},'artifact_hashes':artifacts}
 proposal['proposal_hash']=objhash(proposal);immutable_save(folder/'proposal.json',proposal)
 print(append_event(root,proposal,'profile_revision_proposed',{'proposal_path':(folder/'proposal.json').relative_to(root).as_posix(),'sha256':artifact_digest(folder/'proposal.json')}))
 actual=next(s for s in load_registry(root)['sources'] if s['source_id']==source['source_id']);assert actual['events'][:len(original_source['events'])]==original_source['events'];assert actual['gates']==original_source['gates'];assert artifact_digest(oldpath)==snapshot['old_config_sha256']
 print(validation)
if __name__=='__main__':
 import sys
 build(correction='--correct-boundary' in sys.argv)
