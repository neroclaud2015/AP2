"""Narrow audited changes for the two explicitly confirmed 2024 mappings."""
from copy import deepcopy
from pathlib import Path
from ingest import read
from answers import artifact_digest,artifacts_valid
from portrait_dataset import objhash
from attachment_bounds_review import config_hash
EXPORT='data/reviews/overnight-user-export-2026-09-30-2.json'
RESOLUTION='data/reviews/2024-attachment-mapping-resolution.json'
IDS={'summer':'sommer2024-fa-attachment-ownership','winter':'winter2024-25-fa-unresolved-pages25-26'}

def decision(root,key):
 payload=read(Path(root)/EXPORT);items=read(Path(root)/'data/reviews/overnight-queue-before-second-export.json')['items']
 rows=[r for r in payload['mapping_decisions'] if r['id']==IDS[key]];qs=[q for q in items if q['id']==IDS[key]]
 if len(rows)!=1 or len(qs)!=1:raise ValueError('Expected unique reviewed decision')
 row,q=rows[0],qs[0]
 if row['decision']!='confirmed' or row['evidence_hash']!=q['evidence_hash']:raise ValueError('Stale or unconfirmed mapping')
 return row,q

def summer_config(root,c):
 resolution=read(Path(root)/RESOLUTION,{})
 if c['scope']!='2024-fa' or not resolution:return c,[]
 if not artifacts_valid(root,resolution['artifacts']):raise ValueError('Mapping proof changed')
 row=next(r for r in read(Path(root)/EXPORT)['mapping_decisions'] if r['id']==IDS['summer'])
 if resolution['decision']!=row or resolution['original_config_sha256']!=config_hash(c):raise ValueError('Mapping source binding changed')
 revised=deepcopy(c)
 for a in revised['external_attachments']:
  if a['question_numbers']!=['25','U3']:raise ValueError('Unexpected owners')
  a['question_numbers']=['U3']
 return revised,[Path(root)/RESOLUTION,Path(root)/EXPORT]

def winter_config(old):
 new=deepcopy(old);new.update(scope='2024-25-fa-mapping-v2',version='mapping-review.2.0',name=old['name']+'_mapping_v2')
 for p in new['pages'].values():
  for r in p.get('explicit_regions',[]):r['owner']=r['owner'].replace(old['scope']+'-',new['scope']+'-',1)
 new['attachment_crops']=[a for a in new['attachment_crops'] if a['page'] not in (25,26)]
 for a in new['attachment_crops']:
  w,h=new['pages'][str(a['page'])]['geometry'];b=a['bbox'];a['bbox']=[max(0,b[0]),max(0,b[1]),min(w,b[2]),min(h,b[3])]
 for n,ps in list(new['attachment_refs'].items()):
  ps=[p for p in ps if p not in (25,26)]
  if ps:new['attachment_refs'][n]=ps
  else:del new['attachment_refs'][n]
 return new

def validate_winter_proposal(p):
 if p['corrected_config']!=winter_config(p['previous_config']):raise ValueError('Changes exceed reviewed mapping')
 if config_hash(p['previous_config'])!=p['previous_config_sha256'] or config_hash(p['corrected_config'])!=p['config_sha256']:raise ValueError('Config hash mismatch')
 if p['decision']['id']!=IDS['winter'] or p['decision']['decision']!='confirmed' or p['decision']['evidence_hash']!=p['review_item']['evidence_hash']:raise ValueError('Review binding mismatch')
 if p['references']!={'U2':[23,24],'excluded_pages':[25,26]}:raise ValueError('Unexpected mapping')

def apply_summer(root):
 from shared_region_review import immutable_save
 from manual_answer_promotion import apply
 root=Path(root);row,item=decision(root,'summer');path=root/'scripts/layout_profiles/sommer2024_fa.json'
 immutable_save(root/RESOLUTION,{'schema_version':1,'decision':row,'review_item':item,'original_config_sha256':artifact_digest(path),'resolved_hold':{'scope':'sommer-2024','module':'funktionsanalyse'},'mapping':{'owners':['U3'],'removed':['25']},'artifacts':{EXPORT:artifact_digest(root/EXPORT),path.relative_to(root).as_posix():artifact_digest(path)}})
 return apply(root,{'schema_version':1,'scope':'sommer-2024','confirmations':[]})

def apply_winter(root):
 from shared_region_review import immutable_save,append_event
 from profile_revision_source import resume_confirmed_profile
 from source_registry import load_registry,save_registry,transition_source
 from registered_ingest import run_layout,run_answers
 root=Path(root);row,item=decision(root,'winter');oldpath=root/'scripts/layout_profiles/winter2024_25_fa.json';old=read(oldpath);new=winter_config(old)
 base=root/'data/reviews/winter2024-fa-mapping-v2';base.mkdir(parents=True,exist_ok=True);cp=base/'approved-config.json';immutable_save(cp,new)
 source=next(s for s in load_registry(root)['sources'] if s['source_id']==old['source_id'])
 p={'schema_version':1,'source_id':old['source_id'],'source_sha256':old['source_hash'],'previous_profile_revision':source['layout_profile'],'new_profile_revision':'mapping-review.2.0-'+objhash(new)[:12],'confirmation_method':'manual_2024_attachment_mapping_review','config_path':cp.relative_to(root).as_posix(),'config_sha256':artifact_digest(cp),'previous_config':old,'previous_config_sha256':artifact_digest(oldpath),'corrected_config':new,'decision':row,'review_item':item,'references':{'U2':[23,24],'excluded_pages':[25,26]},'evidence_hashes':{'review_item':item['evidence_hash']},'artifact_hashes':{p.relative_to(root).as_posix():artifact_digest(p) for p in [oldpath,cp,root/EXPORT]}}
 p['proposal_hash']=objhash(p);pp=base/'proposal.json';immutable_save(pp,p)
 confirm={k:p[k] for k in ['proposal_hash','source_id','source_sha256','previous_profile_revision','new_profile_revision','config_sha256','evidence_hashes','references','confirmation_method']};confirm.update(status='confirmed',confirmed=True,confirmed_at=row['updated_at']);fp=base/'confirmation.json';immutable_save(fp,confirm)
 append_event(root,p,'profile_revision_proposed',{'proposal_path':pp.relative_to(root).as_posix(),'sha256':artifact_digest(pp)})
 sid=resume_confirmed_profile(root,pp,fp);registry=load_registry(root);s=next(s for s in registry['sources'] if s['source_id']==sid)
 if s['status']=='registered':save_registry(root,transition_source(registry,sid,'hash_verified',deepcopy(source['gates']['hash_verified'])))
 bound={**new,'source_id':sid,'confirmed_profile_revision':p['new_profile_revision'],'confirmation_proposal_hash':p['proposal_hash']};lp=root/'scripts/layout_profiles/winter2024_25_fa_mapping_v2.json';immutable_save(lp,bound)
 official=read(root/'scripts/layout_profiles/winter2024_25_fa_official.json');official.update(scope=new['scope'],name=new['name'],question_source_id=sid);ap=root/'scripts/layout_profiles/winter2024_25_fa_mapping_v2_official.json';immutable_save(ap,official)
 layout=run_layout(root,lp,promote=True);answers=run_answers(root,lp,ap)
 state=read(root/f'data/ingest/{new["scope"]}_registered_answers.json')
 if state['status']=='validated':
  from promote_registered_modules import promote
  return promote(root,lp)
 from ingest import save
 from manual_review_queue import queue
 scope='winter-2024-25-fa-mapping-v2';numbers=[a['question_number'] for a in read(root/f'public/data/{new["name"]}_answers.json')['answers'] if a['official_answer'] is None]
 q=queue(root,scope=scope,targets={'funktionsanalyse':numbers},exam=old['exam'],prefixes={'funktionsanalyse':new['name']})
 save(root/'public/data/manual_answer_review_winter2024_25_fa_mapping_v2.json',q)
 scopes=read(root/'data/ingest/overnight_manual_scopes.json')
 config={'scope':scope,'targets':{'funktionsanalyse':numbers},'exam':old['exam'],'stamp':'2024-25','profile':'winter2024_25','layout_paths':{'funktionsanalyse':lp.relative_to(root).as_posix()},'queue':'manual_answer_review_winter2024_25_fa_mapping_v2.json','ledger':'winter-2024-25-fa-mapping-v2-confirmations.json','manifest':'winter-2024-25-fa-mapping-v2-manual-promotion.json'}
 previous=next((s for s in scopes if s['scope']==scope),None)
 if previous and previous!=config:raise ValueError('Review scope changed')
 if not previous:scopes.append(config);save(root/'data/ingest/overnight_manual_scopes.json',scopes)
 return {'layout':layout,'answers':answers,'layout_path':str(lp),'review_count':len(numbers)}
