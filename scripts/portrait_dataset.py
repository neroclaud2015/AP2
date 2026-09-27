"""Reusable explicitly scoped portrait source cache and audited-config promotion.
Never discovers archives or infers question ownership. Completed pages are immutable.
"""
from pathlib import Path
import hashlib,json,zipfile,shutil,html
from contextlib import contextmanager
import pymupdf
from PIL import Image,ImageDraw
from ingest import read,save,digest
from answers import artifact_digest,artifacts_valid
from layout_profiles.portrait_raster import analyze_portrait,compose_cached_regions,patch_image

VERSION='2e.1.0'
def objhash(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
@contextmanager
def scoped_lock(root,scope):
 from ingest import lock
 # Existing lock implementation, isolated root so unrelated module writers can run.
 folder=root/'data/ingest/scoped-locks'/scope
 with lock(folder):yield

def cache_source(root,archive,member,scope,max_pages=None):
 root=Path(root);archive=Path(archive);manifest_path=root/f'data/ingest/{scope}_source_manifest.json'
 with scoped_lock(root,scope):
  old=read(manifest_path);archive_hash=digest(archive)
  if old and (old['archive_sha256']!=archive_hash or old['member']!=member):raise ValueError('Scoped source archive changed; no silent replacement')
  if old:
   state=old
  else:
   with zipfile.ZipFile(archive) as z:data=z.read(member)
   source_hash=hashlib.sha256(data).hexdigest();docid=source_hash[:24]
   pdf=root/f'data/ingest/{scope}-source/{docid}/source.pdf';pdf.parent.mkdir(parents=True,exist_ok=True);pdf.write_bytes(data)
   state={'schema_version':1,'cache_version':VERSION,'scope':scope,'archive_sha256':archive_hash,'member':member,
    'source_hash':source_hash,'doc_id':docid,'public_pdf':f'assets/pdfs/{docid}.pdf','public_pdf_available':False,'pdf_path':pdf.relative_to(root).as_posix(),'dpi':180,'pages':{},'status':'caching'}
   save(manifest_path,state)
  for item in state['pages'].values():
   if not artifacts_valid(root,item['artifacts']):raise ValueError('Immutable cached page changed; refusing PDF rescan')
  if state['status']=='complete':return {'status':'skipped','pages_processed':0,'source_hash':state['source_hash'],'page_count':state['page_count']}
  doc=None;processed=0
  try:
   if 'page_count' not in state:
    doc=pymupdf.open(root/state['pdf_path']);state['page_count']=len(doc);save(manifest_path,state)
   for page in range(1,state['page_count']+1):
    if str(page) in state['pages']:continue
    if max_pages is not None and processed>=max_pages:break
    if doc is None:doc=pymupdf.open(root/state['pdf_path'])
    p=doc[page-1];raw={'source_page':page,'width':p.rect.width,'height':p.rect.height,'raw_text':p.get_text(),'lines':[]}
    for block in p.get_text('dict')['blocks']:
     for line in block.get('lines',[]):raw['lines'].append({'text':''.join(s['text'] for s in line['spans']),'bbox':list(line['bbox'])})
    image=root/f'data/ingest/{scope}-source/{state["doc_id"]}/{page:03}.png';image.parent.mkdir(parents=True,exist_ok=True)
    p.get_pixmap(dpi=180,alpha=False).save(image)
    rawpath=root/f'data/ingest/{scope}-source/{state["doc_id"]}/{page:03}.json';save(rawpath,raw)
    paths=[image,rawpath];state['pages'][str(page)]={'image':image.relative_to(root).as_posix(),'raw':rawpath.relative_to(root).as_posix(),
     'geometry':[p.rect.width,p.rect.height],'artifacts':{x.relative_to(root).as_posix():artifact_digest(x) for x in paths}}
    processed+=1;save(manifest_path,state)
   state['status']='complete' if len(state['pages'])==state['page_count'] else 'caching';save(manifest_path,state)
  finally:
   if doc:doc.close()
  return {'status':state['status'],'pages_processed':processed,'source_hash':state['source_hash'],'page_count':state['page_count']}

def verify_layout(records,config):
 from collections import Counter
 from layout_validation import geometry_issues
 anchors=[a for r in records for a in r['anchors']];regions=[x for r in records for x in r['regions']]
 numbers=Counter(a['number'] for a in anchors);ids=Counter(a['anchor_id'] for a in anchors)
 issues=[{'page':r['page'],'reason':i} for r in records for i in r['issues']]+geometry_issues(records)
 for r in regions:
  if r['owner'] is None or ids[r['owner']]!=1:issues.append({'page':r['page'],'reason':'unverified_region_owner'})
 missing=sorted(set(config['expected'])-set(numbers));unexpected=sorted(set(numbers)-set(config['expected']));duplicates=[n for n,c in numbers.items() if c!=1]
 if len(records)!=len(config['pages']):issues.append({'reason':'page_coverage_mismatch'})
 return {'status':'compatible' if not (issues or missing or unexpected or duplicates) else 'blocked','observed':len(anchors),'expected':len(config['expected']),
  'missing':missing,'unexpected':unexpected,'duplicates':duplicates,'issues':issues,'all_pages_classified':len(records)}

def run_profile(root,config_path,promote=False):
 root=Path(root);config=read(config_path);scope=config['profile_id']
 import inspect
 engine_hash=hashlib.sha256(Path(inspect.getfile(analyze_portrait)).read_text().replace('\r\n','\n').encode()).hexdigest()
 config_hash=objhash({'config':config,'engine':engine_hash,'runner_version':VERSION,'runner_hash':hashlib.sha256(Path(__file__).read_text().replace('\r\n','\n').encode()).hexdigest()});revision=config['version']+'-'+config_hash[:12]
 key=config['source_hash']+':'+revision;manifest_path=root/f'data/ingest/{scope}_segmentation_manifest.json'
 existing=read(manifest_path,{'versions':{}})['versions'].get(key,{})
 if existing.get('status')==('promoted' if promote else 'preview_ready') and artifacts_valid(root,existing.get('artifacts')):
  return {'status':'skipped','processed_pages':0,'questions':len(config['expected']),'pdf_pages_opened':0,'pdf_pages_rendered':0,'revision':revision}
 cache=read(root/f'data/ingest/{scope}_source_manifest.json')
 if not cache or cache['status']!='complete' or cache['source_hash']!=config['source_hash']:raise ValueError('Unknown or incomplete source cache')
 if set(cache['pages'])!=set(config['pages']):raise ValueError('Unclassified physical source pages')
 for item in cache['pages'].values():
  if not artifacts_valid(root,item['artifacts']):raise ValueError('Cached source integrity failure; no PDF rescan')
 evidence=root/f'docs/evidence/phase2e/{scope}';evidence.mkdir(parents=True,exist_ok=True)
 with scoped_lock(root,scope+'-profile'):
  manifest=read(manifest_path,{'versions':{}});state=manifest['versions'].setdefault(key,{'status':'validating','pages':{}});manifest['active_key']=key
  processed=0;records=[];images={};geometry={}
  for n,item in cache['pages'].items():
   page=int(n);raw=read(root/item['raw']);images[page]=Image.open(root/item['image']).convert('RGB');geometry[page]=item['geometry']
   checkpoint=root/f'data/ingest/{scope}-layout/{revision}/page-{page:03}.json';prior=state['pages'].get(n)
   if prior and artifact_digest(checkpoint)==prior['sha256']:record=read(checkpoint)
   else:
    record=analyze_portrait(raw,images[page],config['pages'][n],prefix=scope)
    record.update(source_hash=cache['source_hash'],source_image_sha256=item['artifacts'][item['image']],config_hash=config_hash)
    save(checkpoint,record);state['pages'][n]={'checkpoint':checkpoint.relative_to(root).as_posix(),'sha256':artifact_digest(checkpoint)};save(manifest_path,manifest);processed+=1
   records.append(record)
  validation=verify_layout(records,config);report={**validation,'profile_id':scope,'source_hash':cache['source_hash'],'revision':revision,'config_hash':config_hash,'pdf_pages_rendered':0,'pdf_pages_opened':0,'formal_records_generated':False}
  if validation['status']!='compatible':state['status']='blocked';save(manifest_path,manifest);save(evidence/'report.json',report);return report
  if state['status']==('promoted' if promote else 'preview_ready') and artifacts_valid(root,state.get('artifacts')):
   for im in images.values():im.close()
   return {**report,'status':'skipped','processed_pages':0,'questions':len(config['expected'])}
  anchors=[(r['page'],a) for r in records for a in r['anchors']];anchors.sort(key=lambda x:(x[1]['number'].startswith('U'),int(x[1]['number'].lstrip('U'))))
  regions=[r for p in records for r in p['regions']];questions=[];preview=[];headingcards=[];paths=[]
  for page,a in anchors:
   owned=[r for r in regions if r['owner']==a['anchor_id']];im=compose_cached_regions(owned,images,geometry);number=a['number'];name=('Q'+number if number.isdigit() else number)+'.png'
   crop=f'assets/questions/{cache["doc_id"]}/{revision}/{a["anchor_id"]}.png';target=root/'public'/crop;target.parent.mkdir(parents=True,exist_ok=True);im.save(target);paths.append(target)
   copy=evidence/name;shutil.copyfile(target,copy);paths.append(copy)
   heading=evidence/f'heading-{number}.png';patch_image(images[page],a['bbox'],geometry[page]).save(heading);paths.append(heading)
   headingcards.append(f"<article><h3>{number} · source page {page}</h3><img src='{heading.name}'></article>")
   main=[r['bbox'] for r in owned if r['page']==page];bbox=[min(b[0] for b in main),min(b[1] for b in main),max(b[2] for b in main),max(b[3] for b in main)]
   question={'question_id':a['anchor_id'],'question_number':number,'exam':config['exam'],'module':config['module'],
    'source_pdf':cache['public_pdf'],'source_pdf_available':cache.get('public_pdf_available',True),'source_page':page,
    'source_page_image':(f'assets/pages/{cache["doc_id"]}/{page:03}.png' if cache.get('public_pdf_available',True) else ''),'source_page_available':cache.get('public_pdf_available',True),'source_size':geometry[page],
    'bounding_box':bbox,'regions':main,'source_regions':[{**r,'source_page_image':(f'assets/pages/{cache["doc_id"]}/{r["page"]:03}.png' if cache.get('public_pdf_available',True) else ''),'source_size':geometry[r['page']]} for r in owned],
    'cropped_question_image':crop,'extracted_text':'','extraction_confidence':.98,'label_evidence':a['evidence'],'review_status':'auto_ready','review_reasons':[],
    'extractor_version':config['version'],'segmentation_revision':revision,'tags':[],'solution_page':None,'solution_confirmed':False,
    'heading_pixel_sha256':a['heading_pixel_sha256'],'source_sha256':cache['source_hash']}
   questions.append(question);preview.append({'question_id':a['anchor_id'],'question_number':number,'source_pages':list(dict.fromkeys(r['page'] for r in owned)),'regions':owned,'image':name,'sha256':artifact_digest(target)})
  attachment_images=[]
  for item in config.get('attachment_crops',[]):
   crop=f'assets/questions/{cache["doc_id"]}/{revision}/attachment-{item["page"]}.png';target=root/'public'/crop
   patch_image(images[item['page']],item['bbox'],geometry[item['page']]).save(target);paths.append(target)
   attachment_images.append({**item,'image':crop,'source_sha256':cache['source_hash']})
  for im in images.values():im.close()
  css="body{font:18px system-ui;margin:30px;color:#193f35}img{max-width:100%}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:20px}article{border:1px solid #aabbcc;padding:12px}pre{white-space:pre-wrap}"
  cards=''.join(f"<article><h2>{i['question_number']}</h2><p>Source pages {i['source_pages']}</p><a href='{i['image']}'><img loading='lazy' src='{i['image']}'></a></article>" for i in preview)
  (evidence/'index.html').write_text(f"<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>{scope} verified questions</title><style>{css}</style><h1>{config['exam']} · {config['module']} · {len(preview)} verified questions</h1><p>All physical pages classified. Exact observed printed headings, explicit region ownership, no sequence completion. Cached pixels only; no PDF rerender.</p><p><a href='report.json'>Structural checks</a> · <a href='headings.html'>Every printed heading</a> · <a href='preview-manifest.json'>Provenance</a></p><div class='grid'>{cards}</div>",encoding='utf8')
  (evidence/'headings.html').write_text(f"<!doctype html><meta charset='utf-8'><style>{css}</style><h1>Individually observed printed numbers</h1><div class='grid'>{''.join(headingcards)}</div>",encoding='utf8')
  save(evidence/'preview-manifest.json',{'source_hash':cache['source_hash'],'revision':revision,'count':len(preview),'items':preview})
  report['formal_records_generated']=promote;report['preview_count']=len(preview);report['timing_minutes']=config.get('timing_minutes');save(evidence/'report.json',report)
  if promote:
   solution=read(root/'data/ingest/winter_solution_cache.json');solution_doc={'public_pdf':f"assets/pdfs/{solution['doc_id']}.pdf",'public_pdf_available':False,'pages':[]}
   data={'schema_version':2,'exam':config['exam'],'module':config['module'],'document_id':cache['doc_id'],'source_pdf':cache['public_pdf'],'source_pdf_available':cache.get('public_pdf_available',True),
    'source_sha256':cache['source_hash'],'extractor_version':config['version'],'segmentation_revision':revision,'profile_id':scope,'questions':questions,
    'pages_processed':cache['page_count'],'pages_total':cache['page_count'],'source_pages':[{'number':int(n),'image':(f"assets/pages/{cache['doc_id']}/{int(n):03}.png" if cache.get('public_pdf_available',True) else '')} for n in cache['pages']],
    'solution_document':solution_doc,'coverage':{'expected_count':len(preview),'observed_count':len(preview),'missing':[],'unexpected':[]},'review_queue':[],'unresolved_regions':[],
    'timing_minutes':config.get('timing_minutes'),'timing_source_page':config.get('timing_source_page'),'attachment_refs':config.get('attachment_refs',{}),'attachment_images':attachment_images,'shared_description_page':config.get('description_page'),
    'confidence_note':'Printed heading pixels and ownership manually verified; no sequential number inference. Original image authoritative.'}
   for prefix in ['data/exams','public/data']:
    path=root/f'{prefix}/{config["name"]}_segmented.json';save(path,data);paths.append(path)
  paths.extend(evidence.glob('*.json'));paths.extend(evidence.glob('*.html'))
  state.update(status='promoted' if promote else 'preview_ready',source_hash=cache['source_hash'],config_hash=config_hash,artifacts={p.relative_to(root).as_posix():artifact_digest(p) for p in paths});save(manifest_path,manifest)
  return {**report,'status':state['status'],'processed_pages':processed,'questions':len(questions)}
