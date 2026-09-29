"""Resume only the registered overnight scopes; fail closed on any changed checkpoint.
Completed and awaiting-review stages are verified then skipped, without opening PDFs.
This driver does not accept or promote human-review candidates.
"""
from pathlib import Path
from unittest.mock import patch
from ingest import read,save
from answers import artifacts_valid,artifact_digest
from source_registry import load_registry
from registered_ingest import run_layout,run_answers
import json

def resume(root):
 root=Path(root);results=[];registry=load_registry(root)
 with patch('pymupdf.open',side_effect=AssertionError('Completed PDF must not be reopened')):
  for key in ['winter2023_24','sommer2024','winter2024_25']:
   for code in ['ap','fa','wiso']:
    path=root/f'scripts/layout_profiles/{key}_{code}.json';c=read(path);s=next(s for s in registry['sources'] if s['source_id']==c['source_id'])
    if s['sha256']!=c['source_hash'] or s['gates']['profile_matched']['artifacts'].get(path.relative_to(root).as_posix())!=artifact_digest(path):raise ValueError('Immutable source/profile changed')
    if s['status']=='blocked':
     if not artifacts_valid(root,s['events'][-1]['evidence']['artifacts']):raise ValueError('Blocked evidence changed')
     results.append({'scope':c['scope'],'status':'blocked_checkpoint_preserved','reason':s['events'][-1]['evidence']['reason']});continue
    for stage,promote in [('preview',False),('segmentation',True)]:
     result=run_layout(root,path,promote=promote);results.append({'scope':c['scope'],'stage':stage,**result})
    ap=root/f'scripts/layout_profiles/{key}_{code}_official.json';a=read(ap);source=next(s for s in registry['sources'] if s['source_id']==c['solution_source_id']);state=read(root/f'data/ingest/{c["scope"]}_registered_answers.json')
    if source['sha256']!=a['source_hash'] or source['gates']['profile_matched']['artifacts'].get(ap.relative_to(root).as_posix())!=artifact_digest(ap):raise ValueError('Immutable official profile changed')
    if state and artifacts_valid(root,state['artifacts']):result={'status':'skipped','reason':'completed source-bound answer checkpoint; review remains unresolved' if state['status']=='blocked' else 'completed','processed_pages':0,'pdf_pages_opened':0}
    else:result=run_answers(root,path,ap)
    results.append({'scope':c['scope'],'stage':'official',**result})
 return {'results':results,'skipped_steps':sum(r['status']=='skipped' for r in results),'old_pdf_rescans':0,'new_pages_rendered':0}
if __name__=='__main__':
 root=Path(__file__).resolve().parents[1];result=resume(root);save(root/'docs/evidence/overnight/duplicate-run.json',result);print(json.dumps(result,indent=2))
