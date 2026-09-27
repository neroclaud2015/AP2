"""Private per-page cache of Winter official solutions; no public source publication."""
from pathlib import Path
import hashlib,json,zipfile
import pymupdf
from PIL import Image
from ingest import read,save
VERSION='2e.1.0'
MEMBER='2017_18 Winter/17_18 Lösung.pdf'
ARCHIVE='../2017_18 Winter-20260926T101140Z-1-001.zip'
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def run(root,max_pages=None):
 root=Path(root).resolve();path=root/'data/ingest/winter_solution_cache.json';state=read(path)
 if state:
  pdf=root/state['source_file']
  if sha(pdf)!=state['source_hash']:raise ValueError('Winter solution PDF changed')
 else:
  with zipfile.ZipFile(root/ARCHIVE) as z:data=z.read(MEMBER)
  source_hash=hashlib.sha256(data).hexdigest();docid=source_hash[:24];source_file=f'data/ingest/winter-solutions/{docid}/source.pdf';pdf=root/source_file;pdf.parent.mkdir(parents=True,exist_ok=True);pdf.write_bytes(data)
  state={'version':VERSION,'source_hash':source_hash,'doc_id':docid,'source_file':source_file,'archive_member':MEMBER,'dpi':180,'pages':{},'status':'caching','public_source_published':False};save(path,state)
 processed=0;doc=None
 try:
  if 'page_count' not in state:doc=pymupdf.open(pdf);state['page_count']=len(doc);save(path,state)
  for n in range(1,state['page_count']+1):
   old=state['pages'].get(str(n))
   if old:
    if not all((root/p).exists() and sha(root/p)==h for p,h in old['artifacts'].items()):raise ValueError('Completed Winter solution cache damaged; refusing silent rescan')
    continue
   if max_pages is not None and processed>=max_pages:break
   if doc is None:doc=pymupdf.open(pdf)
   page=doc[n-1];geometry=[page.rect.width,page.rect.height];pix=page.get_pixmap(dpi=180,colorspace=pymupdf.csRGB,alpha=False)
   image=f"data/ingest/winter-solutions/{state['doc_id']}/pages/{n:03}.png";target=root/image;target.parent.mkdir(parents=True,exist_ok=True);Image.frombytes('RGB',(pix.width,pix.height),pix.samples).save(target)
   lines=[]
   for block in page.get_text('dict')['blocks']:
    for line in block.get('lines',[]):lines.append({'text':''.join(s['text'] for s in line['spans']),'bbox':list(line['bbox'])})
   raw=f"data/ingest/winter-solutions/{state['doc_id']}/raw/{n:03}.json";save(root/raw,{'source_hash':state['source_hash'],'source_page':n,'width':geometry[0],'height':geometry[1],'lines':lines,'source_image':image})
   state['pages'][str(n)]={'image':image,'raw':raw,'geometry':geometry,'artifacts':{image:sha(target),raw:sha(root/raw)}};save(path,state);processed+=1;print(f'Winter private solutions checkpoint {n}/{state["page_count"]}',flush=True)
 finally:
  if doc:doc.close()
 state['status']='complete' if len(state['pages'])==state['page_count'] else 'caching';save(path,state)
 return {**state,'processed_now':processed,'skipped_pages':len(state['pages'])-processed}
if __name__=='__main__':
 result=run(Path(__file__).resolve().parents[1]);print(json.dumps({k:v for k,v in result.items() if k!='pages'},indent=2))
