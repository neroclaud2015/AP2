"""Scoped, source-bound manual gate resolution. No PDF/cache extraction or credentials.
Run: python scripts/manual_answer_promotion.py CONFIRMATIONS.json [--apply]
Default is dry-run. --apply registers each complete module, leaving others blocked.
"""
from pathlib import Path
from copy import deepcopy
from datetime import datetime,timezone
import argparse,json,hashlib
from ingest import read,save
from answers import artifact_digest,artifacts_valid
from portrait_dataset import objhash
from manual_review_queue import TARGETS,SCOPE
from source_registry import load_registry,save_registry,transition_source
MODULE_CODES={'arbeitsplanung':'ap','funktionsanalyse':'fa','wiso':'wiso'}
FIELDS=['question_id','question_number','exam','module','parser_revision','source_pdf_sha256','source_crop','source_crop_sha256','evidence_hash']

def merge_confirmed(machine,manual):
 if machine['question_id']!=manual['question_id']:raise ValueError('Question identity mismatch')
 return {**deepcopy(machine),'official_answer':manual['official_answer'],'official_answer_status':'confirmed','user_corrected':True,'locked':True,'confirmation_method':'manual_source_review','confirmed_at':manual['updated_at'],'manual_source_evidence':deepcopy(manual),'machine_official_answer':machine['official_answer'],'machine_official_answer_status':machine['official_answer_status'],'machine_suggestion_changed':machine['parser_revision']!=manual['parser_revision'] or objhash({k:v for k,v in machine.items() if k not in ['source_crop_sha256','evidence_hash','overlay','row_positions']})!=manual['evidence_hash']}

def validate_confirmation(row,queue):
 if not isinstance(row,dict) or row.get('question_id') not in queue:raise ValueError('Unknown question')
 q=queue[row['question_id']]
 if any(row.get(k)!=q[k] for k in FIELDS):raise ValueError('Stale or different source evidence binding')
 if type(row.get('official_answer')) is not int or row['official_answer'] not in range(1,6) or row.get('official_answer_status')!='confirmed' or row.get('user_corrected') is not True or row.get('locked') is not True or row.get('confirmation_method')!='manual_source_review':raise ValueError('Explicit locked manual 1-5 confirmation required')
 try:
  date=datetime.fromisoformat(row['updated_at'].replace('Z','+00:00'))
  if date.tzinfo is None:raise ValueError()
 except (ValueError,KeyError,TypeError,AttributeError):raise ValueError('Confirmation timestamp required')
 if row.get('machine_answer_at_confirmation')!=q['official_answer']:raise ValueError('Machine snapshot mismatch')
 # Only public review metadata is retained. Never accept user profile or learning history.
 return {k:row[k] for k in FIELDS+['official_answer','official_answer_status','user_corrected','locked','confirmation_method','updated_at','machine_answer_at_confirmation']}

def scope_settings(payload):
 if payload.get('scope')==SCOPE:
  return dict(scope=SCOPE,targets=TARGETS,exam='2018_19_winter',stamp='2018-19',profile='winter2018_19',queue='manual_answer_review_queue.json',ledger='official_answer_confirmations.json',manifest='manual_answer_promotion_manifest.json')
 if payload.get('scope')=='winter-2019-20':
  return dict(scope='winter-2019-20',targets={'funktionsanalyse':[21]},exam='2019_20_winter',stamp='2019-20',profile='winter2019_20',queue='manual_answer_review_winter2019_20.json',ledger='winter-2019-20-confirmations.json',manifest='winter-2019-20-manual-promotion.json')
 if payload.get('scope')=='sommer-2021':
  return dict(scope='sommer-2021',targets={'funktionsanalyse':[4,23],'wiso':[18]},exam='2021_sommer',stamp='2021',profile='sommer2021',queue='manual_answer_review_sommer2021.json',ledger='sommer-2021-confirmations.json',manifest='sommer-2021-manual-promotion.json')
 if payload.get('scope')=='winter-2021-22':
  return dict(scope='winter-2021-22',targets={'funktionsanalyse':[23,24,26]},exam='2021_22_winter',stamp='2021-22',profile='winter2021_22',layout_paths={'funktionsanalyse':'scripts/layout_profiles/winter2021_22_fa_confirmed.json'},queue='manual_answer_review_winter2021_22.json',ledger='winter-2021-22-confirmations.json',manifest='winter-2021-22-manual-promotion.json')
 raise ValueError('Unknown manual review scope')

def prepare(root,payload,existing=None):
 root=Path(root)
 if not isinstance(payload,dict):raise ValueError('Invalid export')
 settings=scope_settings(payload);targets=settings['targets']
 if not isinstance(payload,dict) or payload.get('schema_version')!=1 or payload.get('scope')!=settings['scope'] or not isinstance(payload.get('confirmations'),list):raise ValueError('Invalid scoped confirmation export')
 qdata=read(root/'public/data'/settings['queue']);queue={q['question_id']:q for q in qdata['items']}
 if len(queue)!=sum(len(ns) for ns in targets.values()) or {(q['module'].lower(),q['question_number']) for q in queue.values()}!={(m,n) for m,ns in targets.items() for n in ns}:raise ValueError('Review queue identity mismatch')
 ledger=deepcopy(existing if existing is not None else read(root/'data/reviews'/settings['ledger'],{}).get('confirmations',{}));seen=set()
 for row in payload['confirmations']:
  r=validate_confirmation(row,queue);qid=r['question_id']
  if qid in seen:raise ValueError('Duplicate confirmation')
  seen.add(qid)
  if qid in ledger:
   if {k:v for k,v in ledger[qid].items() if k!='updated_at'}!={k:v for k,v in r.items() if k!='updated_at'}:raise ValueError('Existing manual confirmation is locked; cannot overwrite')
  else:ledger[qid]=r
 for qid,row in ledger.items():
  if qid!=row.get('question_id'):raise ValueError('Ledger identity mismatch')
  validate_confirmation(row,queue)
 registry=load_registry(root);ready={};pending={}
 for module in targets:
  code=MODULE_CODES[module]
  config=read(root/settings.get('layout_paths',{}).get(module,f'scripts/layout_profiles/{settings["profile"]}_{code}.json'));prefix=f'{settings["exam"]}_{module}'
  state=read(root/f'data/ingest/{config["scope"]}_registered_answers.json');layout=read(root/f'data/ingest/{config["scope"]}_registered_layout.json')
  if not state or state['status']!='blocked' or not layout or layout['status']!='formal_segmented' or not artifacts_valid(root,state['artifacts']) or not artifacts_valid(root,layout['artifacts']):raise ValueError('Immutable machine/layout evidence changed or missing')
  questions=read(root/f'public/data/{prefix}_segmented.json');machine=read(root/f'public/data/{prefix}_answers.json');solutions=read(root/f'public/data/{prefix}_u_solutions.json')
  ids={q['question_number']:q['question_id'] for q in questions['questions']};expected=set(config['expected']);mc={int(n) for n in expected if n.isdigit()};written={n for n in expected if n.startswith('U')}
  if len(questions['questions'])!=len(expected) or set(ids)!=expected or len(set(ids.values()))!=len(expected):raise ValueError('Question identity coverage invalid')
  if len(machine['answers'])!=len(mc) or {a['question_number'] for a in machine['answers']}!=mc or any(a['question_id']!=ids[str(a['question_number'])] for a in machine['answers']):raise ValueError('MC identity coverage invalid')
  if len(solutions['solutions'])!=len(written) or {u['question_number'] for u in solutions['solutions']}!=written or any(u['question_id']!=ids[u['question_number']] or not (root/'public'/u['cropped_solution_image']).is_file() for u in solutions['solutions']):raise ValueError('U source coverage invalid')
  result=deepcopy(machine);unresolved=[]
  for i,a in enumerate(machine['answers']):
   qid=a['question_id']
   if a['question_number'] in targets[module]:
    q=queue.get(qid)
    if not q or any(q.get(k)!=a[k] for k in FIELDS if k not in ['source_crop_sha256','evidence_hash']) or objhash(a)!=q['evidence_hash'] or artifact_digest(root/'public'/a['source_crop'])!=q['source_crop_sha256']:raise ValueError('Original crop or measurements differ from review queue')
    if qid not in ledger:unresolved.append(a['question_number']);continue
    result['answers'][i]=merge_confirmed(a,ledger[qid])
   elif a['official_answer_status']!='auto_ready' or type(a['official_answer']) is not int or a['official_answer'] not in range(1,6):raise ValueError('Unexpected unresolved machine answer outside scoped review')
  pending[module]=unresolved
  if unresolved:continue
  for sid in [config['source_id'],config['solution_source_id']]:
   source=next(s for s in registry['sources'] if s['source_id']==sid)
   if source['status']=='production':continue
   if not (source['status']=='answers_extracted' or (source['status']=='blocked' and source.get('blocked_after')=='answers_extracted')):raise ValueError('Only the official-answer safety gate may be resolved')
   for gate in source['gates'].values():
    if not artifacts_valid(root,gate['artifacts']):raise ValueError('Source gate evidence changed')
  revision='manual-source-review-'+objhash({qid:r for qid,r in ledger.items() if qid in ids.values()})[:16]
  for answer in result['answers']:
   if answer.get('confirmation_method')=='manual_source_review':answer.update(original_parser_revision=answer['parser_revision'],parser_revision=revision)
  result.update(parser_revision=revision,original_parser_revision=machine['parser_revision'],manual_confirmation_revision=revision,completeness={'expected':len(mc),'records':len(mc),'unique_complete':True,'problems':[]})
  ready[module]={'answers':result,'questions':questions,'solutions':solutions,'config':config,'revision':revision}
 return {'confirmations':ledger,'ready':ready,'pending':pending,'pdf_pages_opened':0,'settings':settings}

def module_config(plan,root=None):
 c=plan['config'];q=plan['questions'];images={str(a['page']):a['image'] for a in q['attachment_images']};prefix=c['name']
 if root is not None:
  from promote_registered_modules import ensure_timing_image
  ensure_timing_image(root,c,images,[])
 return {'examId':c['exam'].replace('_','-'),'slug':c['module'].lower(),'title':c['module'],'segmentedPath':f'data/{prefix}_segmented.json','answersPath':f'data/{prefix}_reviewed_answers.json','solutionsPath':f'data/{prefix}_u_solutions.json','choiceSolutionPage':plan['answers']['answers'][0]['source_page'],'descriptionPage':c['description_page'],'questionContextPages':{n:[a['page'] for a in c['attachment_crops'] if n in a.get('question_numbers',[])] for n in c['expected']},'attachmentPages':[a['page'] for a in c['attachment_crops'] if a['page'] not in [c['timing_source_page'],c['description_page']]],'sourcePageImages':images,'durationMinutes':c['timing_minutes'],'durationSource':{'pdf':'','page':c['timing_source_page'],'image':images[str(c['timing_source_page'])]},'parts':[{'id':'A','title':'Teil A','kind':'multiple_choice','label':'Auswahlaufgaben','questionNumbers':[n for n in c['expected'] if n.isdigit()]},{'id':'B','title':'Teil B','kind':'multi_part','label':'Offene Aufgaben','questionNumbers':[n for n in c['expected'] if n.startswith('U')]}]}

def apply(root,payload):
 root=Path(root);plan=prepare(root,payload);settings=plan['settings'];registry=load_registry(root);promoted=read(root/'public/data/promoted_modules.json',[]);writes={root/'data/reviews'/settings['ledger']:{'schema_version':1,'scope':settings['scope'],'confirmations':plan['confirmations']}};now=datetime.now(timezone.utc).isoformat()
 for module,p in plan['ready'].items():
  prefix=f'{settings["exam"]}_{module}';c=p['config'];pair=[s for s in registry['sources'] if s['source_id'] in [c['source_id'],c['solution_source_id']]]
  if all(s['status']=='production' for s in pair):
   current=read(root/f'public/data/{prefix}_reviewed_answers.json')
   if current!=p['answers']:raise ValueError('Published manual answers are immutable')
   continue
  paths=[f'public/data/{prefix}_segmented.json',f'public/data/{prefix}_reviewed_answers.json',f'public/data/{prefix}_u_solutions.json']
  for base in ['data/exams','public/data']:writes[root/f'{base}/{prefix}_reviewed_answers.json']=p['answers']
  artifacts={paths[0]:artifact_digest(root/paths[0]),paths[1]:hashlib.sha256(json.dumps(p['answers'],sort_keys=True,separators=(',',':'),ensure_ascii=False).encode('utf-8')).hexdigest(),paths[2]:artifact_digest(root/paths[2])}
  audit={'result':'passed','confirmation_method':'manual_source_review','manual_confirmation_revision':p['revision'],'question_ids':[q['question_id'] for q in p['questions']['questions']],'question_revision':p['questions']['segmentation_revision'],'official_answer_revision':p['revision'],'artifacts':artifacts,'choice_coverage':len(p['answers']['answers']),'u_coverage':len(p['solutions']['solutions'])}
  for sid in [c['source_id'],c['solution_source_id']]:
   source=next(s for s in registry['sources'] if s['source_id']==sid)
   # Append an explicit resolution event; keep every previous blocked event/gate.
   source['status']='answers_extracted';source['events'].append({'stage':'manual_source_review_resolved','at':now,'evidence':{'confirmation_revision':p['revision'],'question_ids':[r['question_id'] for r in plan['confirmations'].values() if r['module'].lower()==module]}})
   evidence={**audit,'source_sha256':source['sha256']}
   registry=transition_source(registry,source['source_id'],'validated',evidence);registry=transition_source(registry,source['source_id'],'production',evidence)
  cfg=module_config(p,root);promoted=[m for m in promoted if (m['examId'],m['slug'])!=(cfg['examId'],cfg['slug'])]+[cfg]
 writes[root/'public/data/promoted_modules.json']=promoted
 checkpoint=read(root/'data/ingest'/settings['manifest'],{'schema_version':1,'scope':settings['scope'],'modules':{}})
 for module in settings['targets']:
  checkpoint['modules'][module]={'status':'production' if module in plan['ready'] else 'awaiting_manual_review','missing_question_numbers':plan['pending'][module],'manual_confirmation_revision':plan['ready'][module]['revision'] if module in plan['ready'] else None,'pdf_pages_opened':0}
 writes[root/'data/ingest'/settings['manifest']]=checkpoint
 # No writes before all inputs and modules validate; registry written last.
 backups={p:p.read_bytes() if p.exists() else None for p in list(writes)+[root/'data/source_registry.json',root/'public/data/source_registry.json']}
 try:
  for path,value in writes.items():
   if not path.exists() or read(path)!=value:save(path,value)
  save_registry(root,registry)
 except BaseException:
  for path,content in backups.items():
   if content is None:path.unlink(missing_ok=True)
   else:path.write_bytes(content)
  raise
 return {'ready':list(plan['ready']),'pending':plan['pending'],'pdf_pages_opened':0}
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('confirmations',type=Path);parser.add_argument('--apply',action='store_true');args=parser.parse_args();root=Path(__file__).resolve().parents[1];payload=read(args.confirmations)
 result=apply(root,payload) if args.apply else prepare(root,payload)
 print(json.dumps({k:list(v) if k=='ready' and isinstance(v,dict) else v for k,v in result.items() if k!='confirmations'},indent=2))
