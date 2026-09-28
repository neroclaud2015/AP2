"""Verify production source metadata against shipped datasets; never opens a PDF."""
from pathlib import Path
import hashlib,json
from source_registry import load_registry,validate_registry,production_sources,validate_identity_artifacts

def validate(root):
 root=Path(root);registry=validate_registry(load_registry(root))
 public=json.loads((root/'public/data/source_registry.json').read_text(encoding='utf-8-sig'))
 if registry!=public:raise ValueError('Private/public source registries differ')
 modules=sorted({(s['exam'],s['module']) for s in registry['sources'] if s['status']=='production'})
 for exam,module in modules:
  pair=production_sources(registry,exam,module)
  for source in pair.values():
   if source.get('supersedes_source_id'):validate_identity_artifacts(root,registry,source)
   for evidence in [source['gates']['validated'],source['gates']['production']]:
    legacy=evidence.get('basis')=='existing_accepted_production_metadata_migration'
    for rel,expected in evidence['artifacts'].items():
     path=root/rel
     if not path.is_file():raise ValueError(f'Missing production evidence: {rel}')
     if path.suffix=='.json':
      value=json.loads(path.read_text(encoding='utf-8-sig'))
      actual=hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=legacy).encode()).hexdigest()
     else:actual=hashlib.sha256(path.read_bytes()).hexdigest()
     if actual!=expected:raise ValueError(f'Production evidence changed: {rel}')
  prefix=exam.replace('-','_')+'_'+module
  q=json.loads((root/f'public/data/{prefix}_segmented.json').read_text(encoding='utf-8-sig'))
  a=json.loads((root/f'public/data/{prefix}_answers.json').read_text(encoding='utf-8-sig'))
  u=json.loads((root/f'public/data/{prefix}_u_solutions.json').read_text(encoding='utf-8-sig'))
  if q['source_sha256']!=pair['question']['sha256']:raise ValueError('Question source hash mismatch')
  if (a.get('source_pdf_sha256') or a.get('source_hash'))!=pair['solution']['sha256']:raise ValueError('Answer source hash mismatch')
  if any(s.get('source_hash')!=pair['solution']['sha256'] for s in u['solutions']):raise ValueError('U solution source mismatch')
 return {'production_modules':len(modules),'source_records':len(registry['sources']),'pdfs_opened':0}
if __name__=='__main__':print(json.dumps(validate(Path(__file__).resolve().parents[1])))
