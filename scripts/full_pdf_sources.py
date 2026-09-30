"""Publish byte-identical originals for production sources; no extraction or page rendering."""
from pathlib import Path
import argparse, hashlib, json, shutil, zipfile
ROOT=Path(__file__).resolve().parents[1]
def read(p): return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def alias(index,ref,digest):
 if not ref:return
 previous=index['aliases'].get(ref)
 if previous and previous!=digest:raise ValueError('Conflicting original PDF alias: '+ref)
 index['aliases'][ref]=digest

def publish(root,modules):
 root=Path(root);registry=read(root/'public/data/source_registry.json')['sources'];cache={}
 for p in (root/'data/ingest').glob('*source_manifest.json'):
  d=read(p)
  if d.get('pdf_path') and d.get('source_hash'):cache[d['source_hash']]=root/d['pdf_path']
 winter=read(root/'data/ingest/winter_solution_cache.json');cache[winter['source_hash']]=root/winter['source_file']
 index={'schema_version':1,'documents':{},'aliases':{},'questions':{}}
 def install(source):
  digest=source['sha256']
  if digest in index['documents']:return digest
  path=cache.get(digest)
  public=root/'public'/source['filename']
  if not path and public.is_file():path=public
  if not path and (root/source['filename']).is_file():path=root/source['filename']
  if not path and source['filename']=='2017_18 Winter/17_18 Arbeitsplanung.pdf':
   with zipfile.ZipFile(root.parent/'2017_18 Winter-20260926T101140Z-1-001.zip') as z:data=z.read(source['filename'])
   if hashlib.sha256(data).hexdigest()!=digest:raise ValueError('Archive hash mismatch')
   path=root/'private/full-pdf-originals'/f'{digest}.pdf';path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
  if not path or not path.is_file():raise ValueError('Missing original '+source['filename'])
  if sha(path)!=digest or not path.read_bytes().startswith(b'%PDF-'):raise ValueError('Original hash/header mismatch '+str(path))
  target=source['filename'] if source['filename'].startswith('assets/pdfs/') else f'assets/pdfs/{digest[:24]}.pdf'
  destination=root/'public'/target
  if destination.exists():
   if sha(destination)!=digest:raise ValueError('Existing original differs '+target)
  else:destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,destination)
  import pymupdf
  with pymupdf.open(destination) as pdf:pages=len(pdf)
  index['documents'][digest]={'path':target,'sha256':digest,'pages':pages,'bytes':destination.stat().st_size,'filename':source['filename']}
  alias(index,source['filename'],digest);alias(index,target,digest);return digest
 def source_for(m,kind,digest=None):
  choices=[s for s in registry if s['exam']==m['examId'] and s['module']==m['slug'] and s['source_type']==kind and s['status']=='production']
  if digest:choices=[s for s in choices if s['sha256']==digest]
  if len({s['sha256'] for s in choices})!=1:raise ValueError('Ambiguous production source '+m['examId']+'/'+m['slug']+'/'+kind)
  return choices[0]
 for m in modules:
  exam=read(root/'public'/m['segmentedPath']);answers=read(root/'public'/m['answersPath'])['answers'];solutions=read(root/'public'/m['solutionsPath'])['solutions']
  qhash=install(source_for(m,'question_pdf',exam.get('source_sha256') or exam.get('source_pdf_sha256')));ahash=install(source_for(m,'solution_pdf'))
  alias(index,exam['source_pdf'],qhash)
  by_answer={a['question_id']:a for a in answers};by_u={a['question_id']:a for a in solutions}
  for q in exam['questions']:
   alias(index,q['source_pdf'],qhash);a=by_answer.get(q['question_id']);u=by_u.get(q['question_id']);ref=a['source_pdf'] if a else u['solution_source_pdf'];page=a['solution_source_page'] if a else u['solution_source_page'];alias(index,ref,ahash)
   if q['source_page']>index['documents'][qhash]['pages'] or page>index['documents'][ahash]['pages']:raise ValueError('Page outside original')
   index['questions'][q['question_id']]={'question':qhash,'solution':ahash,'solution_page':page}
  for attachment in m.get('externalAttachments',[]):
   candidates=[s for s in registry if s['sha256']==attachment['sha256']]
   install(candidates[0] if candidates else {'sha256':attachment['sha256'],'filename':attachment['filename']})
 # Include independently registered official notices shown alongside released solutions.
 for name in ['official_corrections.json','official_corrections_overnight.json']:
  for notice in read(root/'public/data'/name):
   if notice['question_id'] not in index['questions']:continue
   matches=[s for s in registry if s['sha256']==notice['source_sha256']]
   if matches:alias(index,notice['source_pdf'],install(matches[0]))
 index['documents']=dict(sorted(index['documents'].items()));index['aliases']=dict(sorted(index['aliases'].items()));index['questions']=dict(sorted(index['questions'].items()))
 target=root/'public/data/full_pdf_sources.json';target.write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 return validate(root)
def validate(root):
 root=Path(root);index=read(root/'public/data/full_pdf_sources.json')
 for digest,doc in index['documents'].items():
  path=(root/'public'/doc['path']).resolve();path.relative_to((root/'public/assets/pdfs').resolve())
  if sha(path)!=digest or doc['sha256']!=digest or doc['pages']<1:raise ValueError('Invalid published original '+str(path))
 for ref,digest in index['aliases'].items():
  if digest not in index['documents']:raise ValueError('Unresolved alias '+ref)
 for q,v in index['questions'].items():
  if any(v[k] not in index['documents'] for k in ['question','solution']):raise ValueError('Unresolved source '+q)
 return {'questions':len(index['questions']),'documents':len(index['documents']),'bytes':sum(d['bytes'] for d in index['documents'].values()),'pdfs_resegmented':0,'pages_rendered':0,'all_original_hashes_verified':True}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--modules',type=Path);args=p.parse_args();print(json.dumps(publish(ROOT,read(args.modules)) if args.modules else validate(ROOT),indent=2))
