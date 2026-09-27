"""WiSo 2017 official answers from immutable 120-DPI page caches only.

No PDF is opened or rendered. The reviewed layout contains no choice answer values.
The shared pure circle detector is reused; existing AP/FA pipelines are unchanged.
"""
import argparse
import hashlib
import inspect
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from fa_answers import classify_column, CONFIG as DETECTOR_CONFIG
from answers import artifact_digest, artifacts_valid, font
from ingest import digest, lock, read, save

VERSION='2d.1.0'
DOC='ea47a013956459b9cf4c907b'
SOURCE_HASH='1bca5421b9553e59df7103d82bfa3bbb45243009b2e09bcd9c4f3904fe1d9bd4'
MODULE='WiSo'
CACHE={
 3:{'sha256':'048225cbff1912052be6532dcb7b4fd59f884993d93ec73f1c813c47cc94826d','size':[992,1404],'points':[595.0,842.0]},
 10:{'sha256':'523e2dd3621f46da87c2a30592d85bd66527a2a2d8eefe19028f94dae0cd4dd7','size':[992,1403],'points':[595.2000122070312,841.4400024414062]},
 11:{'sha256':'7a702b249b41e565ed19185f71fcb64e29b4a1d0618226c13ac91df887453137','size':[992,1403],'points':[595.2000122070312,841.4400024414062]},
}
GROUPS=[(1,10,112,58.6,429,19.3,-.45,397),(11,8,112.5,58.9,544,19.4,-.45,515)]
REGIONS={'U1':(10,[52,385,952,848]),'U2':(10,[52,851,952,950]),
 'U3':(11,[29,40,930,621]),'U4':(11,[29,624,930,897]),
 'U5':(11,[29,900,930,1052]),'U6':(11,[29,1055,930,1270])}
COUNTS={'U4':3,'U5':3,'U6':4}
HEADER_EVIDENCE='WiSo module heading and printed Q1-10/Q11-18 column labels visually verified on physical solution page3; source/cache-hash-bound coordinate template contains no answers.'
ASSOCIATION_EVIDENCE='Physical page10 has WiSo title and printed U1/U2; page11 is its printed reverse (-2-(2)) with U3/U4/U5/U6 headings. All crop ownership and boundaries visually checked; physical page9 is AP and excluded.'
CONFIG={'cache':CACHE,'groups':GROUPS,'regions_pixels':REGIONS,'explicit_subpart_counts':COUNTS,
 'reference_dpi':120,'row_mapping':[1,2,3,4,5],'header_evidence':HEADER_EVIDENCE,
 'association_evidence':ASSOCIATION_EVIDENCE,'detector_source_sha256':hashlib.sha256(inspect.getsource(classify_column).replace('\r\n','\n').encode()).hexdigest(),
 'detector_parameters':{k:v for k,v in DETECTOR_CONFIG.items() if k not in ['page','geometry','groups','header_evidence']},
 'detector':'fa_answers.classify_column: pure pixel geometry; no other module run'}
def object_hash(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
CONFIG_HASH=object_hash(CONFIG)
REVISION='wiso-'+VERSION+'-'+CONFIG_HASH[:12]

def cache_path(root,page):return root/f'public/assets/pages/{DOC}/{page:03}.png'

def verify_cache(root):
 for page,expected in CACHE.items():
  path=cache_path(root,page)
  if digest(path)!=expected['sha256']:raise ValueError(f'Unverified cached solution pixels page {page}; no answers guessed')
  metadata=read(root/f'data/ingest/pages/{DOC}/{page:03}.json')
  if not metadata or metadata.get('document_id')!=DOC or metadata.get('source_page')!=page or [metadata.get('width'),metadata.get('height')]!=expected['points']:
   raise ValueError(f'Unverified cached page geometry {page}')
 # No PDF read: source hash is provenance bound by the reviewed exact PNG hashes.
 return object_hash(CACHE)

def validate_identity(source):
 expected={str(i) for i in range(1,19)}|{f'U{i}' for i in range(1,7)}
 if not source or source.get('exam')!='2017_sommer' or source.get('module')!=MODULE:raise ValueError('Wrong WiSo scope')
 questions=source.get('questions',[])
 if len(questions)!=24 or {q.get('question_number') for q in questions}!=expected:raise ValueError('WiSo coverage must be exactly Q1-18/U1-6')
 ids=[q.get('question_id') for q in questions]
 if len(set(ids))!=24 or any(not isinstance(i,str) or not i.startswith('wiso') for i in ids):raise ValueError('Invalid or duplicate WiSo identities')
 return object_hash(sorted((q['question_number'],q['question_id']) for q in questions))

def subparts(number):
 if number in COUNTS:return [{'id':str(i),'label':f'{i} · Teilaufgabe {i}','type':'short_text'} for i in range(1,COUNTS[number]+1)]
 return [{'id':'whole','label':'Gesamte Aufgabe · Selbstbewertung','type':'diagram' if number=='U3' else 'short_text'}]

def points(box):return [round(v*72/120,3) for v in box]

def provenance(page):
 return {'source_pdf_sha256':SOURCE_HASH,'source_cache_image':f'assets/pages/{DOC}/{page:03}.png',
  'source_cache_sha256':CACHE[page]['sha256'],'source_cache_size':CACHE[page]['size'],
  'source_page_points':CACHE[page]['points'],'source_cache_dpi':120,
  'bbox_units':'PDF points; top-left origin; cached 120-DPI pixels multiplied by 72/120',
  'extraction_method':'immutable_cached_pixels_only; PDF not opened or rendered'}

def extract_choices(root,by_number):
 with Image.open(cache_path(root,3)) as source:
  if list(source.size)!=CACHE[3]['size']:raise ValueError('Unexpected cache dimensions')
  full=source.convert('RGB')
 gray=np.asarray(full.convert('L'));overlay=full.copy();draw=ImageDraw.Draw(overlay);records=[]
 folder=Path('assets/wiso-answers')/REVISION;(root/'public'/folder).mkdir(parents=True,exist_ok=True)
 for start,count,x0,dx,y0,dy,slope,header in GROUPS:
  for col in range(count):
   number=start+col;x=x0+col*dx;y=y0+col*slope;centers=[(x,y+i*dy) for i in range(5)]
   found=classify_column(gray,centers);box=[round(x-24),round(header+col*slope),round(x+24),round(centers[-1][1]+14)]
   crop=(folder/f'Q{number:02}.png').as_posix();full.crop(tuple(box)).save(root/'public'/crop)
   selected=[m for m in found['measurements'][:5] if m['row']==found['official_answer']]
   circle=selected[0]['center'] if selected else None
   ring=[circle[0]-12,circle[1]-12,circle[0]+12,circle[1]+12] if circle else None
   records.append({'question_id':by_number[str(number)],'question_number':number,'exam':'2017_sommer','module':MODULE,
    'official_answer_type':'multiple_choice',**found,'official_answer_status':found['status'],
    'solution_source_page':3,'source_page':3,'source_pdf':f'assets/pdfs/{DOC}.pdf',
    'source_crop':crop,'answer_bbox':points(box),'source_crop_bbox_pixels':box,'circle_bbox':points(ring) if ring else None,
    'parser_version':VERSION,'parser_revision':REVISION,'question_number_evidence':HEADER_EVIDENCE,
    'confidence_note':'Deterministic geometry rule grade, not calibrated probability.',
    'user_corrected':False,'locked':False,**provenance(3)})
   draw.rectangle(box,outline='#1465cc',width=1)
   for row,(cx,cy) in enumerate(centers,1):
    draw.ellipse((cx-3,cy-3,cx+3,cy+3),outline='#1465cc',width=1)
    draw.text((cx+13,cy-5),str(row),fill='#004499',font=font(8))
   if ring:draw.rectangle(ring,outline='#009222',width=2)
 grid=overlay.crop((78,390,666,640)).resize((1176,500))
 canvas=Image.new('RGB',(1220,790),'white');canvas.paste(grid,(20,55));d=ImageDraw.Draw(canvas)
 d.text((20,12),'WiSo / official page 3 / blue rows 1-5 / green detected circle',font=font(22),fill='black')
 for i,r in enumerate(records):
  d.text((20+(i%6)*200,580+(i//6)*48),f"Q{r['question_number']}: {r['official_answer'] or 'REVIEW'}",font=font(23),fill='#006b22' if r['official_answer'] else '#b00000')
 overlay_path=(folder/'answer-grid-overlay.png').as_posix();canvas.save(root/'public'/overlay_path)
 problems=[{'question_number':r['question_number'],'reason':'no_unique_official_answer'} for r in records if r['official_answer'] is None]
 return {'schema_version':1,'exam':'2017_sommer','module':MODULE,'part':'A','parser_version':VERSION,
  'parser_revision':REVISION,'layout_config_hash':CONFIG_HASH,'source_pdf_sha256':SOURCE_HASH,
  'solution_source_page':3,'header_evidence':HEADER_EVIDENCE,'overlay':overlay_path,'answers':records,
  'completeness':{'expected':18,'records':len(records),'unique_complete':len(records)==18 and not problems,'problems':problems}}

def extract_u(root,number,question_id):
 page,box=REGIONS[number]
 with Image.open(cache_path(root,page)) as source:
  if list(source.size)!=CACHE[page]['size']:raise ValueError('Unexpected U cache dimensions')
  crop_image=source.crop(tuple(box))
 folder=Path('assets/wiso-u-solutions')/REVISION;(root/'public'/folder).mkdir(parents=True,exist_ok=True)
 crop=(folder/f'{number}.png').as_posix();crop_image.save(root/'public'/crop)
 return {'question_id':question_id,'question_number':number,'exam':'2017_sommer','module':MODULE,
  'solution_source_pdf':f'assets/pdfs/{DOC}.pdf','solution_source_page':page,'solution_bbox':points(box),
  'regions':[{'source_page':page,'bbox':points(box),'bbox_pixels':box}],
  'cropped_solution_image':crop,'review_status':'auto_ready','answer_type':'multi_part','subparts':subparts(number),
  'source_hash':SOURCE_HASH,'extractor_revision':REVISION,'association_evidence':ASSOCIATION_EVIDENCE,
  'subpart_evidence':'Only printed 1-3 in U4/U5 and 1-4 in U6 are separate subparts; U1 table/U2 list/U3 diagram assessed as whole tasks.',
  'grading_policy':'User self-assessment only; no semantic answer inference, numeric tolerance or point rubric.',
  'confidence':.98,'confidence_note':'Visually verified source ownership, not a calibrated probability.',**provenance(page)}

def checkpoint_value(root,path,key,build,paths):
 cached=read(path)
 if cached and cached.get('key')==key:
  if object_hash(cached.get('value'))!=cached.get('value_hash'):raise ValueError('Answer checkpoint metadata integrity failure')
  if artifacts_valid(root,cached.get('artifacts')):return cached['value'],False
 value=build();artifacts={p:artifact_digest(root/p) for p in paths(value)}
 save(path,{'key':key,'value':value,'value_hash':object_hash(value),'artifacts':artifacts})
 return value,True

def run(root,stop_after_checkpoint=False):
 root=Path(root);cache_hash=verify_cache(root);source=read(root/'data/exams/2017_sommer_wiso_segmented.json')
 identity_hash=validate_identity(source);by_number={q['question_number']:q['question_id'] for q in source['questions']}
 key=':'.join([SOURCE_HASH,VERSION,CONFIG_HASH,cache_hash,identity_hash]);manifest_path=root/'data/ingest/wiso_answer_manifest.json'
 with lock(root):
  manifest=read(manifest_path,{'schema_version':1,'entries':{}});entry=manifest['entries'].get(key,{})
  if entry.get('status')=='complete' and artifacts_valid(root,entry.get('artifacts')):
   return {'status':'skipped','pages_processed':0,'questions_processed':0,'pdf_pages_rendered':0,'key':key}
  folder=root/f'data/ingest/wiso-answers/{REVISION}'
  choices,processed=checkpoint_value(root,folder/'page-003.json',key,lambda:extract_choices(root,by_number),
   lambda result:['public/'+r['source_crop'] for r in result['answers']]+['public/'+result['overlay']])
  solutions=[];u_processed=0
  for number in REGIONS:
   result,changed=checkpoint_value(root,folder/f'{number}.json',key,lambda n=number:extract_u(root,n,by_number[n]),lambda r:['public/'+r['cropped_solution_image']])
   solutions.append(result);u_processed+=int(changed)
  if stop_after_checkpoint:return {'status':'interrupted_after_checkpoint','choice_pages_processed':int(processed),'u_questions_processed':u_processed,'pdf_pages_rendered':0}
  u_data={'schema_version':1,'exam':'2017_sommer','module':MODULE,'extractor_revision':REVISION,'source_pdf_sha256':SOURCE_HASH,'solutions':solutions}
  outputs=[]
  for suffix,value in [('answers',choices),('u_solutions',u_data)]:
   for prefix in ['data/exams','public/data']:
    path=f'{prefix}/2017_sommer_wiso_{suffix}.json';save(root/path,value);outputs.append(path)
  paths=outputs+['public/'+r['source_crop'] for r in choices['answers']]+['public/'+choices['overlay']]+['public/'+r['cropped_solution_image'] for r in solutions]
  manifest['entries'][key]={'status':'complete','source_hash':SOURCE_HASH,'cache_hash':cache_hash,'version':VERSION,
   'config_hash':CONFIG_HASH,'identity_hash':identity_hash,'scope':'Sommer2017 WiSo only','pdf_pages_rendered':0,
   'artifacts':{p:artifact_digest(root/p) for p in paths},'answers':18,'u_solutions':6}
  save(manifest_path,manifest)
  return {'status':'processed' if processed or u_processed else 'resumed','choice_pages_processed':int(processed),'u_questions_processed':u_processed,
   'answers':18,'auto_ready':sum(r['official_answer_status']=='auto_ready' for r in choices['answers']),
   'needs_review':[r['question_number'] for r in choices['answers'] if r['official_answer'] is None],
   'u_solutions':6,'pdf_pages_rendered':0,'source_pages':[3,10,11],'key':key}

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);parser.add_argument('--stop-after-checkpoint',action='store_true');args=parser.parse_args()
 print(json.dumps(run(args.root,args.stop_after_checkpoint),indent=2))




