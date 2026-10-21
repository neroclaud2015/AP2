"""Explicit complete-topic revisions; historical frequency never selects legal validity."""
from copy import deepcopy
from datetime import date

def resolve_knowledge(versions,as_of):
 date.fromisoformat(as_of)
 rows=deepcopy(versions)
 ids=[v['id'] for v in rows]
 if len(ids)!=len(set(ids)):raise ValueError('Duplicate knowledge version')
 for v in rows:
  v['current']=False
  for key in ('effective_from','effective_until','verified_at'):
   if v.get(key):date.fromisoformat(v[key])
  if any(s not in ids or s==v['id'] for s in v.get('supersedes',[])):raise ValueError('Invalid supersedes reference')
  if v.get('effective_from') and v.get('effective_until') and v['effective_from']>=v['effective_until']:raise ValueError('Invalid validity interval')
 # Future versions do not invalidate a presently applicable predecessor.
 applicable=[v for v in rows if (not v.get('effective_from') or v['effective_from']<=as_of) and (not v.get('effective_until') or as_of<v['effective_until'])]
 replaced={s for v in applicable for s in v.get('supersedes',[])}
 candidates=[v for v in applicable if v['id'] not in replaced]
 chosen=candidates[0] if len(candidates)==1 else None
 valid=chosen and chosen.get('verified') and chosen.get('verified_at') and chosen['verified_at']<=as_of and chosen.get('references')
 if valid:
  predecessors=[v for v in rows if v['id'] in chosen.get('supersedes',[])]
  valid=all(not v.get('verified_at') or v['verified_at']<=chosen['verified_at'] for v in predecessors)
 if valid:chosen['current']=True
 return {'status':'current' if valid else 'needs_review','as_of':as_of,'current_version_id':chosen['id'] if valid else None,'bullets':chosen['bullets'] if valid else [],'versions':rows}
