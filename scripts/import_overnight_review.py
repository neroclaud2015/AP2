"""Import a unified exported bundle using existing source-bound scope gates.
Default dry run. Mapping/source requests are reported, never auto-applied.
"""
from pathlib import Path
from ingest import read
from manual_answer_promotion import prepare,apply
import argparse,json

def plans(root,payload):
 if payload.get('schema_version')!=1 or payload.get('scope')!='overnight' or not isinstance(payload.get('scopes'),list):raise ValueError('Expected overnight review bundle')
 scopes=payload['scopes']
 if len({s.get('scope') for s in scopes})!=len(scopes):raise ValueError('Duplicate scope')
 flat=[r for s in scopes for r in s.get('confirmations',[])];top=payload.get('confirmations',[])
 if sorted(flat,key=lambda r:r['question_id'])!=sorted(top,key=lambda r:r['question_id']) or len({r['question_id'] for r in flat})!=len(flat):raise ValueError('Bundle confirmation identity mismatch')
 return [(s,prepare(root,s)) for s in scopes]
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('file',type=Path);p.add_argument('--apply',action='store_true');a=p.parse_args();root=Path(__file__).resolve().parents[1];payload=read(a.file);validated=plans(root,payload)
 for scope,plan in validated:
  result=apply(root,scope) if a.apply else {'ready':list(plan['ready']),'pending':plan['pending']}
  print(json.dumps({'scope':scope['scope'],**result}))
 print('Mapping/source decisions require separate source-bound revision review; not auto-applied:',len(payload.get('mapping_decisions',[])))
