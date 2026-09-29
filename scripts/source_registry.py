"""Immutable source identities and append-only import gates. Never reads PDFs or user data."""
from pathlib import Path
from copy import deepcopy
from datetime import datetime,timezone
import hashlib,json,re
STAGES=('registered','hash_verified','profile_matched','layout_validated','preview_ready','formal_segmented','answers_extracted','validated','production')
TYPES=('question_pdf','solution_pdf')
def now():return datetime.now(timezone.utc).isoformat()
def empty_registry():return {'schema_version':1,'sources':[]}
def _source(registry,source_id):
 matches=[s for s in registry['sources'] if s['source_id']==source_id]
 if len(matches)!=1:raise ValueError('Unknown or duplicate source ID')
 return matches[0]
def _hash(value):return isinstance(value,str) and re.fullmatch('[0-9a-f]{64}',value) is not None
def register_source(registry,*,exam,module,source_type,filename,sha256,version=1,layout_profile=None,answer_profile=None,supersedes_source_id=None):
 if not all(isinstance(x,str) and x.strip() for x in (exam,module,filename)) or source_type not in TYPES or not _hash(sha256) or type(version)!=int or version<1:raise ValueError('Invalid source registration')
 same=[s for s in registry['sources'] if (s['exam'],s['module'],s['source_type'])==(exam,module,source_type)]
 identical=[s for s in same if s['sha256']==sha256]
 if identical:
  old=identical[0]
  if old['version']==version and old['filename']==filename and old['supersedes_source_id']==supersedes_source_id:return deepcopy(registry),old['source_id']
  raise ValueError('Source hash already registered; never create a replacement with the same hash')
 if same:
  old=_source(registry,supersedes_source_id)
  if old not in same or version!=max(s['version'] for s in same)+1 or old['version']!=max(s['version'] for s in same):raise ValueError('Replacement must supersede latest matching source with next version')
 elif supersedes_source_id or version!=1:raise ValueError('Initial source requires version1 without supersedes')
 sid='src-'+hashlib.sha256(f'{exam}|{module}|{source_type}|{sha256}|{version}'.encode()).hexdigest()[:24]
 result=deepcopy(registry);created=now();result['sources'].append({'source_id':sid,'exam':exam,'module':module,'source_type':source_type,'filename':filename,'sha256':sha256,'version':version,'status':'registered','layout_profile':layout_profile,'answer_profile':answer_profile,'supersedes_source_id':supersedes_source_id,'created_at':created,'identity_migration':None,'gates':{},'events':[{'stage':'registered','at':created}]})
 return result,sid

def bind_profiles(registry,source_id,*,layout_profile,answer_profile):
 result=deepcopy(registry);s=_source(result,source_id)
 if s['status'] not in ('registered','hash_verified') or not layout_profile or not answer_profile:raise ValueError('Bind profiles before profile match')
 s['layout_profile']=layout_profile;s['answer_profile']=answer_profile;return result

def _evidence(source,evidence):
 if evidence.get('source_sha256')!=source['sha256'] or evidence.get('result')!='passed' or not isinstance(evidence.get('artifacts'),dict) or not evidence['artifacts'] or any(not k or not _hash(v) for k,v in evidence['artifacts'].items()):raise ValueError('Gate requires matching source hash, passed result and hashed evidence artifacts')

def transition_source(registry,source_id,target,evidence):
 result=deepcopy(registry);s=_source(result,source_id)
 if target=='blocked':
  if not evidence.get('reason'):raise ValueError('Blocking reason required')
  if s['status']=='production':raise ValueError('Production provenance immutable; register replacement')
  s['blocked_after']=s['status'];s['status']='blocked';s['events'].append({'stage':'blocked','at':now(),'evidence':deepcopy(evidence)});return result
 if s['status'] not in STAGES or target not in STAGES or STAGES.index(target)!=STAGES.index(s['status'])+1:raise ValueError('Import stages cannot be skipped or replayed')
 _evidence(s,evidence)
 if STAGES.index(target)>=2 and (not s['layout_profile'] or not s['answer_profile']):raise ValueError('Exact layout and answer profile identities required')
 if target=='production' and s['supersedes_source_id']:_validate_identity_decision(result,s)
 s['status']=target;s['gates'][target]=deepcopy(evidence);s['events'].append({'stage':target,'at':now(),'evidence':deepcopy(evidence)});return result

def _dataset_binding(source,path_override=None):
 gate=source.get('gates',{}).get('validated',{});ids=gate.get('question_ids')
 if not isinstance(ids,list) or not ids or any(not isinstance(i,str) or not i for i in ids) or len(ids)!=len(set(ids)):raise ValueError('Validated full question identity set required')
 artifacts={p:h for p,h in gate.get('artifacts',{}).items() if p.endswith('_segmented.json')}
 if not artifacts or len(set(artifacts.values()))!=1:raise ValueError('Validated formal dataset hash required')
 path=path_override or sorted(artifacts,key=lambda p:(not p.startswith('public/'),p))[0]
 if not isinstance(path,str) or Path(path).is_absolute() or '..' in Path(path).parts:raise ValueError('Dataset evidence path must remain relative')
 return {'source_id':source['source_id'],'dataset_path':path,'dataset_sha256':next(iter(artifacts.values())),'question_ids':sorted(ids)}

def _identity_bindings(registry,source,evidence):
 old=_source(registry,source['supersedes_source_id'])
 return {'old':_dataset_binding(old,evidence.get('old_dataset_path')),'new':_dataset_binding(source,evidence.get('new_dataset_path'))}

def _validate_identity_decision(registry,source):
 decision=source.get('identity_migration')
 if not decision or decision.get('decision')!='preserve_ids':raise ValueError('Explicit identity decision required')
 evidence=decision['evidence'];bindings=_identity_bindings(registry,source,evidence)
 if decision.get('dataset_bindings')!=bindings:raise ValueError('Identity decision is not bound to validated datasets')
 old=evidence.get('old_question_ids',[]);new=evidence.get('new_question_ids',[])
 if len(old)!=len(set(old)) or len(new)!=len(set(new)) or set(old)!=set(bindings['old']['question_ids']) or set(new)!=set(bindings['new']['question_ids']) or set(old)!=set(new) or evidence.get('mapping')!={i:i for i in old} or not evidence.get('reviewed_by'):raise ValueError('Identity mapping must cover both complete validated datasets')
 return bindings

def validate_identity_artifacts(root,registry,source):
 """Verify archived old and current new formal JSON; no PDF or personal-data access."""
 if not source.get('supersedes_source_id'):return
 root=Path(root).resolve();bindings=_validate_identity_decision(registry,source)
 for binding in bindings.values():
  path=(root/binding['dataset_path']).resolve();path.relative_to(root)
  data=json.loads(path.read_text(encoding='utf-8-sig'))
  hashes={hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':'),ensure_ascii=ascii_mode).encode()).hexdigest() for ascii_mode in (True,False)}
  ids=[q['question_id'] for q in data['questions']]
  bound_source=_source(registry,binding['source_id'])
  if binding['dataset_sha256'] not in hashes or len(ids)!=len(set(ids)) or set(ids)!=set(binding['question_ids']) or data['exam'].replace('_','-')!=bound_source['exam'] or data['module'].lower()!=bound_source['module']:raise ValueError('Actual replacement dataset does not match validated identity evidence')
  if bound_source['source_type']=='question_pdf' and data['source_sha256']!=bound_source['sha256']:raise ValueError('Replacement dataset source hash mismatch')

def record_identity_decision(registry,source_id,decision,evidence):
 result=deepcopy(registry);s=_source(result,source_id)
 if not s['supersedes_source_id'] or s['status'] in ('production','blocked') or s['identity_migration']:raise ValueError('Identity decision applies once to an unpromoted replacement')
 if decision=='blocked':
  return transition_source(result,source_id,'blocked',evidence)
 old=evidence.get('old_question_ids',[]);new=evidence.get('new_question_ids',[]);mapping=evidence.get('mapping',{})
 if decision!='preserve_ids' or not old or len(old)!=len(set(old)) or len(new)!=len(set(new)) or set(old)!=set(new) or mapping!={i:i for i in old} or not evidence.get('reviewed_by'):raise ValueError('Unsafe or incomplete identity mapping; block rather than migrate')
 s['identity_migration']={'decision':decision,'evidence':deepcopy(evidence),'dataset_bindings':_identity_bindings(result,s,evidence),'at':now()}
 _validate_identity_decision(result,s);return result

def production_sources(registry,exam,module):
 result={}
 for kind in TYPES:
  sources=[s for s in registry['sources'] if s['exam']==exam and s['module']==module and s['source_type']==kind and s['status']=='production']
  if not sources:raise ValueError('Module sources are not production-validated')
  s=max(sources,key=lambda v:v['version'])
  if set(s['gates'])!=set(STAGES[1:]):raise ValueError('Incomplete production gates')
  for evidence in s['gates'].values():_evidence(s,evidence)
  if s['supersedes_source_id']:_validate_identity_decision(registry,s)
  result['question' if kind=='question_pdf' else 'solution']=deepcopy(s)
 return result

def require_registered_source(registry,source_id,sha256):
 s=_source(registry,source_id)
 if s['sha256']!=sha256 or s['status']=='blocked':raise ValueError('Unregistered or blocked source hash')
 return deepcopy(s)

def load_registry(root):
 p=Path(root)/'data/source_registry.json';return json.loads(p.read_text(encoding='utf-8-sig')) if p.exists() else empty_registry()
def validate_registry(registry):
 if registry.get('schema_version')!=1 or not isinstance(registry.get('sources'),list):raise ValueError('Invalid registry schema')
 ids=[s['source_id'] for s in registry['sources']]
 if len(ids)!=len(set(ids)):raise ValueError('Duplicate source ID')
 versions=set()
 for s in registry['sources']:
  fields=('source_id','exam','module','filename','created_at')
  if any(not isinstance(s.get(k),str) or not s[k] for k in fields) or not _hash(s.get('sha256')) or s.get('source_type') not in TYPES or type(s.get('version'))!=int or s['version']<1 or s['status'] not in (*STAGES,'blocked'):raise ValueError('Invalid source record')
  slot=(s['exam'],s['module'],s['source_type'],s['version'])
  if slot in versions:raise ValueError('Duplicate source version')
  versions.add(slot)
  stage=s.get('blocked_after') if s['status']=='blocked' else s['status']
  if stage not in STAGES:raise ValueError('Invalid blocked checkpoint')
  if set(s['gates'])!=set(STAGES[1:STAGES.index(stage)+1]):raise ValueError('Missing or skipped import gates')
  for evidence in s['gates'].values():_evidence(s,evidence)
  if STAGES.index(stage)>=2 and (not s['layout_profile'] or not s['answer_profile']):raise ValueError('Profile binding missing')
  if s['supersedes_source_id']:
   old=_source(registry,s['supersedes_source_id'])
   if (old['exam'],old['module'],old['source_type'])!=(s['exam'],s['module'],s['source_type']) or old['version']+1!=s['version'] or old['sha256']==s['sha256']:raise ValueError('Invalid supersedes chain')
   if s['status']=='production':_validate_identity_decision(registry,s)
  if s.get('profile_revision_of_source_id'):
   old=_source(registry,s['profile_revision_of_source_id'])
   if old['status']!='blocked' or 'formal_segmented' in old['gates'] or any(old[k]!=s[k] for k in ('exam','module','source_type','filename','sha256')) or s['version']<=old['version'] or s['supersedes_source_id']:raise ValueError('Invalid processing revision lineage')
   proof=s.get('profile_confirmation',{})
   if not any(e.get('stage')=='profile_revision_confirmed' and e.get('proposal_hash')==proof.get('proposal_hash') for e in old['events']):raise ValueError('Processing revision requires confirmed audit event')
 return registry

def save_registry(root,registry):
 from ingest import save
 validate_registry(registry);previous=load_registry(root)
 for source in registry['sources']:
  if source['status']=='production':validate_identity_artifacts(root,registry,source)
  if source.get('profile_revision_of_source_id'):
   if not any(s['source_id']==source['source_id'] for s in previous['sources']) and any((s['exam'],s['module'],s['source_type'])==(source['exam'],source['module'],source['source_type']) and 'formal_segmented' in s['gates'] for s in previous['sources']):raise ValueError('Formal dataset already exists; processing revision cannot bypass identity migration')
   from answers import artifact_digest,artifacts_valid
   from shared_region_review import validate_confirmation
   proof=source['profile_confirmation'];proposal_path=Path(root)/proof['proposal_path'];confirmation_path=Path(root)/proof['confirmation_path']
   if artifact_digest(proposal_path)!=proof['proposal_sha256'] or artifact_digest(confirmation_path)!=proof['confirmation_sha256']:raise ValueError('Profile revision proof changed')
   proposal=json.loads(proposal_path.read_text(encoding='utf-8-sig'));confirmation=json.loads(confirmation_path.read_text(encoding='utf-8-sig'))
   from portrait_dataset import objhash
   if proposal.get('proposal_hash')!=proof['proposal_hash'] or objhash({k:v for k,v in proposal.items() if k!='proposal_hash'})!=proof['proposal_hash']:raise ValueError('Profile proposal content hash mismatch')
   parent=_source(registry,source['profile_revision_of_source_id'])
   proposed=[e for e in parent['events'] if e.get('stage')=='profile_revision_proposed' and e.get('proposal_hash')==proof['proposal_hash']]
   confirmed=[e for e in parent['events'] if e.get('stage')=='profile_revision_confirmed' and e.get('proposal_hash')==proof['proposal_hash']]
   if len(proposed)!=1 or len(confirmed)!=1 or proposed[0]['evidence']!={'proposal_path':proof['proposal_path'],'sha256':proof['proposal_sha256']} or confirmed[0]['evidence']['sha256']!=proof['confirmation_sha256']:raise ValueError('Profile proof differs from append-only audit evidence')
   validate_confirmation(proposal,confirmation)
   if proposal['source_id']!=source['profile_revision_of_source_id'] or proposal['source_sha256']!=source['sha256'] or not artifacts_valid(root,proposal['artifact_hashes']):raise ValueError('Profile revision artifact mismatch')
   profile_gate=source['gates'].get('profile_matched')
   if profile_gate:
    approved=json.loads((Path(root)/proposal['config_path']).read_text(encoding='utf-8-sig'))
    bound=profile_gate['artifacts']
    if len(bound)!=1 or not artifacts_valid(root,bound):raise ValueError('Confirmed profile requires one intact bound config')
    actual=json.loads((Path(root)/next(iter(bound))).read_text(encoding='utf-8-sig'))
    expected={**approved,'source_id':source['source_id'],'confirmed_profile_revision':proposal['new_profile_revision'],'confirmation_proposal_hash':proposal['proposal_hash']}
    if actual!=expected:raise ValueError('Bound configuration differs from manually confirmed profile')
 for old in previous['sources']:
  current=_source(registry,old['source_id'])
  immutable=('source_id','exam','module','source_type','filename','sha256','version','supersedes_source_id','created_at')
  if any(current[k]!=old[k] for k in immutable) or any(current['gates'].get(k)!=v for k,v in old['gates'].items()) or current['events'][:len(old['events'])]!=old['events']:raise ValueError('Historical source identity/evidence cannot be overwritten')
  if old['identity_migration'] and current['identity_migration']!=old['identity_migration']:raise ValueError('Identity decision is immutable')
  if any(current.get(k)!=old.get(k) for k in ('profile_revision_of_source_id','profile_confirmation')):raise ValueError('Profile revision lineage is immutable')
  if old['status'] not in ('registered','hash_verified') and any(current[k]!=old[k] for k in ('layout_profile','answer_profile')):raise ValueError('Validated profiles cannot be changed')
  if old['status']=='production' and current!=old:raise ValueError('Production source is immutable; register replacement')
 # Metadata only. No bytes, credentials, user records or private cache contents.
 for base in ('data','public/data'):save(Path(root)/base/'source_registry.json',registry)
 return registry

def migrate_existing(root,registry=None):
 """Index accepted historical metadata; explicitly not a new extraction/validation run."""
 root=Path(root);registry=deepcopy(registry if registry is not None else load_registry(root))
 for season in ('2017_sommer','2017_18_winter'):
  for module in ('arbeitsplanung','funktionsanalyse','wiso'):
   prefix=f'{season}_{module}';paths={kind:f'public/data/{prefix}_{kind}.json' for kind in ('segmented','answers','u_solutions')}
   data={kind:json.loads((root/path).read_text(encoding='utf-8-sig')) for kind,path in paths.items()};q=data['segmented'];a=data['answers'];u=data['u_solutions']
   layout=q.get('profile_id','legacy-'+prefix)+'@'+q['segmentation_revision'];answer=a['parser_revision']
   solution_hash=a.get('source_pdf_sha256') or a.get('source_hash') or u['solutions'][0]['source_hash']
   for kind,sha,filename in [('question_pdf',q['source_sha256'],q['source_pdf']),('solution_pdf',solution_hash,q.get('solution_document',{}).get('original_filename') or q.get('solution_document',{}).get('file') or u['solutions'][0]['solution_source_pdf'])]:
    registry,sid=register_source(registry,exam=season.replace('_','-'),module=module,source_type=kind,filename=filename,sha256=sha,layout_profile=layout,answer_profile=answer)
    if _source(registry,sid)['status']=='production':continue
    artifacts={path:hashlib.sha256(json.dumps(data[k],sort_keys=True,separators=(',',':')).encode()).hexdigest() for k,path in paths.items()}
    evidence={'source_sha256':sha,'result':'passed','artifacts':artifacts,'basis':'existing_accepted_production_metadata_migration','note':'Indexes previously accepted pipeline completion; no source scanning or new extraction performed.','question_revision':q['segmentation_revision'],'official_answer_revision':answer,'question_ids':[x['question_id'] for x in q['questions']]}
    for stage in STAGES[1:]:registry=transition_source(registry,sid,stage,evidence)
 return registry

def register_sommer2018(root):
 registry=migrate_existing(root);hashes={'arbeitsplanung':('Arbeitsplanung','b5d74254038ebdd349fa6a8a29ed15bec4dcb1443aab649f6d1a60b043a84d37'),'funktionsanalyse':('Funktionsanalyse','ac636fb150c05709efb9fb3f683c34795094c7f35b50fd33d1c67ae22c8ccd16'),'wiso':('WiSo','d70911bd62cdd7a47a13c1eeff19cb78568783527bebd2d2f3c95604de899570')}
 for module,(title,sha) in hashes.items():
  for kind,filename,h in [('question_pdf',f'2018 Sommer/18 {title}.pdf',sha),('solution_pdf','2018 Sommer/18 Lösung.pdf','bd8bef30b55fa7ca61e8500500eb6a27f595bdc6924201d8643796ffc9ce4f36')]:registry,_=register_source(registry,exam='2018-sommer',module=module,source_type=kind,filename=filename,sha256=h)
 return save_registry(root,registry)
if __name__=='__main__':
 registry=register_sommer2018(Path(__file__).resolve().parents[1]);print(json.dumps([{k:s[k] for k in ('source_id','exam','module','source_type','status')} for s in registry['sources']],indent=2))
