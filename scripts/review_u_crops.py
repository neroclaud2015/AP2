"""Append-only, pre-production review of small vertical U-solution crop boundaries.
Never changes raw extraction, source gates, MC answers, question identities or PDFs.
"""
from copy import deepcopy
from pathlib import Path
from ingest import read,save
from answers import artifact_digest,artifacts_valid
from portrait_dataset import objhash

MAX_DELTA=25.0

def validate_adjustments(original,changes,pages):
 rows={u['question_number']:u for u in original['solutions']}
 if not changes or not set(changes)<=set(rows):raise ValueError('Known U questions required')
 regions=[]
 for number,u in rows.items():
  before=u['regions'];after=changes.get(number,before)
  if len(before)!=len(after):raise ValueError('Region count cannot change')
  for old,new in zip(before,after):
   if set(new)!={'source_page','bbox'} or old['source_page']!=new['source_page']:raise ValueError('Source page cannot change')
   a,b=old['bbox'],new['bbox'];geo=pages[str(new['source_page'])]['geometry']
   if len(b)!=4 or any(type(x) not in (int,float) for x in b) or not (0<=b[0]<b[2]<=geo[0] and 0<=b[1]<b[3]<=geo[1]):raise ValueError('Crop outside page')
   if a[0]!=b[0] or a[2]!=b[2] or max(abs(x-y) for x,y in zip(a,b))>MAX_DELTA:raise ValueError('Only small vertical boundary corrections allowed')
   regions.append((number,new))
 for i,(name,a) in enumerate(regions):
  for other,b in regions[i+1:]:
   if name==other or a['source_page']!=b['source_page']:continue
   x,y=a['bbox'],b['bbox']
   if min(x[2],y[2])>max(x[0],y[0]) and min(x[3],y[3])>max(x[1],y[1]):raise ValueError('U solution ownership overlaps')

def verify_cache(root,original,changes,cache):
 for u in original['solutions']:
  if u['question_number'] not in changes:continue
  for region in u['regions']:
   key=str(region['source_page']);page=cache['pages'][key]
   if page['artifacts'].get(page['image'])!=u['source_cache_hashes'].get(key) or not artifacts_valid(root,page['artifacts']):raise ValueError('Original solution cache evidence changed')

def prepare(root,layout_path,official_path,changes,reason):
 from promote_registered_modules import validated_bundle
 from registered_ingest import cache_metadata
 from cached_official import extract_written
 root=Path(root);c,q,a,u=validated_bundle(root,layout_path)
 from source_registry import load_registry
 registry=load_registry(root)
 if any(s['status']=='production' for s in registry['sources'] if s['source_id'] in (c['source_id'],c['solution_source_id'])):raise ValueError('Published modules cannot use pre-production crop review')
 official=read(official_path);cache=cache_metadata(root,a['source_pdf_sha256'])
 if official['source_hash']!=a['source_pdf_sha256'] or official['scope']!=c['scope'] or not reason.strip():raise ValueError('Review source/basis mismatch')
 validate_adjustments(u,changes,cache['pages'])
 verify_cache(root,u,changes,cache)
 base_path=f'public/data/{c["name"]}_u_solutions.json'
 revision='u-crop-review-'+objhash({'base':artifact_digest(root/base_path),'changes':changes,'reason':reason})[:16]
 target=root/f'data/reviews/{c["scope"]}-u-crop-review.json'
 if target.exists():
  previous=read(target)
  if previous.get('revision')!=revision or previous.get('changes')!=changes:raise ValueError('Review manifest immutable')
  load_review(root,c,u,target)
  return target
 reviewed=deepcopy(u);reviewed.update(extractor_revision=revision,previous_extractor_revision=u['extractor_revision'])
 ids={v['question_number']:v['question_id'] for v in q['questions']}
 for i,row in enumerate(u['solutions']):
  number=row['question_number']
  if number not in changes:continue
  spec=deepcopy(official);spec['u_regions'][number]['regions']=[{'page':v['source_page'],'bbox':v['bbox']} for v in changes[number]]
  new=extract_written(root,spec,cache,number,ids,revision)
  # The review may alter geometry and extraction provenance only.
  allowed={'solution_bbox','regions','cropped_solution_image','extractor_revision'}
  if any(new.get(k)!=v for k,v in row.items() if k not in allowed):raise ValueError('U semantics changed')
  reviewed['solutions'][i]=new
 path=f'public/data/{c["name"]}_reviewed_u_solutions.json';save(root/path,reviewed);save(root/f'data/exams/{c["name"]}_reviewed_u_solutions.json',reviewed)
 evidence={'schema_version':1,'scope':c['scope'],'source_hash':a['source_pdf_sha256'],'previous_revision':u['extractor_revision'],'revision':revision,'review_method':'visual_source_boundary_review','reviewed_by':'assistant','reason':reason,'changes':changes,'base_path':base_path,'reviewed_path':path,'artifacts':{}}
 paths=[root/base_path,Path(official_path),root/path]+[root/'public'/v['cropped_solution_image'] for v in reviewed['solutions']]
 evidence['artifacts']={p.relative_to(root).as_posix():artifact_digest(p) for p in paths}
 target=root/f'data/reviews/{c["scope"]}-u-crop-review.json'
 if target.exists() and read(target)!=evidence:raise ValueError('Review manifest immutable')
 save(target,evidence);return target

def load_review(root,c,original,path):
 from registered_ingest import cache_metadata
 root=Path(root);e=read(path)
 if not e or e['scope']!=c['scope'] or e['previous_revision']!=original['extractor_revision'] or e['base_path']!=f'public/data/{c["name"]}_u_solutions.json' or e['reviewed_path']!=f'public/data/{c["name"]}_reviewed_u_solutions.json' or not artifacts_valid(root,e['artifacts']):raise ValueError('Stale crop review')
 if e['source_hash']!=original['solutions'][0]['source_hash']:raise ValueError('Review source mismatch')
 cache=cache_metadata(root,e['source_hash'])
 validate_adjustments(original,e['changes'],cache['pages'])
 verify_cache(root,original,e['changes'],cache)
 reviewed=read(root/e['reviewed_path'])
 required={e['base_path'],e['reviewed_path']}|{'public/'+v['cropped_solution_image'] for v in reviewed['solutions']}
 if not required<=set(e['artifacts']):raise ValueError('Review artifact bindings incomplete')
 if reviewed.get('extractor_revision')!=e['revision'] or reviewed.get('previous_extractor_revision')!=original['extractor_revision'] or any(reviewed.get(k)!=v for k,v in original.items() if k not in ('solutions','extractor_revision')):raise ValueError('Reviewed dataset provenance changed')
 if len(reviewed['solutions'])!=len(original['solutions']):raise ValueError('Review coverage changed')
 for old,new in zip(original['solutions'],reviewed['solutions']):
  changed=old['question_number'] in e['changes'];allowed={'solution_bbox','regions','cropped_solution_image','extractor_revision'} if changed else set()
  if set(old)!=set(new) or any(new[k]!=v for k,v in old.items() if k not in allowed):raise ValueError('Review changed solution identity or semantics')
  if changed and (new['regions']!=e['changes'][old['question_number']] or new['solution_bbox']!=new['regions'][0]['bbox'] or new['extractor_revision']!=e['revision']):raise ValueError('Review differs from approved boundary changes')
 return reviewed,e['reviewed_path'],[root/path]+[root/p for p in e['artifacts']]
