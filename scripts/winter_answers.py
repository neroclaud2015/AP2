"""Winter AP official answers: fixed source geometry, per-question checkpoints, no PDF reader."""
from pathlib import Path
import hashlib,json,math
import numpy as np
from PIL import Image,ImageDraw
from ingest import read,save
from winter_ap_dataset import validated_dataset,NAME,SOLUTION_MEMBER,digest,artifacts_valid
VERSION='winter-ap-2e.1.0'
SOURCE='ff4767053ef41cb3b49cb4f5e074c289a398750d8ffaf30f6dd71087b0ee7f8c'
U_REGIONS=[(3,[50,139,553,380],3),(3,[50,380,553,595],3),(3,[50,595,553,791],3),(4,[38,38,542,182],5),(4,[38,182,542,791],1),(5,[53,138,556,313],5),(5,[53,313,556,600],3),(5,[53,600,556,702],3)]

def detect_column(gray,scale,x,y):
 """Require one circular outline under two thresholds, five visible central dots."""
 decisions=[];measurements=[];reasons=[]
 for threshold in (190,215):
  rows=[]
  for row in range(5):
   cy=y+11.48*row;radius=8*scale;cx=x*scale;py=cy*scale
   x0=int(cx-radius);y0=int(py-radius);x1=int(cx+radius)+1;y1=int(py+radius)+1
   if min(x0,y0)<0 or x1>gray.shape[1] or y1>gray.shape[0]:raise ValueError('Marker outside source')
   yy,xx=np.mgrid[y0:y1,x0:x1];dx=(xx-cx)/scale;dy=(yy-py)/scale;r=np.hypot(dx,dy);ink=gray[y0:y1,x0:x1]<threshold
   ring=(r>=4.8)&(r<=6.5);angle=(np.arctan2(dy,dx)+math.pi)/(2*math.pi)
   density=float(ink[ring].mean());support=sum(float(ink[ring&(angle>=k/12)&(angle<(k+1)/12)].mean())>.12 for k in range(12))/12
   center=float(ink[r<=1.7].mean())
   rows.append({'row':row+1,'center':[round(x,3),round(cy,3)],'ring_ink':round(density,4),'angular_support':round(support,4),'center_ink':round(center,4),'threshold':threshold})
  chosen=[r['row'] for r in rows if r['ring_ink']>=.24 and r['angular_support']>=.75]
  possible=[r['row'] for r in rows if r['ring_ink']>=.18 and r['angular_support']>=.58]
  if len(chosen)!=1 or possible!=chosen or min(r['center_ink'] for r in rows)<.05:decisions.append(None)
  else:decisions.append(chosen[0])
  measurements.extend(rows)
 if decisions[0] is None or decisions[0]!=decisions[1]:reasons.append('Unique ring/dot evidence not stable under both thresholds')
 return (None if reasons else decisions[0]),measurements,reasons

def run(root):
 root=Path(root).resolve();dataset,identity=validated_dataset(root)
 code=hashlib.sha256(Path(__file__).read_text(encoding='utf-8-sig').replace('\r\n','\n').encode()).hexdigest()
 key=hashlib.sha256((VERSION+SOURCE+identity+code).encode()).hexdigest()[:20]
 mp=root/'data/ingest/winter_ap_answers_manifest.json';manifest=read(mp) if mp.exists() else {'versions':{}}
 state=manifest['versions'].get(key,{})
 if state.get('status')=='complete' and artifacts_valid(root,state['artifacts']):return {'status':'skipped','questions':36,'pdf_pages_read':0}
 cache=read(root/'data/ingest/winter_solution_cache.json')
 if cache['source_hash']!=SOURCE or cache['status']!='complete':raise ValueError('Unexpected official solution source')
 state.setdefault('records',{});state.update({'source_hash':SOURCE,'dataset_identity':identity,'version':VERSION,'status':'processing'});manifest['versions'][key]=state;manifest['active_key']=key
 images={};paths=[];answers=[];solutions=[]
 def page(n):
  if n not in images:
   meta=cache['pages'][str(n)]
   if not all((root/p).exists() and hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in meta['artifacts'].items()):raise ValueError('Private source page changed; refusing rescan')
   images[n]=Image.open(root/meta['image']).convert('RGB')
  return images[n],cache['pages'][str(n)]['geometry']
 def crop(n,box,target):
  im,size=page(n);sx=im.width/size[0];sy=im.height/size[1]
  dest=root/'public'/target;dest.parent.mkdir(parents=True,exist_ok=True)
  im.crop((math.floor(box[0]*sx),math.floor(box[1]*sy),math.ceil(box[2]*sx),math.ceil(box[3]*sy))).save(dest)
 for q in dataset['questions']:
  num=q['question_number'];label=str(num);old=state['records'].get(label)
  if old:
   if digest(root/'public'/old['crop'])!=old['crop_hash'] or hashlib.sha256(json.dumps(old['record'],sort_keys=True).encode()).hexdigest()!=old['record_hash']:raise ValueError('Completed official answer checkpoint changed')
   record=old['record'];target=old['crop']
  elif label.startswith('U'):
   index=int(label[1:]);n,box,count=U_REGIONS[index-1];target=f'assets/u-solutions/{VERSION}-{key}/{label}.png';crop(n,box,target)
   record={'question_id':q['question_id'],'question_number':num,'exam':dataset['exam'],'module':dataset['module'],'solution_source_pdf':SOLUTION_MEMBER,'solution_source_pdf_available':False,'solution_source_page':n,'solution_bbox':box,'regions':[{'source_page':n,'bbox':box}],'cropped_solution_image':target,'bbox_units':'PDF points, top-left origin','review_status':'auto_ready','answer_type':'multi_part','subparts':[{'id':str(i),'label':f'{i} · Teilaufgabe {i}','type':'drawing' if (index,i) in [(5,1),(7,2)] else 'short_text'} for i in range(1,count+1)],'source_hash':SOURCE,'extractor_revision':VERSION,'association_evidence':'Exact-source visual verification: printed AP module headings on pages3 and5; printed U1–U8 labels with explicit page4 continuation. No nearest-region inference.','grading_policy':'User self-assessment only; no scoring rubric or numeric tolerance inferred.'}
  else:
   number=int(num);group=(number-1)//10;col=(number-1)%10;x=89.55+34.42*col;y=[242.7,310.9,379.7][group]+.16*col
   im,size=page(10);answer,measurements,reasons=detect_column(np.asarray(im.convert('L')),im.width/size[0],x,y)
   box=[round(x-15,3),round(y-16,3),round(x+15,3),round(y+4*11.48+8,3)];target=f'assets/answers/{VERSION}-{key}/Q{number:02}.png';crop(10,box,target)
   record={'question_id':q['question_id'],'question_number':number,'exam':dataset['exam'],'module':dataset['module'],'official_answer_type':'multiple_choice','official_answer':answer,'status':'needs_review' if reasons else 'auto_ready','official_answer_status':'needs_review' if reasons else 'auto_ready','parser_revision':VERSION+'-'+key,'confidence':0 if reasons else .98,'review_reasons':reasons,'measurements':measurements,'solution_source_page':10,'source_page':10,'source_pdf':SOLUTION_MEMBER,'source_pdf_available':False,'source_pdf_sha256':SOURCE,'source_crop':target,'answer_bbox':box,'bbox_units':'PDF points; origin top-left','extractor_revision':VERSION,'header_evidence':'Visually verified exact-source AP physical page10, printed headers1–28; geometry bound to source SHA256; two-threshold ring consensus.'}
  if not old:
   state['records'][label]={'record':record,'record_hash':hashlib.sha256(json.dumps(record,sort_keys=True).encode()).hexdigest(),'crop':target,'crop_hash':digest(root/'public'/target)};save(mp,manifest)
  paths.append('public/'+target)
  (solutions if label.startswith('U') else answers).append(record)
 overlay=f'assets/answers/{VERSION}-{key}/answer-grid-overlay.png'
 sheet=Image.new('RGB',(1960,1080),'white');draw=ImageDraw.Draw(sheet)
 for i,r in enumerate(answers):
  im=Image.open(root/'public'/r['source_crop']).convert('RGB');im.thumbnail((160,210));x=(i%7)*280+12;y=(i//7)*270+35;sheet.paste(im,(x,y))
  draw.text((x,y-25),f"Q{r['question_number']} | answer {r['official_answer']}",fill='black')
  box=r['answer_bbox'];sx=im.width/(box[2]-box[0]);sy=im.height/(box[3]-box[1])
  for m in r['measurements'][:5]:
   cx=x+(m['center'][0]-box[0])*sx;cy=y+(m['center'][1]-box[1])*sy;chosen=m['row']==r['official_answer'];color='#08782e' if chosen else '#2b60a7'
   draw.line((cx+7*sx,cy,x+im.width+10,cy),fill=color,width=1);draw.text((x+im.width+15,cy-5),f"row {m['row']}"+(' SELECTED' if chosen else ''),fill=color)
   if chosen:draw.rectangle((cx-7*sx,cy-7*sy,cx+7*sx,cy+7*sy),outline=color,width=3)
 sheet.save(root/'public'/overlay);paths.append('public/'+overlay)
 for suffix,records in [('answers',answers),('u_solutions',solutions)]:
  result={'schema_version':1,'exam':dataset['exam'],'module':dataset['module'],'extractor_revision':VERSION,suffix if suffix=='answers' else 'solutions':records,'source_hash':SOURCE,'source_pdf_available':False}
  if suffix=='answers':
   problems=[{'question_number':r['question_number'],'reason':reason} for r in answers for reason in r['review_reasons']]
   result.update({'parser_revision':VERSION+'-'+key,'solution_source_page':10,'overlay':overlay,'completeness':{'expected':28,'records':len(answers),'unique_complete':len(answers)==28 and len({r['question_number'] for r in answers})==28 and not problems,'problems':problems},'confidence_note':'Deterministic geometric rule grade, not a calibrated probability.'})
  for base in ('data/exams','public/data'):
   p=f'{base}/{NAME}_{suffix}.json';save(root/p,result);paths.append(p)
 state['status']='complete';state['artifacts']={p:digest(root/p) for p in paths};save(mp,manifest)
 return {'status':'complete','answers':len(answers),'u_solutions':len(solutions),'needs_review':sum(bool(a['review_reasons']) for a in answers),'pdf_pages_read':0}
if __name__=='__main__':print(json.dumps(run(Path(__file__).resolve().parents[1]),indent=2))
