"""FA official page1 grid. Only pixel geometry determines answers; no question/OCR inference."""
import hashlib
import json
from pathlib import Path
import cv2
import numpy as np
import pymupdf
from PIL import Image,ImageDraw
from answers import DOC, artifact_digest, artifacts_valid, completeness, font
from ingest import read,save,lock,digest
from fa_dataset import validated_dataset

VERSION='2b.2.2'
SOURCE_HASH='1bca5421b9553e59df7103d82bfa3bbb45243009b2e09bcd9c4f3904fe1d9bd4'
CONFIG={'page':1,'geometry':[595,842],'reference_dpi':120,
 'groups':[(1,10,137.5,57.6,423.5,19,-.15,392),(11,10,138,57.6,537.2,19,-.24,506),(21,8,138.5,57.6,649.2,19,-.20,620)],
 'threshold_offsets':[3,5],'ring_radius':[8,12],'min_ring_ink':.48,'min_angular_support':.75,
 'possible_ring_ink':.40,'possible_support':.58,'minimum_margin':.15,'max_dot_snap':3,
 'header_evidence':'Physical page1 Funktionsanalyse title and columns 1-10,11-20,21-28 visually verified against exact source hash; no answers in template.'}
CONFIG_HASH=hashlib.sha256(json.dumps(CONFIG,sort_keys=True).encode()).hexdigest()
REVISION=VERSION+'-'+CONFIG_HASH[:12]

def classify_column(gray,centers,number_verified=True):
 if len(centers)!=5 or any(centers[i+1][1]<=centers[i][1] for i in range(4)):
  return {'official_answer':None,'status':'needs_review','confidence':0,'review_reasons':['invalid_five_positions'],'measurements':[]}
 measured=[];decisions=[];reasons=[]
 for threshold in CONFIG['threshold_offsets']:
  bw=cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,threshold)>0
  scores=[]
  for row,(x0,y0) in enumerate(centers,1):
   if x0<17 or y0<17 or x0>gray.shape[1]-17 or y0>gray.shape[0]-17:
    reasons.append('position_outside_page');continue
   best=None
   for oy in range(-3,4):
    for ox in range(-3,4):
     xx,yy=np.meshgrid(np.arange(round(x0+ox)-2,round(x0+ox)+3),np.arange(round(y0+oy)-2,round(y0+oy)+3))
     metric=float(gray[yy,xx].mean())
     if best is None or metric<best[0]:best=(metric,x0+ox,y0+oy)
   _,x,y=best
   xx,yy=np.meshgrid(np.arange(round(x)-13,round(x)+14),np.arange(round(y)-13,round(y)+14))
   radius=np.hypot(xx-x,yy-y);annulus=(radius>=8)&(radius<=12);ink=bw[yy,xx]
   sectors=((np.arctan2(yy-y,xx-x)+np.pi)/(2*np.pi)*12).astype(int)%12
   support=float(sum(float(ink[annulus&(sectors==s)].mean())>.18 for s in range(12))/12)
   scores.append({'row':row,'center':[round(x,3),round(y,3)],'ring_ink':round(float(ink[annulus].mean()),4),
    'angular_support':round(support,4),'center_ink':round(float(ink[radius<=3].mean()),4),'threshold_offset':threshold})
  strong=[m for m in scores if m['ring_ink']>=.48 and m['angular_support']>=.75]
  possible=[m for m in scores if m['ring_ink']>=.40 and m['angular_support']>=.58]
  if len(scores)!=5 or any(m['center_ink']<.1 for m in scores):reasons.append('five_dots_not_clear')
  if len(strong)!=1 or len(possible)!=1:reasons.append('no_unique_circle')
  if len(strong)==1:
   if strong[0]['ring_ink']-max(m['ring_ink'] for m in scores if m!=strong[0])<.15:reasons.append('insufficient_margin')
   decisions.append(strong[0]['row'])
  measured.extend(scores)
 if not number_verified:reasons.append('unverified_column_number')
 if len(decisions)!=2 or len(set(decisions))!=1:reasons.append('threshold_disagreement')
 ready=not reasons
 return {'official_answer':decisions[0] if ready else None,'status':'auto_ready' if ready else 'needs_review',
  'confidence':.98 if ready else 0,'review_reasons':sorted(set(reasons)),'measurements':measured}

def run(root):
 root=Path(root);pdf=root/f'public/assets/pdfs/{DOC}.pdf'
 if digest(pdf)!=SOURCE_HASH:raise ValueError('Unsupported FA solution source hash')
 source,identity_hash=validated_dataset(root)
 key=SOURCE_HASH+':'+VERSION+':'+CONFIG_HASH+':'+identity_hash
 manifest_path=root/'data/ingest/fa_answer_manifest.json'
 with lock(root):
  manifest=read(manifest_path,{'entries':{}});previous=manifest['entries'].get(key,{})
  if previous.get('status')=='complete' and artifacts_valid(root,previous.get('artifacts')):
   return {'status':'skipped','pages_processed':0}
  by_number={int(q['question_number']):q['question_id'] for q in source['questions'] if q['question_number'].isdigit()}
  if sorted(by_number)!=list(range(1,29)):raise ValueError('FA identity coverage mismatch')
  folder=Path('assets/answers')/DOC/('fa-'+REVISION);(root/'public'/folder).mkdir(parents=True,exist_ok=True)
  with pymupdf.open(pdf) as doc:
   page=doc[0]
   if [page.rect.width,page.rect.height]!=CONFIG['geometry']:raise ValueError('Unsupported FA answer geometry')
   pix=page.get_pixmap(dpi=120,colorspace=pymupdf.csGRAY);gray=np.frombuffer(pix.samples,np.uint8).reshape(pix.height,pix.width)
   pix=page.get_pixmap(dpi=300,colorspace=pymupdf.csRGB);full=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
  overlay=full.copy();draw=ImageDraw.Draw(overlay);records=[]
  for start,count,x0,dx,y0,dy,slope,header in CONFIG['groups']:
   for col in range(count):
    number=start+col;x=x0+dx*col;y=y0+slope*col;centers=[(x,y+dy*r) for r in range(5)]
    found=classify_column(gray,centers)
    box=[x-24,header,x+24,centers[-1][1]+14];crop=(folder/f'Q{number:02}.png').as_posix()
    full.crop(tuple(round(v*2.5) for v in box)).save(root/'public'/crop)
    measurements=found['measurements'][:5];chosen=found['official_answer']
    circle=next((m['center'] for m in measurements if m['row']==chosen),None)
    ring=[circle[0]-12,circle[1]-12,circle[0]+12,circle[1]+12] if circle else None
    records.append({'question_id':by_number[number],'exam':'2017_sommer','module':'Funktionsanalyse','question_number':number,
      'official_answer_type':'multiple_choice',**found,'official_answer_status':found['status'],
      'solution_source_page':1,'source_page':1,'source_pdf':f'assets/pdfs/{DOC}.pdf','source_crop':crop,
      'answer_bbox':[round(v*.6,3) for v in box],'circle_bbox':[round(v*.6,3) for v in ring] if ring else None,
      'bbox_units':'PDF points; origin top-left','source_pdf_sha256':SOURCE_HASH,'parser_version':VERSION,'parser_revision':'fa-'+REVISION,
      'question_number_evidence':CONFIG['header_evidence'],'user_corrected':False,'locked':False})
    draw.rectangle(tuple(round(v*2.5) for v in box),outline='blue',width=2)
    for m in measurements:
     cx,cy=m['center'];draw.ellipse((cx*2.5-6,cy*2.5-6,cx*2.5+6,cy*2.5+6),outline='blue',width=2)
     draw.text((cx*2.5+30,cy*2.5-10),str(m['row']),font=font(17),fill='blue')
    if ring:draw.rectangle(tuple(round(v*2.5) for v in ring),outline='#00c040',width=4)
  grid=overlay.crop((100*2.5,380*2.5,700*2.5,747*2.5))
  canvas=Image.new('RGB',(1900,grid.height+440),'white');canvas.paste(grid,(10,55));d=ImageDraw.Draw(canvas)
  d.text((20,10),'Funktionsanalyse / solution PDF page1 / blue rows1-5 / green circle',font=font(26),fill='black')
  for i,r in enumerate(records):d.text((20+i%4*460,grid.height+80+i//4*43),f"Q{r['question_number']}: row {r['official_answer']} -> answer {r['official_answer']}",font=font(23),fill='black')
  overlay_path=(folder/'answer-grid-overlay.png').as_posix();canvas.save(root/'public'/overlay_path)
  result={'schema_version':1,'exam':'2017_sommer','module':'Funktionsanalyse','part':'A','answers':records,'overlay':overlay_path,
   'parser_version':VERSION,'parser_revision':'fa-'+REVISION,'layout_config_hash':CONFIG_HASH,'source_pdf_sha256':SOURCE_HASH,'solution_source_page':1,
   'header_evidence':CONFIG['header_evidence'],'confidence_note':'Deterministic geometric rule grade, not a calibrated probability.'}
  result['completeness']=completeness(records,root)
  outputs=['data/exams/2017_sommer_funktionsanalyse_answers.json','public/data/2017_sommer_funktionsanalyse_answers.json']
  for p in outputs:save(root/p,result)
  artifacts=outputs+['public/'+r['source_crop'] for r in records]+['public/'+overlay_path]
  manifest['entries'][key]={'status':'complete','source_hash':SOURCE_HASH,'version':VERSION,'config_hash':CONFIG_HASH,'identity_hash':identity_hash,'page':1,
   'artifacts':{p:artifact_digest(root/p) for p in artifacts}}
  save(manifest_path,manifest)
  return {'status':'processed','pages_processed':1,'auto_ready':sum(r['status']=='auto_ready' for r in records),
    'needs_review':[r['question_number'] for r in records if r['status']=='needs_review']}

if __name__=='__main__':print(json.dumps(run(Path(__file__).resolve().parents[1]),indent=2))
