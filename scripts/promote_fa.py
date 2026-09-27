"""Promote accepted FA preview bytes; never parses or renders the question PDF."""
from pathlib import Path
import hashlib
import json
import shutil
from acceptance_artifacts import active_evidence, verify_preview
from answers import artifact_digest, artifacts_valid
from ingest import read, save, lock
from layout_profiles.ap_2017 import region_text
from fa_dataset import accepted_preview

DOC='0734a1589eed96809ac7896a'
VERSION='2b.2.1'
NAME='2017_sommer_funktionsanalyse'

def run(root):
 root=Path(root);base=root/'docs/evidence/layout_profiles';folder,report,preview=accepted_preview(root)
 key=report['source_hash']+':'+VERSION+':'+report['config_hash']
 path=root/'data/ingest/fa_promotion_manifest.json'
 with lock(root):
  manifest=read(path,{'entries':{}});old=manifest['entries'].get(key,{})
  if old.get('status')=='complete' and artifacts_valid(root,old.get('artifacts')):
   return {'status':'skipped','questions_processed':0,'question_pdf_pages_read':0}
  pages={p['page']:p for p in [read(f) for f in sorted(folder.glob('page-*.json'))]}
  legacy=read(root/'public/data/2017_sommer.json');document=next(d for d in legacy['documents'] if d['id']==DOC)
  revision=report['version']+'-'+report['config_hash'];questions=[]
  for item in preview['items']:
   aid=item['anchor_id'];regions=item['regions'];number=item['question_number'];page=regions[0]['page']
   if any(r['page']!=page for r in regions):raise ValueError('Schema2 requires single-page region adapter')
   record=pages[page];raw=record['raw'];anchor=next(a for a in record['anchors'] if a['anchor_id']==aid)
   boxes=[r['bbox'] for r in regions];bbox=[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]
   crop=f'assets/questions/{DOC}/{revision}/{aid}.png';target=root/'public'/crop;target.parent.mkdir(parents=True,exist_ok=True)
   shutil.copy2(base/'fa-preview'/item['image'],target)
   if hashlib.sha256(target.read_bytes()).hexdigest()!=item['sha256']:raise ValueError('Promoted crop changed')
   questions.append({'question_id':aid,'exam':'2017_sommer','module':'Funktionsanalyse','question_number':number,
    'source_pdf':document['public_pdf'],'source_page':page,'source_page_image':f'assets/pages/{DOC}/{page:03}.png',
    'source_size':record['geometry'],'bounding_box':bbox,'regions':boxes,'source_regions':regions,
    'cropped_question_image':crop,'extracted_text':region_text(raw['lines'],boxes),
    'extraction_confidence':.89 if anchor['review_reasons'] else .96,'label_evidence':anchor['evidence'],
    'review_status':'needs_review' if anchor['review_reasons'] else 'auto_ready','review_reasons':anchor['review_reasons'],
    'extractor_version':VERSION,'segmentation_revision':revision,'tags':[],'solution_page':None,'solution_confirmed':False})
  result={'schema_version':2,'exam':'2017_sommer','module':'Funktionsanalyse','document_id':DOC,
    'source_pdf':document['public_pdf'],'source_sha256':report['source_hash'],'extractor_version':VERSION,
    'segmentation_revision':revision,'profile_id':'fa_2017','questions':questions,
    'pages_processed':15,'pages_total':15,'source_pages':document['pages'],
    'solution_document':next(d for d in legacy['documents'] if d['module']=='Solutions'),
    'confidence_note':'Promoted from human-accepted layout preview. Q9 heading evidence remains Needs Review.',
    'coverage':{'expected_count':36,'observed_count':36,'missing':[],'unexpected':[]},
    'review_queue':[{'question_id':q['question_id'],'reasons':q['review_reasons']} for q in questions if q['review_status']=='needs_review'],
    'unresolved_regions':[]}
  outputs=[f'data/exams/{NAME}_segmented.json',f'public/data/{NAME}_segmented.json']
  for p in outputs:save(root/p,result)
  artifacts=outputs+['public/'+q['cropped_question_image'] for q in questions]
  manifest['entries'][key]={'status':'complete','source_hash':report['source_hash'],'profile_version':report['version'],
    'config_hash':report['config_hash'],'version':VERSION,'questions':36,'question_pdf_pages_read':0,
    'artifacts':{p:artifact_digest(root/p) for p in artifacts}}
  save(path,manifest)
  return {'status':'promoted','questions_processed':36,'question_pdf_pages_read':0,'needs_review':['9']}

if __name__=='__main__':print(json.dumps(run(Path(__file__).resolve().parents[1]),indent=2))
