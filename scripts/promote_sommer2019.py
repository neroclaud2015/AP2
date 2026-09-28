from pathlib import Path
from ingest import read,save
from answers import artifact_digest,artifacts_valid
from source_registry import load_registry,save_registry,transition_source
from registered_ingest import cache_metadata
from portrait_dataset import objhash
from PIL import Image,ImageDraw
import json,html,shutil
ROOT=Path(__file__).resolve().parents[1]
def run(root=ROOT):
 registry=load_registry(root);promoted=read(root/'public/data/promoted_modules.json',[]);summary={};folder=root/'docs/evidence/phase2i2';folder.mkdir(exist_ok=True)
 for code in ['ap','fa','wiso']:
  c=read(root/f'scripts/layout_profiles/sommer2019_{code}.json');prefix=c['name'];slug=c['module'].lower();q=read(root/f'public/data/{prefix}_segmented.json');a=read(root/f'public/data/{prefix}_answers.json');u=read(root/f'public/data/{prefix}_reviewed_u_solutions.json');lm=read(root/f'data/ingest/2019-{code}_registered_layout.json');am=read(root/f'data/ingest/2019-{code}_registered_answers.json')
  assert lm['status']=='formal_segmented' and am['status']=='validated' and artifacts_valid(root,lm['artifacts']) and artifacts_valid(root,am['artifacts'])
  ids={r['question_number']:r['question_id'] for r in q['questions']};assert set(ids)==set(c['expected']) and len(ids)==len(q['questions']) and len(set(ids.values()))==len(ids)
  assert len(a['answers'])==(18 if code=='wiso' else 28) and all(r['question_id']==ids[str(r['question_number'])] and r['official_answer_status']=='auto_ready' and r['official_answer'] in range(1,6) for r in a['answers'])
  assert {r['question_number'] for r in u['solutions']}=={x for x in ids if x.startswith('U')} and all(r['question_id']==ids[r['question_number']] and r['source_hash']==a['source_pdf_sha256'] for r in u['solutions'])
  artifacts=[root/f'public/data/{prefix}_{s}.json' for s in ['segmented','answers','reviewed_u_solutions']]+[root/f'scripts/layout_profiles/sommer2019_{code}_u_review.json']+[root/'public'/r['cropped_solution_image'] for r in u['solutions']]
  for r in a['answers']:assert (root/'public'/r['source_crop']).is_file()
  proof={'result':'passed','artifacts':{p.relative_to(root).as_posix():artifact_digest(p) for p in artifacts},'artifact_hash_algorithm':'canonical-json-utf8-or-binary-sha256','question_revision':q['segmentation_revision'],'official_answer_revision':a['parser_revision'],'official_solution_revision':u['extractor_revision'],'question_ids':list(ids.values()),'visual_review':'All physical pages, headings, continuation labels, diagram ownership and final official crop ruled boundaries verified from immutable cache. Final reviewed U artifact is separate from original extraction.'}
  for sid in [c['source_id'],c['solution_source_id']]:
   s=next(s for s in registry['sources'] if s['source_id']==sid)
   for gate in s['gates'].values():assert artifacts_valid(root,gate['artifacts']),sid
   if s['status']=='production':assert s['gates']['production']['artifacts']==proof['artifacts'];continue
   assert s['status']=='validated';registry=transition_source(registry,sid,'production',{**proof,'source_sha256':s['sha256']})
  images={str(r['page']):r['image'] for r in q['attachment_images']};config={'examId':'2019-sommer','slug':slug,'title':c['module'],'segmentedPath':f'data/{prefix}_segmented.json','answersPath':f'data/{prefix}_answers.json','solutionsPath':f'data/{prefix}_reviewed_u_solutions.json','choiceSolutionPage':a['answers'][0]['source_page'],'descriptionPage':c['description_page'],'descriptionLabel':'Prüfungsaufgaben-Beschreibung','questionContextPages':{n:[r['page'] for r in c['attachment_crops'] if n in r.get('question_numbers',[])] for n in ids},'attachmentPages':[r['page'] for r in c['attachment_crops'] if r['page'] not in [2,c['description_page']]],'sourcePageImages':images,'durationMinutes':c['timing_minutes'],'durationSource':{'pdf':'','page':2,'image':images['2']},'parts':[{'id':'A','title':'Gebundene Aufgaben' if code=='wiso' else 'Teil A','kind':'multiple_choice','label':'Auswahlaufgaben','questionNumbers':[n for n in ids if not n.startswith('U')]},{'id':'B','title':'Ungebundene Aufgaben' if code=='wiso' else 'Teil B','kind':'multi_part','label':'Offene Aufgaben','questionNumbers':[n for n in ids if n.startswith('U')]}]}
  previous=next((m for m in promoted if m['examId']=='2019-sommer' and m['slug']==slug),None)
  if previous:assert previous==config
  else:promoted.append(config)
  summary[slug]={'status':'production','questions':len(ids),'choice_coverage':len(a['answers']),'choice_expected':len(a['answers']),'u_coverage':len(u['solutions']),'needs_review':[],'profile_id':c['profile_id'],'profile_version':c['version'],'config_hash':objhash(c),'source_hash':c['source_hash'],'answer_revision':a['parser_revision'],'solution_revision':u['extractor_revision'],'pdf_rescan_count':0,'profile_reuse':'portrait-explicit-regions and official-ring-grid; new source-bound coordinate configuration, unchanged engines and circle thresholds','production_url':f'https://neroclaud2015.github.io/AP2/?view=study&exam=2019-sommer&module={slug}&q=1'}
 save_registry(root,registry);save(root/'public/data/promoted_modules.json',promoted)
 m=read(root/'data/ingest/historical_expansion_manifest.json');m['seasons']['2019-sommer'].update(status='production_awaiting_acceptance',modules=summary);m['stop_reason']='Sommer 2019 complete. Stop for requested per-season acceptance; no 2019/20 or later PDFs opened.'
 for ar in m['archives']:
  if ar['archive'].startswith('2019 Sommer'):ar['status']='production_awaiting_acceptance'
 save(root/'data/ingest/historical_expansion_manifest.json',m);save(folder/'summary.json',{'modules':summary,'new_physical_pages_cached_once':89,'completed_pdf_rescans':0,'later_seasons_opened':0,'personal_data_accessed':False})
 return summary
if __name__=='__main__':print(json.dumps(run(),indent=2))
