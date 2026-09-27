"""Resolve exactly four WiSo headings from immutable cached pixels; never open a PDF."""
from pathlib import Path
from copy import deepcopy
import hashlib,json,shutil
import numpy as np
from PIL import Image
from ingest import read,save,lock,now
from layout_validation import content_hash,overlay,report
from layout_profiles.wiso_2017 import WiSo2017Profile,HEADING_PATCHES,PAGES
from layout_profiles.heading_patches import read_heading
from layout_profiles.ap_2017 import LabelOCR
from layout_profiles.base import Region

BASE='docs/evidence/layout_profiles/wiso_2017/2b.1.2-b181e370180b571c'
VERSION='2d.1.0'
def run(root):
 root=Path(root);profile=WiSo2017Profile();manifest_path=root/'data/ingest/layout_validation_manifest.json';own_path=root/'data/ingest/wiso_refinement_manifest.json'
 algo=hashlib.sha256(Path(__file__).read_text().replace('\r\n','\n').encode()).hexdigest()
 key=profile.source_hash+':'+profile.version+':'+profile.config_hash
 folder=root/'docs/evidence/layout_profiles/wiso_2017'/(profile.version+'-'+profile.config_hash)
 with lock(root):
  manifest=read(manifest_path);module=manifest['modules']['wiso_2017']
  baseline=next(s for s in module['versions'].values() if s.get('report')==BASE+'/report.json')
  if baseline['source_hash']!=profile.source_hash:raise ValueError('Unknown source')
  for state in baseline['pages'].values():
   for path,h in state['artifacts'].items():
    if content_hash(root/path)!=h:raise ValueError('Cached source integrity failure')
  own=read(own_path,{'entries':{}});state=own['entries'].setdefault(key+':'+algo,{'status':'validating','source_hash':profile.source_hash,'version':VERSION,'profile_version':profile.version,'config_hash':profile.config_hash,'algorithm_hash':algo,'pages':{}})
  if state['status']=='compatible' and not all((root/p).is_file() and content_hash(root/p)==h for p,h in state['artifacts'].items()):raise ValueError('Completed refinement evidence integrity failure; no rescan')
  if state['status']=='compatible':return {'status':'skipped','processed_pages':0,'pdf_pages_read':0,'questions':24}
  folder.mkdir(parents=True,exist_ok=True);ocr=LabelOCR();processed=0
  for n in range(1,10):
   if str(n) in state['pages']:
    if all(content_hash(root/p)==h for p,h in state['pages'][str(n)]['artifacts'].items()):continue
    raise ValueError('Refinement checkpoint changed; refusing rescan')
   rec=deepcopy(read(root/BASE/f'page-{n:03}.json'));im=Image.open(root/BASE/f'page-{n:03}.png').convert('RGB')
   for (page,expected),bbox in HEADING_PATCHES.items():
    if n!=page:continue
    index=next(i for i,(number,_) in enumerate(PAGES[n]) if number==expected);box=PAGES[n][index][1];aid=f'wiso_2017-p{n}-slot{index}'
    found=read_heading(np.asarray(im),rec['raw'],bbox,ocr)
    evidence_dir=root/'docs/evidence/phase2d/wiso-headings';evidence_dir.mkdir(parents=True,exist_ok=True)
    sx=im.width/rec['raw']['width'];sy=im.height/rec['raw']['height'];crop=im.crop(tuple(round(v*(sx if i%2==0 else sy)) for i,v in enumerate(bbox)));crop.save(evidence_dir/(expected+'.png'))
    save(evidence_dir/(expected+'.json'),{**found,'source_hash':profile.source_hash,'page':n,'cached_page_hash':content_hash(root/BASE/f'page-{n:03}.png'),'crop_hash':content_hash(evidence_dir/(expected+'.png')),'visual_observation':expected,'method':'Actual printed label visually read and independently agreed by three local binary OCR thresholds; no sequence inference.'})
    if found['number']!=expected:continue
    reason='unverified_heading:'+expected
    rec['regions']=[r for r in rec['regions'] if not(r['owner'] is None and r['evidence']==reason)]
    rec['anchors'].append({'anchor_id':aid,'number':found['number'],'bbox':bbox,'evidence':'three_threshold_local_heading_OCR_plus_visual_evidence','confidence':found['confidence'],'review_reasons':[]})
    rec['regions'].append(Region(n,box,'primary',aid,'Explicit printed panel boundary; observed heading '+found['number']).to_dict())
    rec['issues']=[v for v in rec['issues'] if v!=reason]
    rec['layout']['unresolved']=[v for v in rec['layout']['unresolved'] if not isinstance(v,list) or v[1]!=reason]
   rec['review_status']='needs_review' if rec['issues'] else 'auto_ready'
   checkpoint=folder/f'page-{n:03}.json';save(checkpoint,rec);shutil.copy2(root/BASE/f'page-{n:03}.png',folder/f'page-{n:03}.png')
   overlay(im,rec['raw'],rec['anchors'],[Region(**r) for r in rec['regions']],folder/f'overlay-{n:03}.png')
   paths=[checkpoint,folder/f'page-{n:03}.png',folder/f'overlay-{n:03}.png']
   paths += [root/'docs/evidence/phase2d/wiso-headings'/(number+suffix) for (page,number) in HEADING_PATCHES if page==n for suffix in ('.png','.json')]
   state['pages'][str(n)]={'artifacts':{p.relative_to(root).as_posix():content_hash(p) for p in paths},'completed_at':now()};save(own_path,own);processed+=1
  records=[read(folder/f'page-{n:03}.json') for n in range(1,10)];result=report(root,profile,records,folder)
  state.update(status=result['status'],artifacts={p.relative_to(root).as_posix():content_hash(p) for p in folder.iterdir() if p.is_file()})
  for page_state in state['pages'].values():state['artifacts'].update(page_state['artifacts'])
  module['versions'][key]={'status':result['status'],'profile_version':profile.version,'config_hash':profile.config_hash,'source_hash':profile.source_hash,'page_count':9,'pages':state['pages'],'report':(folder/'report.json').relative_to(root).as_posix()};module['active_key']=key
  save(manifest_path,manifest);save(own_path,own)
  return {'status':result['status'],'questions':result['detected_question_count'],'missing':result['missing'],'issues':result['blocking_issues'],'processed_pages':processed,'pdf_pages_read':0,'evidence':str(folder)}
if __name__=='__main__':print(json.dumps(run(Path(__file__).resolve().parents[1]),indent=2))
