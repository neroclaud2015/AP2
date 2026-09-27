"""WiSo cached-image preview and explicitly requested promotion; no PDF reads."""
from pathlib import Path
import hashlib,json,html,shutil,argparse
from PIL import Image,ImageDraw
from acceptance_artifacts import active_evidence
from answers import artifact_digest as binary_or_json_digest
from ingest import read,save,lock
from layout_profiles.ap_2017 import region_text
VERSION='2d.1.0';DOC='35f662246f2737dba0b61b88';NAME='2017_sommer_wiso'

def artifact_digest(path):
 path=Path(path)
 if path.suffix=='.html':return hashlib.sha256(path.read_text(encoding='utf8').encode()).hexdigest()
 return binary_or_json_digest(path)

def artifacts_valid(root,artifacts):
 try:return bool(artifacts) and all((root/p).is_file() and artifact_digest(root/p)==h for p,h in artifacts.items())
 except (OSError,ValueError):return False


def run(root,promote=False):
 root=Path(root);folder,report=active_evidence(root,'wiso_2017')
 if report['status']!='compatible' or report['detected_question_count']!=24:raise ValueError('WiSo completeness not validated')
 legacy=read(root/'public/data/2017_sommer.json');doc=next(d for d in legacy['documents'] if d['id']==DOC)
 if doc.get('sha256')!=report['source_hash'] or doc.get('module')!='WiSo' or doc.get('exam')!='2017_sommer' or doc.get('public_pdf')!=f'assets/pdfs/{DOC}.pdf':raise ValueError('WiSo source metadata integrity failure')
 metadata_hash=hashlib.sha256(json.dumps({'document':doc,'solution':next(d for d in legacy['documents'] if d['module']=='Solutions')},sort_keys=True).encode()).hexdigest()
 config=report['config_hash'];revision=VERSION+'-'+config;manifest_path=root/'data/ingest/wiso_segmentation_manifest.json'
 algo=hashlib.sha256(Path(__file__).read_text().replace('\r\n','\n').encode()).hexdigest();key=report['source_hash']+':'+revision+':'+algo+':'+metadata_hash
 with lock(root):
  manifest=read(manifest_path,{'entries':{}});state=manifest['entries'].setdefault(key,{'status':'previewing','source_hash':report['source_hash'],'version':VERSION,'config_hash':config,'algorithm_hash':algo,'source_metadata_hash':metadata_hash,'questions':{}})
  if state['status'] in (('promoted',) if promote else ('preview_ready','promoted')) and artifacts_valid(root,state.get('artifacts')):return {'status':'skipped','questions':24,'pdf_pages_read':0}
  pages={n:read(folder/f'page-{n:03}.json') for n in range(1,10)};anchors=[{**a,'page':n} for n,p in pages.items() for a in p['anchors']]
  anchors.sort(key=lambda a:(a['number'].startswith('U'),int(a['number'].lstrip('U'))))
  if len(anchors)!=24 or {a['number'] for a in anchors}!={str(i) for i in range(1,19)}|{'U'+str(i) for i in range(1,7)}:raise ValueError('Invalid WiSo identities')
  out=root/'docs/evidence/phase2d/wiso-preview';out.mkdir(parents=True,exist_ok=True)
  legacy=read(root/'public/data/2017_sommer.json');doc=next(d for d in legacy['documents'] if d['id']==DOC)
  questions=[];items=[]
  for a in anchors:
   aid=a['anchor_id'];regions=[r for p in pages.values() for r in p['regions'] if r['owner']==aid];regions.sort(key=lambda r:(r['role']!='primary',r['page']))
   primary=next(r for r in regions if r['role']=='primary');page=primary['page'];main=[r['bbox'] for r in regions if r['page']==page]
   bbox=[min(b[0] for b in main),min(b[1] for b in main),max(b[2] for b in main),max(b[3] for b in main)]
   name=('Q'+a['number'] if a['number'].isdigit() else a['number'])+'.png';crop=f'assets/questions/{DOC}/{revision}/{aid}.png';target=root/'public'/crop;target.parent.mkdir(parents=True,exist_ok=True)
   saved=state['questions'].get(aid)
   if not saved or not target.exists() or artifact_digest(target)!=saved['sha256']:
    panels=[]
    for r in regions:
     im=Image.open(folder/f"page-{r['page']:03}.png").convert('RGB');w,h=pages[r['page']]['geometry'];box=tuple(round(v*(im.width/w if i%2==0 else im.height/h)) for i,v in enumerate(r['bbox']));panels.append(im.crop(box))
    image=Image.new('RGB',(max(p.width for p in panels),sum(p.height for p in panels)+18*(len(panels)-1)),'white');y=0
    for panel in panels:image.paste(panel,(0,y));y+=panel.height+18
    image.save(target);state['questions'][aid]={'sha256':artifact_digest(target),'regions':regions};save(manifest_path,manifest)
   elif saved['regions']!=regions:raise ValueError('Stale question region checkpoint')
   shutil.copy2(target,out/name)
   enriched=[{**r,'source_page_image':f'assets/pages/{DOC}/{r["page"]:03}.png','source_size':pages[r['page']]['geometry']} for r in regions]
   questions.append({'question_id':aid,'exam':'2017_sommer','module':'WiSo','question_number':a['number'],'source_pdf':doc['public_pdf'],'source_page':page,'source_page_image':f'assets/pages/{DOC}/{page:03}.png','source_size':pages[page]['geometry'],
    'bounding_box':bbox,'regions':main,'source_regions':enriched,'cropped_question_image':crop,'extracted_text':'\n\n'.join(region_text(pages[r['page']]['raw']['lines'],[r['bbox']]) for r in regions),
    'extraction_confidence':a.get('confidence',.96),'label_evidence':a['evidence'],'review_status':'needs_review' if a['review_reasons'] else 'auto_ready','review_reasons':a['review_reasons'],'extractor_version':VERSION,'segmentation_revision':revision,'tags':[],'solution_page':None,'solution_confirmed':False})
   items.append({'question_id':aid,'question_number':a['number'],'regions':regions,'image':name,'sha256':artifact_digest(target),'review_reasons':a['review_reasons']})
  preview={'source_hash':report['source_hash'],'profile_id':report['profile'],'config_hash':config,'version':VERSION,'count':24,'items':items,'pdf_pages_read':0,'source_resolution_dpi':120,'status':'preview_ready','formal_records_written':promote};save(out/'preview-manifest.json',preview)
  cards=''.join(f"<article><h2>{'Q' if x['question_number'].isdigit() else ''}{x['question_number']}</h2><p>Source pages: {', '.join(str(r['page']) for r in x['regions'])}</p><a href='{x['image']}'><img loading='lazy' src='{x['image']}'></a><details><summary>Region ownership</summary><pre>{html.escape(json.dumps(x['regions'],indent=2))}</pre></details></article>" for x in items)
  (out/'index.html').write_text("<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>WiSo 24 question preview</title><style>body{font:18px system-ui;margin:30px;color:#193f35}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:22px}article{border:1px solid #ccd9c9;padding:18px}img{max-width:100%}pre{white-space:pre-wrap}</style><h1>Sommer 2017 WiSo · 24 original questions</h1><p>Q1–Q18 + U1–U6 · 0 unresolved labels. Crops from cached original pixels. U6 includes primary page5 then explicitly labelled continuation page4. No PDF rescanning.</p><a href='contact-sheet.jpg'>All-question contact sheet</a><main>"+cards+'</main>',encoding='utf8')
  sheet=Image.new('RGB',(2000,2400),'white');d=ImageDraw.Draw(sheet)
  for i,item in enumerate(items):
   im=Image.open(out/item['image']);im.thumbnail((480,360));x=i%4*500;y=i//4*400;sheet.paste(im,(x,y+30));d.text((x+8,y+5),item['question_number'],fill='black')
  sheet.save(out/'contact-sheet.jpg',quality=90)
  outputs=[]
  if promote:
   result={'schema_version':2,'exam':'2017_sommer','module':'WiSo','document_id':DOC,'source_pdf':doc['public_pdf'],'source_sha256':report['source_hash'],'extractor_version':VERSION,'segmentation_revision':revision,'profile_id':report['profile'],'questions':questions,'pages_processed':9,'pages_total':9,'source_pages':doc['pages'],'solution_document':next(d for d in legacy['documents'] if d['module']=='Solutions'),'confidence_note':'20 previous verified anchors retained; four headings resolved with actual printed-label evidence and three threshold local OCR. Original image is authoritative.','coverage':{'expected_count':24,'observed_count':24,'missing':[],'unexpected':[]},'review_queue':[q['question_id'] for q in questions if q['review_reasons']],'unresolved_regions':[]}
   outputs=[root/f'data/exams/{NAME}_segmented.json',root/f'public/data/{NAME}_segmented.json']
   for p in outputs:save(p,result)
  paths=outputs+list(out.glob('*'))+[root/'public'/q['cropped_question_image'] for q in questions]
  state.update(status='promoted' if promote else 'preview_ready',artifacts={p.relative_to(root).as_posix():artifact_digest(p) for p in paths if p.is_file()});save(manifest_path,manifest)
  return {'status':state['status'],'questions':24,'needs_review':sum(bool(a['review_reasons']) for a in anchors),'pdf_pages_read':0}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--promote',action='store_true');args=p.parse_args();print(json.dumps(run(Path(__file__).resolve().parents[1],args.promote),indent=2))
