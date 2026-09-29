"""Promote already validated registered modules; never opens or renders PDFs.

Usage: python scripts/promote_registered_modules.py layout.json [...]
Uncertain answers are rejected; this command cannot confirm machine candidates.
"""
from pathlib import Path
from ingest import read,save
from answers import artifact_digest,artifacts_valid
from source_registry import load_registry,save_registry,transition_source

def validated_bundle(root,layout_path):
 root=Path(root);c=read(layout_path);prefix=c['name'];scope=c['scope']
 lm=read(root/f'data/ingest/{scope}_registered_layout.json');am=read(root/f'data/ingest/{scope}_registered_answers.json')
 if not lm or not am or lm['status']!='formal_segmented' or am['status']!='validated':raise ValueError('Unresolved layout/official answer gate; no promotion')
 if not artifacts_valid(root,lm['artifacts']) or not artifacts_valid(root,am['artifacts']):raise ValueError('Accepted artifacts changed')
 q=read(root/f'public/data/{prefix}_segmented.json');a=read(root/f'public/data/{prefix}_answers.json');u=read(root/f'public/data/{prefix}_u_solutions.json')
 ids={r['question_number']:r['question_id'] for r in q['questions']};mc={n for n in c['expected'] if n.isdigit()};written=set(c['expected'])-mc
 if set(ids)!=set(c['expected']) or len(ids)!=len(q['questions']) or len(set(ids.values()))!=len(ids):raise ValueError('Question identities incomplete')
 if len(a['answers'])!=len(mc) or {str(r['question_number']) for r in a['answers']}!=mc:raise ValueError('MC coverage incomplete')
 if any(r['official_answer_status'] not in ('auto_ready','confirmed') or type(r['official_answer'])!=int or r['official_answer'] not in range(1,6) or r['question_id']!=ids[str(r['question_number'])] for r in a['answers']):raise ValueError('Unsafe official answer')
 if len(u['solutions'])!=len(written) or {r['question_number'] for r in u['solutions']}!=written or any(r['question_id']!=ids[r['question_number']] or r['source_hash']!=a['source_pdf_sha256'] for r in u['solutions']):raise ValueError('U identity/source incomplete')
 registry=load_registry(root)
 for sid,sha in [(c['source_id'],q['source_sha256']),(c['solution_source_id'],a['source_pdf_sha256'])]:
  source=next(s for s in registry['sources'] if s['source_id']==sid)
  if source['status'] not in ('validated','production') or source['sha256']!=sha:raise ValueError('Registry gate/source mismatch')
  if not all(artifacts_valid(root,g['artifacts']) for g in source['gates'].values()):raise ValueError('Registry evidence changed')
 return c,q,a,u

def ensure_timing_image(root,c,images,paths):
 """Publish an integrity-checked existing cache page when timing is not a question attachment."""
 key=str(c['timing_source_page'])
 if key in images:return
 import shutil
 from registered_ingest import cache_metadata
 cache=cache_metadata(root,c['source_hash']);page=cache['pages'][key]
 if not artifacts_valid(root,page['artifacts']):raise ValueError('Timing source cache changed')
 relative=f"assets/sources/{c['source_hash'][:24]}/timing-{key}.png"
 target=root/'public'/relative;target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists():
  if artifact_digest(target)!=artifact_digest(root/page['image']):raise ValueError('Published timing source changed')
 else:shutil.copyfile(root/page['image'],target)
 images[key]=relative;paths.append(target)

def promote(root,layout_path):
 root=Path(root);c,q,a,u=validated_bundle(root,layout_path);prefix=c['name'];ids=[r['question_id'] for r in q['questions']]
 paths=[root/f'public/data/{prefix}_{suffix}.json' for suffix in ['segmented','answers','u_solutions']]+[root/'public'/r['source_crop'] for r in a['answers']]+[root/'public'/r['cropped_solution_image'] for r in u['solutions']]
 images={str(r['page']):r['image'] for r in q['attachment_images']}
 ensure_timing_image(root,c,images,paths)
 proof={'result':'passed','artifacts':{p.relative_to(root).as_posix():artifact_digest(p) for p in paths},'artifact_hash_algorithm':'canonical-json-utf8-or-binary-sha256','question_ids':ids,'question_revision':q['segmentation_revision'],'official_answer_revision':a['parser_revision'],'official_solution_revision':u['extractor_revision'],'basis':'All cached pages/headings/ownership and final original question/solution crops inspected; unique deterministic official answers required.'}
 exam=c['exam'].replace('_','-');slug=c['module'].lower()
 config={'examId':exam,'slug':slug,'title':c['module'],'segmentedPath':f'data/{prefix}_segmented.json','answersPath':f'data/{prefix}_answers.json','solutionsPath':f'data/{prefix}_u_solutions.json','choiceSolutionPage':a['answers'][0]['source_page'],'descriptionPage':c['description_page'],'descriptionLabel':'Prüfungsaufgaben-Beschreibung','questionContextPages':{r['question_number']:[v['page'] for v in c['attachment_crops'] if r['question_number'] in v.get('question_numbers',[])] for r in q['questions']},'attachmentPages':[r['page'] for r in c['attachment_crops'] if r['page'] not in (c['timing_source_page'],c['description_page'])],'sourcePageImages':images,'durationMinutes':c.get('timing_minutes'),'durationSource':{'pdf':'','page':c['timing_source_page'],'image':images[str(c['timing_source_page'])]},'parts':[{'id':'A','title':'Teil A','kind':'multiple_choice','label':'Auswahlaufgaben','questionNumbers':[n for n in c['expected'] if n.isdigit()]},{'id':'B','title':'Teil B','kind':'multi_part','label':'Offene Aufgaben','questionNumbers':[n for n in c['expected'] if n.startswith('U')]}]}
 promoted=read(root/'public/data/promoted_modules.json',[]);prior=next((m for m in promoted if m['examId']==exam and m['slug']==slug),None)
 if prior and prior!=config:raise ValueError('Existing module registration is immutable')
 registry=load_registry(root)
 for sid in [c['source_id'],c['solution_source_id']]:
  s=next(s for s in registry['sources'] if s['source_id']==sid)
  if s['status']=='production':
   if s['gates']['production']['artifacts']!=proof['artifacts']:raise ValueError('Production artifacts changed')
  else:registry=transition_source(registry,sid,'production',{**proof,'source_sha256':s['sha256']})
 save_registry(root,registry)
 if not prior:promoted.append(config);save(root/'public/data/promoted_modules.json',promoted)
 return {'exam':exam,'module':slug,'questions':len(ids),'mc':len(a['answers']),'u':len(u['solutions']),'status':'production'}

if __name__=='__main__':
 import argparse,json
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('layouts',nargs='+');args=parser.parse_args();root=Path(__file__).resolve().parents[1]
 for path in args.layouts:print(json.dumps(promote(root,(root/path).resolve())))
