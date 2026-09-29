"""Publish explicitly mapped supplementary sources from verified page caches only."""
from pathlib import Path
from PIL import Image
from ingest import read,save,digest
from answers import artifacts_valid,artifact_digest
from registered_ingest import cache_metadata
from layout_profiles.portrait_raster import patch_image

def publish_external_attachments(root,config,paths):
 root=Path(root);result=[]
 for item in config.get('external_attachments',[]):
  source=cache_metadata(root,item['sha256'])
  if source['member']!=item['filename']:raise ValueError('Supplement filename/hash mismatch')
  page=source['pages'][str(item['source_page'])]
  if not artifacts_valid(root,page['artifacts']):raise ValueError('Supplement cache changed')
  numbers=item['question_numbers']
  if not numbers or not set(numbers)<=set(config['expected']):raise ValueError('Unknown supplementary question owner')
  if item.get('rotation_degrees',0) not in (0,90,180,270):raise ValueError('Unsupported supplement rotation')
  target=Path('assets/supplements')/item['sha256']/f"{item['id']}.png";dest=root/'public'/target;dest.parent.mkdir(parents=True,exist_ok=True)
  with Image.open(root/page['image']) as full:image=patch_image(full,item['bbox'],page['geometry']).rotate(item.get('rotation_degrees',0),expand=True)
  import io
  payload=io.BytesIO();image.save(payload,format='PNG');data=payload.getvalue()
  if dest.exists() and dest.read_bytes()!=data:raise ValueError('Published supplement changed')
  if not dest.exists():dest.write_bytes(data)
  result.append({**item,'image':target.as_posix(),'image_sha256':artifact_digest(dest),'source_id':'supplement-'+item['sha256'][:24],'role':'shared_attachment','exam':config['exam'],'module':config['module']});paths.append(dest)
 return result
