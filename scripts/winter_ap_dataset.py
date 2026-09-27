"""Promote the user-accepted Winter AP preview verbatim; no question PDF access."""
from pathlib import Path
import hashlib,json,shutil
from ingest import read,save
import winter_preview
from layout_profiles.ap_2017_18 import APWinterProfile

VERSION='2e.1.0';NAME='2017_18_winter_arbeitsplanung'
SOURCE_PAGE_PREFIX='evidence/layout-profiles/ap_2017_18/2b.1.1-a2fe9c23bdbf61a4'
QUESTION_MEMBER='2017_18 Winter/17_18 Arbeitsplanung.pdf'
SOLUTION_MEMBER='2017_18 Winter/17_18 Lösung.pdf'

def digest(path):return winter_preview.digest(path)
def artifacts_valid(root,artifacts):return winter_preview.artifacts_valid(root,artifacts)
def accepted(root):
 root=Path(root).resolve();manifest=read(root/'data/ingest/winter_layout_manifest.json');state=manifest['versions'][manifest['active_key']]
 if state['status']!='complete' or state['classification']!='compatible_dry_run':raise ValueError('Winter AP accepted preview unavailable')
 profile=APWinterProfile();winter_preview.source_cache(root,profile)
 if state['source_hash']!=profile.source_hash or not artifacts_valid(root,state['outputs']):raise ValueError('Accepted Winter evidence integrity failure')
 folder=(root/state['report']).parent;report=read(folder/'report.json');preview=read(folder/'preview-manifest.json')
 if report['status']!='compatible_dry_run' or report['source_hash']!=profile.source_hash or preview['source_hash']!=profile.source_hash or preview['config_hash']!=report['config_hash']:raise ValueError('Accepted preview provenance mismatch')
 records=[read(folder/f'page-{n:03}.json') for n in range(1,26)]
 if not winter_preview.validate_records(records,profile.expected)['compatible']:raise ValueError('Winter AP ownership/coverage no longer valid')
 anchors={a['anchor_id']:a for p in records for a in p['anchors']}
 if len(preview['items'])!=36 or {i['anchor_id'] for i in preview['items']}!=set(anchors):raise ValueError('Accepted identities changed')
 for item in preview['items']:
  a=anchors[item['anchor_id']];regions=[r for p in records for r in p['regions'] if r['owner']==item['anchor_id']]
  if item['question_number']!=a['number'] or item['regions']!=regions or item['heading_evidence']['heading_pixel_sha256']!=a['heading_pixel_sha256']:raise ValueError('Accepted preview metadata changed')
  if digest(folder/item['image'])!=item['sha256']:raise ValueError('Accepted preview crop changed')
 return folder,report,preview,records

def run(root):
 root=Path(root).resolve();folder,report,preview,records=accepted(root);pages={p['page']:p for p in records}
 solution=read(root/'data/ingest/winter_solution_cache.json')
 if not solution or solution['status']!='complete':raise ValueError('Scoped official source cache unavailable')
 algo=hashlib.sha256(Path(__file__).read_text(encoding='utf-8-sig').replace('\r\n','\n').encode()).hexdigest();key=report['source_hash']+':'+report['config_hash']+':'+VERSION+':'+algo
 mp=root/'data/ingest/winter_ap_promotion_manifest.json';m=read(mp,{'entries':{}});state=m['entries'].get(key,{})
 if state.get('status')=='complete' and artifacts_valid(root,state.get('artifacts',{})):return {'status':'skipped','questions_processed':0,'question_pdf_pages_read':0}
 docid=report['source_hash'][:24];revision=report['profile_version']+'-'+report['config_hash'];questions=[];paths=[]
 for item in preview['items']:
  aid=item['anchor_id'];number=item['question_number'];primary=next(r for r in item['regions'] if r['role']=='primary');page=primary['page'];boxes=[r['bbox'] for r in item['regions'] if r['page']==page]
  bbox=[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]
  crop=f'assets/questions/{docid}/{revision}/{aid}.png';target=root/'public'/crop;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(folder/item['image'],target)
  if digest(target)!=item['sha256']:raise ValueError('Promoted Winter AP pixels changed')
  paths.append('public/'+crop)
  source_regions=[{**r,'source_page_image':f"{SOURCE_PAGE_PREFIX}/page-{r['page']:03}.png",'source_size':pages[r['page']]['geometry']} for r in item['regions']]
  questions.append({'question_id':aid,'exam':'2017_18_winter','module':'Arbeitsplanung','question_number':number,
   'source_pdf':QUESTION_MEMBER,'source_pdf_available':False,'source_pdf_sha256':report['source_hash'],'source_page':page,
   'source_page_image':f'{SOURCE_PAGE_PREFIX}/page-{page:03}.png','source_size':pages[page]['geometry'],'bounding_box':bbox,'regions':boxes,'source_regions':source_regions,
   'cropped_question_image':crop,'accepted_crop_sha256':item['sha256'],'extracted_text':'','extraction_confidence':.96,
   'label_evidence':'user_accepted_phase2d_visually_observed_heading_with_exact_pixel_fingerprint','review_status':'auto_ready','review_reasons':[],
   'extractor_version':VERSION,'segmentation_revision':revision,'tags':[],'solution_page':None,'solution_confirmed':False})
 result={'schema_version':2,'exam':'2017_18_winter','module':'Arbeitsplanung','document_id':docid,'source_pdf':QUESTION_MEMBER,'source_pdf_available':False,
  'source_sha256':report['source_hash'],'extractor_version':VERSION,'segmentation_revision':revision,'profile_id':'ap_2017_18','questions':questions,
  'pages_processed':25,'pages_total':25,'source_pages':[{'number':n,'image':f'{SOURCE_PAGE_PREFIX}/page-{n:03}.png','raw_text':''} for n in range(1,26)],
  'solution_document':{'public_pdf':'','source_pdf_available':False,'pages':[],'original_filename':SOLUTION_MEMBER,'sha256':solution['source_hash']},
  'confidence_note':'Exact36 accepted Phase2D crop bytes and IDs retained. No question PDF rescan. Full source PDF publication withheld; existing accepted page images remain available.',
  'coverage':{'expected_count':36,'observed_count':36,'missing':[],'unexpected':[]},'review_queue':[],'unresolved_regions':[],
  'acceptance':'User accepted Phase2D Winter preview before Phase2E production promotion',
  'duration_minutes':105,'duration_source':{'page':2,'image':f'{SOURCE_PAGE_PREFIX}/page-002.png','source_hash':report['source_hash'],'evidence':'Printed Insgesamt 105 min für Teil A und Teil B on cached physical page2, visually verified'},
  'description_page':14,'attachment_pages':[24,25]}
 for relative in [f'data/exams/{NAME}_segmented.json',f'public/data/{NAME}_segmented.json']:save(root/relative,result);paths.append(relative)
 state={'status':'complete','source_hash':report['source_hash'],'accepted_config_hash':report['config_hash'],'version':VERSION,'algorithm_hash':algo,'question_pdf_pages_read':0,'questions':36,'artifacts':{p:digest(root/p) for p in paths}}
 m['entries'][key]=state;m['active_key']=key;save(mp,m)
 return {'status':'promoted','questions_processed':36,'question_pdf_pages_read':0}

def validated_dataset(root):
 root=Path(root).resolve();_,report,preview,_=accepted(root);data=read(root/f'data/exams/{NAME}_segmented.json')
 if not data or data['module']!='Arbeitsplanung' or data['exam']!='2017_18_winter' or data['source_sha256']!=report['source_hash']:raise ValueError('Wrong Winter AP dataset')
 expected={i['anchor_id']:i for i in preview['items']}
 if len(data['questions'])!=36 or {q['question_id'] for q in data['questions']}!=set(expected):raise ValueError('Winter AP identities differ from accepted preview')
 for q in data['questions']:
  i=expected[q['question_id']]
  stripped=[{k:v for k,v in r.items() if k not in ('source_page_image','source_size')} for r in q['source_regions']]
  if q['question_number']!=i['question_number'] or stripped!=i['regions'] or digest(root/'public'/q['cropped_question_image'])!=i['sha256']:raise ValueError('Winter AP accepted metadata/crop mismatch')
 return data,digest(root/f'data/exams/{NAME}_segmented.json')

if __name__=='__main__':print(json.dumps(run(Path(__file__).resolve().parents[1]),indent=2))
