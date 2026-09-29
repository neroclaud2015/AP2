"""Immutable, source-bound shared-region proposals. No PDFs, promotion or answer inference."""
from copy import deepcopy
from pathlib import Path
from datetime import datetime,timezone
from ingest import read,save
from answers import artifact_digest,artifacts_valid
from portrait_dataset import objhash
from source_registry import load_registry,save_registry

def shared_revision(config,page,numbers,shared_id,version):
 result=deepcopy(config);pc=result['pages'][str(page)];wanted={f'{config["scope"]}-p{page}-{n}' for n in numbers}
 regions=[x for x in pc['explicit_regions'] if x['owner'] in wanted]
 if len(regions)!=len(numbers) or {x['owner'] for x in regions}!=wanted or len({tuple(x['bbox']) for x in regions})!=1:raise ValueError('Expected exactly one identical shared region per reviewed owner')
 if any(n not in config['expected'] for n in numbers):raise ValueError('Unknown question')
 shared={'page':page,'bbox':regions[0]['bbox'],'role':'shared_context','referenced_by':list(numbers),'evidence':[x['evidence'] for x in regions]}
 pc['explicit_regions']=[x for x in pc['explicit_regions'] if x not in regions]
 result['version']=version;result['shared_regions']={shared_id:shared}
 result['attachment_crops'].append({'page':page,'bbox':shared['bbox'],'role':'shared_context','shared_region_id':shared_id,'question_numbers':list(numbers),'evidence':'Explicit shared reference; requires manual source review before activation.'})
 for n in numbers:result['attachment_refs'][n]=list(dict.fromkeys(result['attachment_refs'].get(n,[])+[page]))
 result['manual_shared_review_required']=True
 return result

def immutable_save(path,value):
 if path.exists():
  if read(path)!=value:raise ValueError('Immutable proposal artifact already exists with different content')
 else:save(path,value)

def validate_confirmation(proposal,row):
 for key in ['proposal_hash','source_id','source_sha256','previous_profile_revision','new_profile_revision','config_sha256','evidence_hashes']:
  if row.get(key)!=proposal.get(key):raise ValueError('Confirmation evidence mismatch: '+key)
 if row.get('status')!='confirmed' or row.get('confirmation_method')!='manual_shared_region_review' or row.get('confirmed') is not True:raise ValueError('Explicit manual confirmation required')
 if row.get('references')!=proposal['references']:raise ValueError('Changed mapping needs a new reviewed proposal; cannot activate')
 try:stamp=datetime.fromisoformat(row['confirmed_at'].replace('Z','+00:00'))
 except (KeyError,TypeError,ValueError):raise ValueError('Confirmation timestamp required')
 if stamp.tzinfo is None:raise ValueError('Timezone required')
 return deepcopy(row)

def append_event(root,proposal,stage,evidence):
 registry=load_registry(root);source=next(x for x in registry['sources'] if x['source_id']==proposal['source_id'])
 if source['sha256']!=proposal['source_sha256'] or source['status']!='blocked':raise ValueError('Expected blocked source; never mutate production')
 event={'stage':stage,'proposal_hash':proposal['proposal_hash'],'previous_profile_revision':proposal['previous_profile_revision'],'new_profile_revision':proposal['new_profile_revision'],'supersedes_profile_revision':proposal['previous_profile_revision'],'change_reason':'manual_shared_region_review','evidence':evidence}
 existing=[e for e in source['events'] if e.get('stage')==stage and e.get('proposal_hash')==proposal['proposal_hash']]
 if existing:
  if any({k:v for k,v in e.items() if k!='at'}!=event for e in existing):raise ValueError('Conflicting immutable event')
  return 'skipped'
 source['events'].append({**event,'at':datetime.now(timezone.utc).isoformat()});save_registry(root,registry);return 'recorded'

def require_current_proposal(source,proposal):
 events=[e for e in source['events'] if e.get('stage')=='profile_revision_proposed']
 if not events or events[-1].get('proposal_hash')!=proposal['proposal_hash']:raise ValueError('Superseded proposal; review the latest revision')

def import_confirmation(root,proposal_path,confirmation_path):
 root=Path(root).resolve();proposal_path=Path(proposal_path).resolve();proposal=read(proposal_path)
 if objhash({k:v for k,v in proposal.items() if k!='proposal_hash'})!=proposal.get('proposal_hash'):raise ValueError('Proposal content hash mismatch')
 source=next(s for s in load_registry(root)['sources'] if s['source_id']==proposal['source_id']);require_current_proposal(source,proposal)
 event=[e for e in source['events'] if e.get('stage')=='profile_revision_proposed'][-1]
 if proposal_path.relative_to(root).as_posix()!=event['evidence']['proposal_path'] or artifact_digest(proposal_path)!=event['evidence']['sha256']:raise ValueError('Proposal differs from registered audit evidence')
 if not artifacts_valid(root,proposal['artifact_hashes']):raise ValueError('Proposal artifacts changed')
 row=validate_confirmation(proposal,read(confirmation_path))
 target=root/'data/reviews'/('shared-region-'+proposal['proposal_hash']+'.json');immutable_save(target,row)
 # Confirmation is appended; it does not erase blocked events or silently activate a parser.
 return append_event(root,proposal,'profile_revision_confirmed',{'confirmation':target.relative_to(root).as_posix(),'sha256':artifact_digest(target)})

if __name__=='__main__':
 import argparse
 p=argparse.ArgumentParser();p.add_argument('--proposal',required=True);p.add_argument('--confirmation',required=True);a=p.parse_args();root=Path(__file__).resolve().parents[1]
 print(import_confirmation(root,root/a.proposal,Path(a.confirmation)))
