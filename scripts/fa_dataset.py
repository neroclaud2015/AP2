"""Bind promoted FA identities and regions to accepted checkpoint evidence."""
from pathlib import Path
import hashlib
import json
from acceptance_artifacts import active_evidence,verify_preview
from answers import artifact_digest
from ingest import read

def record_digest(record):return hashlib.sha256(json.dumps(record,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()

def accepted_preview(root):
 root=Path(root);folder,report=active_evidence(root,'fa_2017')
 preview=verify_preview(root/'docs/evidence/layout_profiles/fa-preview',report)
 pages=[read(p) for p in sorted(folder.glob('page-*.json'))]
 anchors={a['anchor_id']:a for p in pages for a in p['anchors']}
 if len(anchors)!=36 or {i['anchor_id'] for i in preview['items']}!=set(anchors):raise ValueError('Accepted anchor coverage mismatch')
 for item in preview['items']:
  anchor=anchors[item['anchor_id']];regions=[r for p in pages for r in p['regions'] if r['owner']==item['anchor_id']]
  if item['question_number']!=anchor['number'] or item['regions']!=regions or item['review_reasons']!=anchor['review_reasons']:
   raise ValueError('Preview metadata differs from verified anchor: '+item['anchor_id'])
 return folder,report,preview

def validated_dataset(root):
 root=Path(root);_,report,preview=accepted_preview(root)
 path=root/'data/exams/2017_sommer_funktionsanalyse_segmented.json';data=read(path)
 if not data or data['exam']!='2017_sommer' or data['module']!='Funktionsanalyse' or data['source_sha256']!=report['source_hash']:
  raise ValueError('Invalid FA dataset scope/source')
 expected={i['anchor_id']:i for i in preview['items']}
 if len(data['questions'])!=36 or {q['question_id'] for q in data['questions']}!=set(expected):raise ValueError('Invalid promoted FA identities')
 for q in data['questions']:
  item=expected[q['question_id']]
  if q['question_number']!=item['question_number'] or q['source_regions']!=item['regions']:raise ValueError('Promoted FA metadata differs from accepted preview')
  if hashlib.sha256((root/'public'/q['cropped_question_image']).read_bytes()).hexdigest()!=item['sha256']:raise ValueError('Promoted FA crop changed')
 return data,artifact_digest(path)
