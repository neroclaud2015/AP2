"""Read-only verification of the eight scoped official U source crops."""
from pathlib import Path
from PIL import Image
from ingest import read,digest
from answers import artifacts_valid
from u_solutions import SOURCE_HASH,VERSION,CONFIG_HASH,REVISION,REGIONS,DOC

def validate(root):
 root=Path(root);data=read(root/'data/exams/2017_sommer_arbeitsplanung_u_solutions.json')
 assert data==read(root/'public/data/2017_sommer_arbeitsplanung_u_solutions.json')
 assert data['module']=='Arbeitsplanung' and data['extractor_revision']==REVISION
 assert digest(root/f'public/assets/pdfs/{DOC}.pdf')==SOURCE_HASH
 questions=read(root/'data/exams/2017_sommer_arbeitsplanung_segmented.json')['questions']
 expected={q['question_number']:q['question_id'] for q in questions if q['question_number'].startswith('U')}
 assert len(data['solutions'])==8 and {r['question_number'] for r in data['solutions']}==set(expected)
 for r in data['solutions']:
  assert r['question_id']==expected[r['question_number']] and r['source_hash']==SOURCE_HASH
  assert r['regions']==[{'source_page':p,'bbox':b} for p,b in REGIONS[r['question_number']]]
  assert r['solution_source_page']==r['regions'][0]['source_page']
  assert r['review_status']=='auto_ready' and r['answer_type']=='multi_part'
  for region in r['regions']:
   x0,y0,x1,y1=region['bbox'];assert 0<=x0<x1<=1190.4 and 0<=y0<y1<=841.44
  with Image.open(root/'public'/r['cropped_solution_image']) as im: im.verify()
  assert len({p['id'] for p in r['subparts']})==len(r['subparts'])
  for p in r['subparts']:
   if p['type']=='numeric':assert p['numeric']['value']==18.68 and p['numeric']['unit']=='A' and p['numeric']['tolerance']==.02 and p['numeric']['evidence']
 manifest=read(root/'data/ingest/u_solution_manifest.json');entry=manifest['entries'][f'{SOURCE_HASH}:{VERSION}:{CONFIG_HASH}']
 assert entry['status']=='complete' and artifacts_valid(root,entry['artifacts'])
 return {'solutions':8,'numeric_subparts':1,'U4_regions':2,'source_pages':[6,7,8,9],'other_modules_processed':False}

if __name__=='__main__': print(validate(Path(__file__).resolve().parents[1]))
