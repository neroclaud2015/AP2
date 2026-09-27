"""Read-only integrity gates for static acceptance artifacts."""
import hashlib
import json
from pathlib import Path

def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))

def digest(path):
    path=Path(path)
    data=json.dumps(read(path),sort_keys=True,separators=(',',':')).encode() if path.suffix=='.json' else path.read_bytes()
    return hashlib.sha256(data).hexdigest()

def active_evidence(root,target):
    root=Path(root).resolve()
    module=read(root/'data/ingest/layout_validation_manifest.json')['modules'][target]
    state=module['versions'][module['active_key']]
    if state['status'] not in ('compatible','blocked') or 'report' not in state:
        raise ValueError('No completed validation evidence: '+target)
    report_path=root/state['report'];report=read(report_path)
    for field in ('status','source_hash','config_hash'):
        if report.get(field)!=state.get(field):raise ValueError('Active report mismatch: '+field)
    if report.get('version')!=state['profile_version']:raise ValueError('Profile version mismatch')
    if report.get('physical_pages_checked')!=state['page_count'] or len(state['pages'])!=state['page_count']:
        raise ValueError('Incomplete page evidence')
    for page in state['pages'].values():
        for relative,expected in page['artifacts'].items():
            path=(root/relative).resolve();path.relative_to(root)
            if digest(path)!=expected:raise ValueError('Checkpoint integrity failure: '+relative)
    return report_path.parent,report

def verify_preview(folder,report):
    folder=Path(folder);preview=read(folder/'preview-manifest.json')
    if report['status']!='compatible':raise ValueError('FA is not compatible')
    for left,right in [('profile_id','profile'),('source_hash','source_hash'),('config_hash','config_hash')]:
        if preview.get(left)!=report[right]:raise ValueError('Stale preview: '+left)
    expected={str(i) for i in range(1,29)}|{'U'+str(i) for i in range(1,9)}
    items=preview.get('items',[])
    if len(items)!=36 or preview.get('count')!=36 or {i['question_number'] for i in items}!=expected:
        raise ValueError('Preview must contain exactly 36 questions')
    if len({i['anchor_id'] for i in items})!=36:raise ValueError('Duplicate preview anchor')
    for item in items:
        path=(folder/item['image']).resolve();path.relative_to(folder.resolve())
        if hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:raise ValueError('Preview image integrity failure')
    return preview
