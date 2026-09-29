"""Append a new processing identity for a confirmed, never-published source revision.

The PDF identity is unchanged. The blocked record and all its gates remain intact.
This is deliberately unavailable for sources with formal or production datasets.
"""
from copy import deepcopy
import hashlib
from pathlib import Path
from source_registry import load_registry, save_registry, now
from shared_region_review import import_confirmation
from ingest import read
from answers import artifact_digest, artifacts_valid

def resume_confirmed_profile(root, proposal_path, confirmation_path):
 root=Path(root);proposal=read(proposal_path)
 registry=load_registry(root)
 prior=[s for s in registry['sources'] if s.get('profile_revision_of_source_id')==proposal['source_id'] and s.get('profile_confirmation',{}).get('proposal_hash')==proposal['proposal_hash']]
 if prior:return prior[0]['source_id']
 import_confirmation(root,proposal_path,confirmation_path)
 registry=load_registry(root);old=next(s for s in registry['sources'] if s['source_id']==proposal['source_id'])
 if old['status']!='blocked' or 'formal_segmented' in old['gates']:raise ValueError('Only never-segmented blocked sources may resume via profile revision')
 if any((s['exam'],s['module'],s['source_type'])==(old['exam'],old['module'],old['source_type']) and 'formal_segmented' in s['gates'] for s in registry['sources']):raise ValueError('An existing formal dataset requires explicit replacement identity migration')
 if not artifacts_valid(root,proposal['artifact_hashes']):raise ValueError('Revision evidence changed')
 versions=[s['version'] for s in registry['sources'] if (s['exam'],s['module'],s['source_type'])==(old['exam'],old['module'],old['source_type'])]
 sid='src-'+hashlib.sha256((old['source_id']+'|profile|'+proposal['proposal_hash']).encode()).hexdigest()[:24]
 evidence={'proposal_hash':proposal['proposal_hash'],'proposal_path':Path(proposal_path).relative_to(root).as_posix(),'proposal_sha256':artifact_digest(proposal_path),'confirmation_path':Path(confirmation_path).relative_to(root).as_posix(),'confirmation_sha256':artifact_digest(confirmation_path)}
 new={k:deepcopy(old[k]) for k in ['exam','module','source_type','filename','sha256']}
 new.update(source_id=sid,version=max(versions)+1,status='registered',layout_profile=None,answer_profile=None,supersedes_source_id=None,created_at=now(),identity_migration=None,gates={},profile_revision_of_source_id=old['source_id'],profile_confirmation=evidence,events=[{'stage':'registered','at':now(),'change_reason':'manual_shared_region_review','previous_source_id':old['source_id'],'evidence':evidence}])
 registry['sources'].append(new);save_registry(root,registry)
 return sid
