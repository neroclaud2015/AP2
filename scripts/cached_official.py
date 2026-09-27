"""Reusable official answer extraction from audited cache-only source configurations."""
from pathlib import Path
import hashlib,inspect,json
import numpy as np
from PIL import Image,ImageDraw
from fa_answers import classify_column,CONFIG as MEASUREMENT_CONFIG
from answers import artifact_digest,artifacts_valid,font
from portrait_dataset import read,save,objhash,scoped_lock
from layout_profiles.portrait_raster import patch_image
from wiso_answers import checkpoint_value
VERSION='2e.1.0'

def detect_mark(gray,centers,policy):
 measured=classify_column(gray,centers);scores=measured['measurements'];decisions=[];reasons=[]
 for threshold in MEASUREMENT_CONFIG['threshold_offsets']:
  rows=[m for m in scores if m['threshold_offset']==threshold]
  if len(rows)!=5 or any(m['center_ink']<policy['center'] for m in rows):reasons.append('five_dot_positions_not_clear')
  strong=[m for m in rows if m['ring_ink']>=policy['min_ring'] and m['angular_support']>=policy['support']]
  possible=[m for m in rows if m['ring_ink']>=policy['possible_ring'] and m['angular_support']>=policy['possible_support']]
  if len(strong)!=1 or len(possible)!=1:reasons.append('no_unique_circle')
  if len(strong)==1:
   if strong[0]['ring_ink']-max((m['ring_ink'] for m in rows if m!=strong[0]),default=0)<policy['margin']:reasons.append('insufficient_margin')
   decisions.append(strong[0]['row'])
 if len(decisions)!=len(MEASUREMENT_CONFIG['threshold_offsets']) or len(set(decisions))!=1:reasons.append('threshold_disagreement')
 ready=not reasons
 return {'official_answer':decisions[0] if ready else None,'official_answer_status':'auto_ready' if ready else 'needs_review','confidence':.98 if ready else 0,'review_reasons':sorted(set(reasons)),'measurements':scores}

def extract_grid(root,config,source,ids,revision):
 page=config['choice_page'];meta=source['pages'][str(page)];full=Image.open(root/meta['image']).convert('RGB');aw,ah=config['analysis_size'];gray=np.asarray(full.convert('L').resize((aw,ah)));overlay=full.copy();draw=ImageDraw.Draw(overlay);records=[]
 w,h=meta['geometry'];sx=full.width/aw;sy=full.height/ah;folder=Path('assets/official')/revision;(root/'public'/folder).mkdir(parents=True,exist_ok=True)
 for start,count,x0,dx,y0,dy,slope,header in config['groups']:
  for column in range(count):
   n=start+column;x=x0+column*dx;y=y0+column*slope;centers=[(x,y+row*dy) for row in range(5)]
   found=detect_mark(gray,centers,config['ring_policy']);box=[x-23,header+column*slope,x+23,centers[-1][1]+13]
   pixels=[round(box[0]*sx),round(box[1]*sy),round(box[2]*sx),round(box[3]*sy)];bbox=[box[0]*w/aw,box[1]*h/ah,box[2]*w/aw,box[3]*h/ah]
   crop=(folder/f'Q{n:02}.png').as_posix();full.crop(tuple(pixels)).save(root/'public'/crop)
   records.append({'question_id':ids[str(n)],'question_number':n,'exam':config['exam'],'module':config['module'],'official_answer_type':'multiple_choice',**found,
    'source_pdf':source['public_pdf'],'source_pdf_available':False,'source_page':page,'solution_source_page':page,'source_crop':crop,'answer_bbox':[round(v,3) for v in bbox],
    'source_crop_bbox_pixels':pixels,'source_image_sha256':meta['artifacts'][meta['image']],'source_pdf_sha256':source['source_hash'],
    'bbox_units':'PDF points, top-left; source cache geometry transformation','analysis_size':config['analysis_size'],'parser_revision':revision,'parser_version':VERSION,
    'question_number_evidence':config['header_evidence'],'locked':False,'user_corrected':False})
   draw.rectangle(pixels,outline='#1675cc',width=2)
   for row,(cx,cy) in enumerate(centers,1):draw.text(((cx+12)*sx,(cy-6)*sy),str(row),font=font(13),fill='#0044aa')
   if found['official_answer']:
    c=next(m['center'] for m in found['measurements'] if m['row']==found['official_answer']);draw.rectangle(((c[0]-12)*sx,(c[1]-12)*sy,(c[0]+12)*sx,(c[1]+12)*sy),outline='#009222',width=3)
 b=config['grid_crop'];overlay=overlay.crop((round(b[0]*sx),round(b[1]*sy),round(b[2]*sx),round(b[3]*sy)));overlaypath=(folder/'grid-overlay.png').as_posix();overlay.save(root/'public'/overlaypath)
 expected=set(range(1,config['choice_count']+1));problems=[{'question_number':r['question_number'],'reason':'no_unique_official_answer'} for r in records if r['official_answer'] is None]
 if {r['question_number'] for r in records}!=expected or len(records)!=len(expected):raise ValueError('Choice column completeness mismatch')
 return {'schema_version':1,'exam':config['exam'],'module':config['module'],'parser_revision':revision,'source_pdf_sha256':source['source_hash'],'overlay':overlaypath,'answers':records,
  'completeness':{'expected':len(expected),'records':len(records),'unique_complete':not problems,'problems':problems},'confidence_note':'Rule-based geometric grade, not probability; no OCR or semantic answer inference.'}

def extract_written(root,config,source,number,ids,revision):
 spec=config['u_regions'][number];panels=[]
 for region in spec['regions']:
  meta=source['pages'][str(region['page'])]
  with Image.open(root/meta['image']) as full:panels.append(patch_image(full,region['bbox'],meta['geometry']))
 im=Image.new('RGB',(max(p.width for p in panels),sum(p.height for p in panels)+20*(len(panels)-1)),'white');y=0
 for p in panels:im.paste(p,(0,y));y+=p.height+20
 path=f'assets/official/{revision}/{number}.png';(root/'public'/path).parent.mkdir(parents=True,exist_ok=True);im.save(root/'public'/path)
 parts=[{'id':str(n),'label':f'{n} · Teilaufgabe {n}','type':'diagram' if n in spec.get('diagram_parts',[]) else 'short_text'} for n in range(1,spec['count']+1)] if spec['count'] else [{'id':'whole','label':'Gesamte Aufgabe · Selbstbewertung','type':'short_text'}]
 first=spec['regions'][0]
 return {'question_id':ids[number],'question_number':number,'exam':config['exam'],'module':config['module'],'solution_source_pdf':source['public_pdf'],'solution_source_pdf_available':False,
  'solution_source_page':first['page'],'solution_bbox':first['bbox'],'regions':[{'source_page':r['page'],'bbox':r['bbox']} for r in spec['regions']],
  'cropped_solution_image':path,'review_status':'auto_ready','answer_type':'multi_part','subparts':parts,'source_hash':source['source_hash'],'extractor_revision':revision,
  'association_evidence':config['u_evidence'],'grading_policy':'Printed subparts only; user self-assessment; no numeric rubric or answer inference.',
  'source_cache_hashes':{str(r['page']):source['pages'][str(r['page'])]['artifacts'][source['pages'][str(r['page'])]['image']] for r in spec['regions']},'bbox_units':'PDF points, top-left'}

def run(root,config_path):
 root=Path(root);config=read(config_path);dataset=read(root/f'data/exams/{config["name"]}_segmented.json')
 if not dataset or dataset['exam']!=config['exam'] or dataset['module']!=config['module']:raise ValueError('Formal dataset not ready')
 segmentation=read(root/f'data/ingest/{config["scope"]}_segmentation_manifest.json',{});accepted=segmentation.get('versions',{}).get(segmentation.get('active_key'),{})
 if accepted.get('status')!='promoted' or not artifacts_valid(root,accepted.get('artifacts')):raise ValueError('Accepted segmentation artifacts changed or incomplete')
 ids={q['question_number']:q['question_id'] for q in dataset['questions']};expected={str(n) for n in range(1,config['choice_count']+1)}|set(config['u_regions'])
 if set(ids)!=expected or len(ids)!=len(dataset['questions']) or len(set(ids.values()))!=len(ids):raise ValueError('Formal question identity mismatch')
 implementation=Path(__file__).read_text().replace('\r\n','\n')+inspect.getsource(classify_column).replace('\r\n','\n')
 config_hash=objhash({'config':config,'implementation':implementation,'measurement_parameters':{k:v for k,v in MEASUREMENT_CONFIG.items() if k not in ['groups','page','geometry','header_evidence']}})
 revision=config['scope']+'-'+VERSION+'-'+config_hash[:12];key=config['source_hash']+':'+revision+':'+objhash({'ids':ids,'dataset':dataset});mp=root/f'data/ingest/{config["scope"]}_official_manifest.json';manifest=read(mp,{'entries':{}});previous=manifest['entries'].get(key,{})
 if previous.get('status')=='complete' and artifacts_valid(root,previous.get('artifacts')):return {'status':'skipped','pdf_pages_opened':0,'choice_pages_processed':0,'u_processed':0,'revision':revision}
 source=read(root/'data/ingest/winter_solution_cache.json')
 if not source or source['source_hash']!=config['source_hash']:raise ValueError('Official source hash mismatch')
 source['public_pdf']=f"assets/pdfs/{source['doc_id']}.pdf"
 for n,h in config['page_image_hashes'].items():
  meta=source['pages'][n]
  if meta['artifacts'][meta['image']]!=h or not all((root/p).is_file() and hashlib.sha256((root/p).read_bytes()).hexdigest()==wanted for p,wanted in meta['artifacts'].items()):raise ValueError('Official cache changed; no rescan')
 with scoped_lock(root,config['scope']+'-answers'):
  checkpoints=root/f'data/ingest/{config["scope"]}-official/{revision}'
  choices,processed=checkpoint_value(root,checkpoints/'choice.json',key,lambda:extract_grid(root,config,source,ids,revision),lambda d:['public/'+r['source_crop'] for r in d['answers']]+['public/'+d['overlay']])
  written=[];u_processed=0
  for number in config['u_regions']:
   record,changed=checkpoint_value(root,checkpoints/f'{number}.json',key,lambda n=number:extract_written(root,config,source,n,ids,revision),lambda r:['public/'+r['cropped_solution_image']]);written.append(record);u_processed+=int(changed)
  u_data={'schema_version':1,'exam':config['exam'],'module':config['module'],'extractor_revision':revision,'solutions':written};paths=[]
  for suffix,data in [('answers',choices),('u_solutions',u_data)]:
   for prefix in ['data/exams','public/data']:
    p=root/f'{prefix}/{config["name"]}_{suffix}.json';save(p,data);paths.append(p)
  paths.extend(root/'public'/r['source_crop'] for r in choices['answers']);paths.extend(root/'public'/r['cropped_solution_image'] for r in written);paths.append(root/'public'/choices['overlay'])
  manifest['entries'][key]={'status':'complete','source_hash':config['source_hash'],'config_hash':config_hash,'identity_hash':objhash(ids),'artifacts':{p.relative_to(root).as_posix():artifact_digest(p) for p in paths}};save(mp,manifest)
  return {'status':'processed','choice_pages_processed':int(processed),'u_processed':u_processed,'pdf_pages_opened':0,'revision':revision,'auto_ready':sum(r['official_answer'] is not None for r in choices['answers']),'needs_review':[r['question_number'] for r in choices['answers'] if r['official_answer'] is None]}
