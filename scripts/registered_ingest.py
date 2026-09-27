"""Registry-gated ingestion orchestration; shared engines remain immutable."""
from pathlib import Path
import hashlib,zipfile
from ingest import read,save,digest
from answers import artifact_digest
from portrait_dataset import cache_source,scoped_lock
from source_registry import load_registry,save_registry,require_registered_source,transition_source,STAGES
VERSION='2f.1.0'
def source_scope(sha):return 'registered-'+sha[:24]
def cache_registered(root,archive,source_id,sha,max_pages=None):
 root=Path(root);archive=Path(archive)
 source=require_registered_source(load_registry(root),source_id,sha)
 receipt=root/f'data/ingest/registered-receipts/{sha}.json'
 prior=read(receipt)
 archive_hash=digest(archive)
 if prior:
  if prior['archive_sha256']!=archive_hash or prior['member']!=source['filename'] or prior['source_sha256']!=sha:raise ValueError('Registered source receipt mismatch')
 else:
  with zipfile.ZipFile(archive) as z:actual=hashlib.sha256(z.read(source['filename'])).hexdigest()
  if actual!=sha:raise ValueError('Archive source hash differs from registered source')
  save(receipt,{'source_sha256':sha,'archive_sha256':archive_hash,'member':source['filename'],'cache_version':VERSION})
 if source['status']=='registered':
  registry=load_registry(root);registry=transition_source(registry,source_id,'hash_verified',{'source_sha256':sha,'result':'passed','artifacts':{receipt.relative_to(root).as_posix():artifact_digest(receipt)}});save_registry(root,registry)
 return cache_source(root,archive,source['filename'],source_scope(sha),max_pages=max_pages)

from PIL import Image
import inspect,json,html
from answers import artifacts_valid
from portrait_dataset import objhash,verify_layout
from layout_profiles.portrait_raster import analyze_portrait,compose_cached_regions,patch_image
from source_registry import bind_profiles

def verify_profile_binding(root,config):
 if config['source_hash'] not in config.get('validated_sources',[]):raise ValueError('Source absent from validated_sources')
 return require_registered_source(load_registry(root),config['source_id'],config['source_hash'])

def cache_metadata(root,sha):
 result=read(Path(root)/f'data/ingest/{source_scope(sha)}_source_manifest.json')
 if not result or result['source_hash']!=sha or result['status']!='complete':raise ValueError('Registered cache incomplete')
 return result

def validate_cached_layout(root,config,cache,folder):
 if set(config['pages'])!=set(cache['pages']):raise ValueError('Every physical page requires explicit classification')
 folder.mkdir(parents=True,exist_ok=True);records=[]
 for n,item in cache['pages'].items():
  if not artifacts_valid(root,item['artifacts']):raise ValueError('Private cached source mutated; never rerender silently')
  path=folder/f'page-{int(n):03}.json';key=objhash({'config':config['pages'][n],'image':item['artifacts'][item['image']],'engine':inspect.getsource(analyze_portrait)})
  prior=read(path)
  if prior and prior['key']==key and prior['record_hash']==objhash(prior['record']):record=prior['record']
  else:
   with Image.open(root/item['image']) as im:record=analyze_portrait(read(root/item['raw']),im,config['pages'][n],prefix=config['scope'])
   save(path,{'key':key,'record_hash':objhash(record),'record':record})
  records.append(record)
 return records,verify_layout(records,config)

def proof(root,source,paths,**extra):
 return {'source_sha256':source['sha256'],'result':'passed','artifacts':{Path(p).relative_to(root).as_posix():artifact_digest(p) for p in paths},'artifact_hash_algorithm':'canonical-json-utf8-or-binary-sha256',**extra}

def advance(root,source_id,target,paths,**extra):
 registry=load_registry(root);source=next(s for s in registry['sources'] if s['source_id']==source_id)
 if source['status']=='blocked':raise ValueError('Source blocked')
 if STAGES.index(source['status'])>=STAGES.index(target):return
 save_registry(root,transition_source(registry,source_id,target,proof(root,source,paths,**extra)))

def run_layout(root,config_path,*,promote=False):
 root=Path(root);config=read(config_path);scope=config['scope']
 source=next((s for s in load_registry(root)['sources'] if s['source_id']==config['source_id']),None)
 if source is None or source['sha256']!=config['source_hash']:raise ValueError('Unregistered source')
 if source['exam']!=config['exam'].replace('_','-') or source['module'].casefold()!=config['module'].casefold():raise ValueError('Registered module mismatch')
 if config.get('configuration_complete') is False:raise ValueError('Incomplete audited layout configuration; blocked module cannot be promoted')
 if config['source_hash'] not in config.get('validated_sources',[]):raise ValueError('Source absent from validated_sources')
 implementation=''.join(inspect.getsource(f).replace('\r\n','\n') for f in [run_layout,analyze_portrait,compose_cached_regions,verify_layout])
 revision=config['version']+'-'+objhash({'config':config,'implementation':implementation})[:12]
 if source.get('layout_profile') and source.get('gates',{}).get('profile_matched'):
  prior=source['gates']['profile_matched']['artifacts'];relative=Path(config_path).relative_to(root).as_posix()
  if prior.get(relative)!=artifact_digest(config_path):raise ValueError('Bound profile configuration changed')
  revision=source['layout_profile'].split('@',1)[1]
 evidence=root/f'docs/evidence/phase2f/{scope}';mp=root/f'data/ingest/{scope}_registered_layout.json';state=read(mp,{})
 target='formal_segmented' if promote else 'preview_ready'
 engine_hash=objhash({'version':VERSION,'engines':[inspect.getsource(f).replace('\r\n','\n') for f in [analyze_portrait,compose_cached_regions,verify_layout]]})
 if state.get('engine_hash') and state['engine_hash']!=engine_hash:raise ValueError('Accepted geometry engine changed; explicit revalidation required')
 if state.get('revision')==revision and state.get('status') in ([target,'formal_segmented','blocked'] if not promote else [target]) and artifacts_valid(root,state.get('artifacts')):
  return {'status':'skipped','revision':revision,'questions':len(config['expected']),'pdf_pages_opened':0,'processed_pages':0}
 if source['status']=='blocked':raise ValueError('Blocked module cannot process or promote')
 if state.get('revision') and state['revision']!=revision and source['status'] not in ('registered','hash_verified'):raise ValueError('Accepted profile revision changed; explicit replacement required')
 if source['status']=='hash_verified':
  registry=load_registry(root);registry=bind_profiles(registry,source['source_id'],layout_profile=config['profile_id']+'@'+revision,answer_profile=config.get('answer_profile_id','ring-annulus-explicit@2f.1.0'));save_registry(root,registry)
  advance(root,source['source_id'],'profile_matched',[Path(config_path)],profile_id=config['profile_id'],validated_sources=config['validated_sources'])
 cache=cache_metadata(root,config['source_hash']);evidence.mkdir(parents=True,exist_ok=True)
 records,validation=validate_cached_layout(root,config,cache,root/f'data/ingest/{scope}-layout/{revision}')
 report={**validation,'revision':revision,'source_id':source['source_id'],'source_hash':source['sha256'],'profile_id':config['profile_id'],'validated_sources':config['validated_sources'],'pdf_pages_opened':0,'pdf_pages_rendered':0}
 reportpath=evidence/'layout-validation.json';save(reportpath,report)
 if validation['status']!='compatible':return report
 advance(root,source['source_id'],'layout_validated',[reportpath])
 images={int(n):Image.open(root/p['image']).convert('RGB') for n,p in cache['pages'].items()};geometry={int(n):p['geometry'] for n,p in cache['pages'].items()}
 regions=[r for page in records for r in page['regions']];anchors=[(p['page'],a) for p in records for a in p['anchors']];anchors.sort(key=lambda v:(v[1]['number'].startswith('U'),int(v[1]['number'].lstrip('U'))))
 paths=[reportpath];questions=[];items=[]
 for page,a in anchors:
  owned=[r for r in regions if r['owner']==a['anchor_id']];number=a['number'];name=('Q'+number if number.isdigit() else number)+'.png'
  crop=f'assets/questions/{cache["doc_id"]}/{revision}/{a["anchor_id"]}.png';p=root/'public'/crop;p.parent.mkdir(parents=True,exist_ok=True);im=compose_cached_regions(owned,images,geometry);im.save(p);paths.append(p)
  ep=evidence/name;im.save(ep);paths.append(ep);hp=evidence/f'heading-{number}.png';patch_image(images[page],a['bbox'],geometry[page]).save(hp);paths.append(hp)
  primary=[r['bbox'] for r in owned if r['page']==page];bbox=[min(b[0] for b in primary),min(b[1] for b in primary),max(b[2] for b in primary),max(b[3] for b in primary)]
  questions.append({'question_id':a['anchor_id'],'question_number':number,'exam':config['exam'],'module':config['module'],'source_id':source['source_id'],'source_version':source['version'],'source_pdf':cache['public_pdf'],'source_pdf_available':False,'source_page':page,'source_page_image':'','source_page_available':False,'source_size':geometry[page],'source_sha256':source['sha256'],'bounding_box':bbox,'regions':primary,'source_regions':[{**r,'source_page_image':'','source_size':geometry[r['page']]} for r in owned],'cropped_question_image':crop,'extracted_text':'','extraction_confidence':.98,'label_evidence':a['evidence'],'review_status':'auto_ready','review_reasons':[],'extractor_version':VERSION,'segmentation_revision':revision,'tags':[],'solution_page':None,'solution_confirmed':False,'heading_pixel_sha256':a['heading_pixel_sha256']})
  items.append({'question_number':number,'question_id':a['anchor_id'],'source_regions':owned,'image':name})
 attachments=[]
 for i,item in enumerate(config.get('attachment_crops',[])):
  crop=f'assets/questions/{cache["doc_id"]}/{revision}/attachment-{item["page"]}-{i}.png';p=root/'public'/crop;patch_image(images[item['page']],item['bbox'],geometry[item['page']]).save(p);paths.append(p);attachments.append({**item,'image':crop,'source_sha256':source['sha256']})
 for im in images.values():im.close()
 preview=evidence/'preview-manifest.json';save(preview,{'source_hash':source['sha256'],'revision':revision,'items':items,'attachments':attachments});paths.append(preview)
 index=evidence/'index.html';index.write_text('<!doctype html><meta charset="utf-8"><style>body{font:18px system-ui;margin:24px}img{max-width:100%}article{border:1px solid #ccc;padding:12px;margin:12px}</style><h1>'+html.escape(config['exam']+' '+config['module'])+'</h1>'+''.join('<article><h2>'+x['question_number']+'</h2><img loading="lazy" src="'+x['image']+'"></article>' for x in items),encoding='utf8',newline='\n');paths.append(index)
 advance(root,source['source_id'],'preview_ready',[preview,index,reportpath])
 if config.get('blocking_issues'):
  report.update(status='blocked',review_list=config['blocking_issues'],formal_records_generated=False);blocked=evidence/'blocked.json';save(blocked,report);paths.append(blocked)
  registry=load_registry(root);save_registry(root,transition_source(registry,source['source_id'],'blocked',{'reason':'; '.join(config['blocking_issues']),'artifacts':{blocked.relative_to(root).as_posix():artifact_digest(blocked)}}));state={'status':'blocked','revision':revision,'engine_hash':engine_hash,'artifacts':{p.relative_to(root).as_posix():artifact_digest(p) for p in paths}};save(mp,state);return report
 if promote:
  solution=next(s for s in load_registry(root)['sources'] if s['source_id']==config['solution_source_id'])
  dataset={'schema_version':2,'exam':config['exam'],'module':config['module'],'document_id':cache['doc_id'],'source_id':source['source_id'],'source_version':source['version'],'source_pdf':cache['public_pdf'],'source_pdf_available':False,'source_sha256':source['sha256'],'extractor_version':VERSION,'segmentation_revision':revision,'profile_id':config['profile_id'],'questions':questions,'pages_processed':cache['page_count'],'pages_total':cache['page_count'],'source_pages':[],'solution_document':{'source_id':solution['source_id'],'public_pdf':f'assets/pdfs/{solution["sha256"][:24]}.pdf','public_pdf_available':False,'pages':[]},'coverage':{'expected_count':len(questions),'observed_count':len(questions),'missing':[],'unexpected':[]},'review_queue':[],'unresolved_regions':[],'timing_minutes':config.get('timing_minutes'),'timing_source_page':config.get('timing_source_page'),'attachment_refs':config.get('attachment_refs',{}),'attachment_images':attachments,'shared_description_page':config.get('description_page')}
  for base in ['data/exams','public/data']:
   p=root/f'{base}/{config["name"]}_segmented.json';save(p,dataset);paths.append(p)
  advance(root,source['source_id'],'formal_segmented',paths[-2:])
 state={'status':target,'revision':revision,'engine_hash':engine_hash,'artifacts':{p.relative_to(root).as_posix():artifact_digest(p) for p in paths}};save(mp,state)
 return {**report,'status':target,'questions':len(questions),'attachments':attachments}

def run_answers(root,layout_path,answer_path):
 from cached_official import extract_grid,extract_written,classify_column,MEASUREMENT_CONFIG
 from wiso_answers import checkpoint_value
 root=Path(root);layout=read(layout_path);config=read(answer_path);scope=layout['scope'];registry=load_registry(root)
 question=require_registered_source(registry,layout['source_id'],layout['source_hash']);solution=require_registered_source(registry,layout['solution_source_id'],config['source_hash'])
 if config.get('source_id')!=solution['source_id'] or config['source_hash'] not in config.get('validated_sources',[]):raise ValueError('Official profile source binding invalid')
 if config['module']!=layout['module'] or config['exam']!=layout['exam'] or config['name']!=layout['name'] or config['scope']!=layout['scope']:raise ValueError('Official profile module mismatch')
 if question['status'] not in ('formal_segmented','answers_extracted','validated','production'):raise ValueError('Formal registry gate required before answers')
 accepted=read(root/f'data/ingest/{scope}_registered_layout.json')
 if not accepted or accepted['status']!='formal_segmented' or not artifacts_valid(root,accepted['artifacts']):raise ValueError('Accepted segmentation or preview changed')
 dataset=read(root/f'data/exams/{layout["name"]}_segmented.json');ids={q['question_number']:q['question_id'] for q in dataset['questions']}
 expected={str(n) for n in range(1,config['choice_count']+1)}|set(config['u_regions'])
 if set(ids)!=expected or len(ids)!=len(dataset['questions']) or len(set(ids.values()))!=len(ids):raise ValueError('Answer identity coverage mismatch')
 implementation=inspect.getsource(run_answers).replace('\r\n','\n')+''.join((root/'scripts'/name).read_text(encoding='utf8').replace('\r\n','\n') for name in ['cached_official.py','fa_answers.py'])
 revision=scope+'-'+VERSION+'-'+objhash({'config':config,'implementation':implementation,'measurements':MEASUREMENT_CONFIG})[:12]
 key=objhash({'revision':revision,'dataset':dataset});mp=root/f'data/ingest/{scope}_registered_answers.json';state=read(mp,{})
 if state.get('key')==key and artifacts_valid(root,state.get('artifacts')):return {'status':'skipped','revision':revision,'pdf_pages_opened':0,'processed_pages':0}
 if state and state.get('key')!=key and solution['status'] not in ('registered','hash_verified'):raise ValueError('Accepted official revision changed; replacement review required')
 source=cache_metadata(root,config['source_hash'])
 for n,h in config['page_image_hashes'].items():
  p=source['pages'][n]
  if p['artifacts'][p['image']]!=h or not artifacts_valid(root,p['artifacts']):raise ValueError('Official source pixels differ from reviewed profile')
 evidence=root/f'docs/evidence/phase2f/{scope}';evidence.mkdir(parents=True,exist_ok=True)
 if solution['status']=='hash_verified':
  registry=load_registry(root);registry=bind_profiles(registry,solution['source_id'],layout_profile=layout['profile_id']+'@'+accepted['revision'],answer_profile=config.get('profile_id','ring-annulus-explicit')+'@'+revision);save_registry(root,registry)
  advance(root,solution['source_id'],'profile_matched',[Path(answer_path)])
 for stage in ['layout_validated','preview_ready','formal_segmented']:
  advance(root,solution['source_id'],stage,[Path(answer_path),root/f'public/data/{layout["name"]}_segmented.json'],basis='Exact source-image hashes and visually reviewed official column labels/U ownership; question preview accepted before answer extraction')
 checkpoints=root/f'data/ingest/{scope}-official/{revision}'
 choices,changed=checkpoint_value(root,checkpoints/'choice.json',key,lambda:extract_grid(root,config,source,ids,revision),lambda d:['public/'+r['source_crop'] for r in d['answers']]+['public/'+d['overlay']])
 written=[]
 for number in config['u_regions']:
  result,_=checkpoint_value(root,checkpoints/f'{number}.json',key,lambda n=number:extract_written(root,config,source,n,ids,revision),lambda d:['public/'+d['cropped_solution_image']]);written.append(result)
 paths=[]
 for suffix,data in [('answers',choices),('u_solutions',{'schema_version':1,'exam':config['exam'],'module':config['module'],'extractor_revision':revision,'solutions':written})]:
  for base in ['data/exams','public/data']:
   p=root/f'{base}/{layout["name"]}_{suffix}.json';save(p,data);paths.append(p)
 paths.extend(root/'public'/r['source_crop'] for r in choices['answers']);paths.extend(root/'public'/r['cropped_solution_image'] for r in written);paths.append(root/'public'/choices['overlay'])
 for sid in [question['source_id'],solution['source_id']]:advance(root,sid,'answers_extracted',paths[:4])
 review=[{'question_number':r['question_number'],'reasons':r['review_reasons']} for r in choices['answers'] if r['official_answer'] is None]
 coverage={'choice_expected':config['choice_count'],'choice_records':len(choices['answers']),'u_expected':len(config['u_regions']),'u_records':len(written),'review_list':review,'status':'blocked' if review else 'passed','revision':revision,'pdf_pages_opened':0}
 p=evidence/'answer-coverage.json';save(p,coverage);paths.append(p)
 if not review:
  bundle=[root/f'public/data/{layout["name"]}_{suffix}.json' for suffix in ['segmented','answers','u_solutions']]
  for sid in [question['source_id'],solution['source_id']]:advance(root,sid,'validated',bundle+[p],question_revision=accepted['revision'],official_answer_revision=revision,question_ids=list(ids.values()))
 state={'key':key,'revision':revision,'status':'blocked' if review else 'validated','artifacts':{p.relative_to(root).as_posix():artifact_digest(p) for p in paths}};save(mp,state)
 return coverage
