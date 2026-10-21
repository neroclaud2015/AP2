"""Read-only production WiSo derivation. Source crops remain authoritative.
Run with requirements.txt installed; optionally --no-ocr for cache-only builds.
Never renders or segments PDFs. Cache is bound to source revision and crop bytes.
"""
import argparse,hashlib,json,re,unicodedata
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
VERSION='wiso-text-1.0.0'
ROOT=Path(__file__).resolve().parents[1]
def read(p,default=None):
 return json.loads(p.read_text(encoding='utf-8-sig')) if p.exists() else default
def write(p,x):
 p.parent.mkdir(parents=True,exist_ok=True)
 content=json.dumps(x,ensure_ascii=False,indent=2)+'\n'
 if p.exists() and p.read_text(encoding='utf8')==content:return
 p.write_text(content,encoding='utf8')
def cache_key(revision,crop_hash):return hashlib.sha256(f'{VERSION}|rapidocr-1.4.4|{revision}|{crop_hash}'.encode()).hexdigest()
def valid_text(s):return len(s.strip())>=60 and len(re.findall(r'[A-Za-zÄÖÜäöüß]{3,}',s))>=4 and len(re.findall(r'[A-Za-zÄÖÜäöüß]',s))>=45 and s.count('\ufffd')<3
def normalize(s):return unicodedata.normalize('NFKD',s.lower().replace('ß','ss')).encode('ascii','ignore').decode()
# Classifiers propose topics from discriminative domain phrases, never count word hits as questions.
RULES={
'elternschutz':r'mutterschutz|elternzeit|schwanger|werdende.{0,3}m.tter|entbindung',
'kompetenzen':r'kompetenz|fortbildung|lebenslange|lebensbegleit|personalentwicklung|berufliche.{0,3}flexibilitat',
'finanzierung':r'kredit|schulden|schufa|finanzierung',
'europa':r'europaische.{0,3}union|binnenmarkt|erasmus|arbeitserlaubnis',
'kennzahlen':r'produktivitat|wirtschaftlichkeit|rentabilitat|rationalisierung|erwerbswirtschaft',
'sozialrecht':r'sozialgericht|arbeitsgericht|widerspruch|ablehnungsbescheid',
'kuendigung':r'kundig|kundigungsschutz', 'arbeitsvertrag':r'arbeitsvertrag|arbeitszeugnis|entgeltfortzahlung|urlaub|einstellungsgesprach|vorstellungsgesprach|personalakte|gratifikation',
'arbeitszeit':r'arbeitszeit|ruhezeit|ruhepause|mehrarbeit|uberstunden', 'tarifrecht':r'tarifvertrag|tarifverlrag|tariflohn|tarifpartner|tarifautonomie|gewerkschaft|streik|aussperrung',
'sozialversicherung':r'sozialversicher|sozialabgaben|sozialgesetzbuch', 'krankenversicherung':r'krankenversicher|krankenkasse|krankengeld',
'rentenversicherung':r'rentenversicher|altersrente|erwerbsminderung', 'arbeitslosenversicherung':r'arbeitslosenversicher|arbeitslosengeld|agentur fur arbeit',
'unfallversicherung':r'unfallversicher|berufsgenossenschaft|wegeunfall|arbeitsunfall', 'pflegeversicherung':r'pflegeversicher|pflegegrad',
'ausbildungsvertrag':r'berufsausbild|ausbildungsvertrag|ausbildungsordnung|ausbildungsplan|ausbildenden|ausbilder',
'ausbildungspruefung':r'abschlussprufung|gesellenprufung|ausbildungsprufung|berufsschule',
'betriebsrat':r'betriebsrat|betriebsrats|betriebsverfassung|betriebsversammlung|betriebsverein', 'jav':r'jugend.{0,12}auszubildendenvertretung|\bjav\b',
'markt':r'angebot und nachfrage|nachfrage|marktform|monopol|oligopol|polypol|marktwirtschaft|wettbewerb|okonomische.{0,3}prinzip|minimalprinzip|maximalprinzip|bedurfnis',
'konjunktur':r'konjunktur|bruttoinlandsprodukt|wirtschaftswachstum|rezession|magische.{0,3}viereck|wirtschaftskreislauf',
'geld':r'inflation|deflation|geldwert|kaufkraft|europaische zentralbank|leitzins|verbraucherpreis',
'unternehmen':r'handelsregister|unternehmensform|rechtsform|vollmacht|prokura|betriebsorganisation|haftung|existenzgrund|unternehmensgrund',
'steuern':r'steuer|finanzamt|brutto.{0,15}netto', 'arbeitsschutz':r'arbeitsschutz|jugendarbeitsschutz|unfallverhutung|sicherheitszeichen|schutzausrustung|gefahrstoff|schutzmassnahme|unfallquelle|gesundheitsgefahren|unfallschutz',
'datenschutz':r'datenschutz|personenbezogen|dsgvo|videouberwachung|uberwachungskamera', 'vertragsrecht':r'kaufvertrag|geschaftsfahig|rechtsfahig|sachmangel|mangelhaft|gewahrleistung|willenserklarung|besitz|eigentum|verjahrung|verzug|widerruf|leas|frei.{0,3}haus|lieferung|rechtsgeschaft|vertragsfreiheit|vertragsstorung|vertragzustande|agb|kaufe.{0,3}im.{0,3}internet',
'umwelt':r'umwelt|recycling|abfall|nachhaltig|ressourcen|entsorgung|energieeinspar'
}
def classify(text):
 # MC options are distractors, not evidence of the tested topic.
 stem=(text.split('?',1)[0] if '?' in text else text)[:700]
 s=normalize(stem).replace('-\n','').replace('\n',' ');hits={k:re.findall(v.replace(' ',''),s.replace(' ','')) for k,v in RULES.items()};topics=[k for k,v in hits.items() if v]
 if 'kuendigung' in topics and 'miet' in s and not any(x in s for x in ['arbeit','ausbild','betrieb']):topics.remove('kuendigung')
 return {'topic_ids':topics,'confidence':.8 if topics else 0,'source':'rule_based_proposal','locked':False,'review_reasons':[] if topics else ['classification_needs_review'],'evidence':[f'Stem: {stem[:500]}']+[f'{k}: '+', '.join(dict.fromkeys(v)) for k,v in hits.items() if v]}
def classify_record(record):
 result=classify(record['text'] if valid_text(record['text']) and record['confidence']>=.85 else '')
 result['confidence']=min(result['confidence'],record['confidence'])
 return result
def reconcile(old,new):
 if old and old.get('locked'):
  result=dict(old)
  if old.get('question_source_revision')!=new.get('question_source_revision'):result['review_reasons']=list(set(old.get('review_reasons',[])+['source_changed_since_confirmation']))
  return result
 return new

def propose_topics(inventory,texts,classifications,cues,min_seasons=3):
 """Surface stable unmatched domains for review; never activate them or count them."""
 questions={q['question_id']:q for q in inventory};records={t['question_id']:t for t in texts};proposals=[]
 for cue in cues:
  support=[]
  for c in classifications:
   t=records.get(c['question_id']);q=questions.get(c['question_id'])
   if c['topic_ids'] or not t or not q or t['confidence']<.85 or not valid_text(t['text']):continue
   stem=t['text'].split('?',1)[0][:700]
   if re.search(cue['pattern'],normalize(stem).replace(' ','')):
    support.append({'question_id':q['question_id'],'examId':q['examId'],'evidence':stem})
  seasons=sorted({x['examId'] for x in support})
  if len(seasons)<min_seasons:continue
  proposals.append({'id':cue['id'],'label':cue['label'],'active':False,'status':'proposed_new_wiso_topic','distinct_seasons':len(seasons),'evidence':support})
  for c in classifications:
   if c['question_id'] in {x['question_id'] for x in support}:c['review_reasons']=list(dict.fromkeys(c['review_reasons']+['proposed_new_wiso_topic']))
 return proposals

def pdf_text(root,q):
 """Clip existing text layer in original PDF coordinates; do not rasterize."""
 path=root/'public'/q.get('source_pdf','__missing__')
 if not path.is_file():
  registry=read(root/'public/data/full_pdf_sources.json',{});docs=registry.get('documents',{})
  document_hash=registry.get('questions',{}).get(q.get('question_id'),{}).get('question') or registry.get('aliases',{}).get(q.get('source_pdf')) or q.get('source_sha256','')
  match=docs.get(document_hash) or next((d for d in docs.values() if d.get('filename')==q.get('source_pdf')),None)
  if match:path=root/'public'/match['path']
 if not path.is_file():return ''
 try:
  import pymupdf
  with pymupdf.open(path) as doc:
   regions=q.get('source_regions') or [{'page':q['source_page'],'bbox':q['bounding_box']}]
   return '\n'.join(doc[r.get('page',r.get('source_page',q.get('source_page',1)))-1].get_text('text',clip=pymupdf.Rect(r['bbox'])) for r in regions)
 except (ImportError,KeyError,ValueError,RuntimeError):return ''

def extract(root,item,source,cache,ocr=None):
 crop=root/'public'/item['crop'];digest=hashlib.sha256(crop.read_bytes()).hexdigest() if crop.exists() else 'missing'
 key=cache_key(item['question_source_revision'],digest);path=cache/f'{key}.json'
 saved=read(path)
 if saved:return saved,True
 text=pdf_text(root,source);method='pdf_text';confidence=.9;engine='coordinate_clipped_pdf_text'
 if not valid_text(text):text=item.get('text','');method='existing_text';confidence=min(.9,float(item.get('extraction_confidence',.9)));engine='production_extracted_text'
 if not valid_text(text):
  text='';method='visual_transcription';confidence=0;engine='rapidocr_onnxruntime-1.4.4'
  if ocr and crop.exists():
   result,_=ocr(str(crop))
   if result:text='\n'.join(x[1] for x in result);confidence=round(sum(float(x[2]) for x in result)/len(result),3)
 record={'question_id':item['question_id'],'question_source_revision':item['question_source_revision'],'text':text,'extraction_method':method,'confidence':confidence,'language':'de','reviewed':False,'updated_at':datetime.now(timezone.utc).isoformat(),'evidence':{'crop':item['crop'],'crop_sha256':digest,'cache_key':key,'engine':engine},'review_reasons':[] if valid_text(text) and confidence>=.85 else ['text_needs_review']}
 # Missing extraction is retryable when OCR becomes available.
 if text:write(path,record)
 return record,False

def build(root=ROOT,no_ocr=False):
 inventory=[q for q in read(root/'public/data/question_inventory.json',[]) if q['module']=='wiso'];active={q['question_id'] for q in inventory}
 sources={q['question_id']:q for p in (root/'public/data').glob('*wiso_segmented.json') for q in read(p,{}).get('questions',[])}
 prior=read(root/'public/data/wiso_focus.json',{});old={q['question_id']:q for q in prior.get('classifications',[])}
 cache=root/'data/ingest/wiso-text';ocr=None
 if not no_ocr:
  engine=[None]
  def ocr(path):
   if engine[0] is None:
    from rapidocr_onnxruntime import RapidOCR
    engine[0]=RapidOCR(intra_op_num_threads=2,inter_op_num_threads=2)
   return engine[0](path)
 texts=[];classes=[];skipped=0
 for n,item in enumerate(inventory):
  record,hit=extract(root,item,sources.get(item['question_id'],{}),cache,ocr);texts.append(record);skipped+=hit
  proposal=classify_record(record);proposal.update(question_id=item['question_id'],question_source_revision=item['question_source_revision'])
  proposal['review_reasons']+=record['review_reasons'];classes.append(reconcile(old.get(item['question_id']),proposal))
  print(f'{n+1}/{len(inventory)} {item["question_id"]}: {len(record["text"])} chars, {proposal["topic_ids"]}, cache={hit}',flush=True)
 taxonomy=read(root/'scripts/wiso_taxonomy.json');proposals=propose_topics(inventory,texts,classes,taxonomy.get('proposal_cues',[]));summaries=[];curated_patterns=read(root/'scripts/wiso_patterns.json',{});legal=read(root/'scripts/wiso_legal_verified.json',{})
 for node in taxonomy['nodes']:
  tid=node['id'];children={t['id'] for t in taxonomy['nodes'] if t['parent_id']==tid}|{tid}
  ids=[c['question_id'] for c in classes if children.intersection(c['topic_ids'])]
  if not ids:continue
  patterns=[]
  for text in texts:
   if text['question_id'] not in ids:continue
   # Actual question stems only. Preserve OCR status; never generate fictitious questions.
   candidates=re.findall(r'(?:Welche[rsnm]?|Was|Wer|Wie|Wann|Warum|Nennen|Erlautern|Beschreiben)[^?\n]{12,180}\??',text['text'],re.I)
   for stem in candidates[:1]:
    if stem.endswith('?'):patterns.append({'text':stem,'question_ids':[text['question_id']]})
   if len(patterns)>=3:break
  curated=[{'text':p['text'],'question_ids':[qid for qid in p['question_ids'] if qid in ids]} for child in sorted(children) for p in curated_patterns.get(child,[])]
  curated=[p for p in curated if p['question_ids']]
  if curated:patterns=curated[:3]
  summary={'topic_id':tid,'bullets':node.get('bullets',[]) or [b for child in taxonomy['nodes'] if child['parent_id']==tid for b in child.get('bullets',[])][:3],'patterns':patterns,'question_ids':ids,'provenance':'historical_exam_summary','legal_freshness':{'relevant':node.get('legal',True),'reviewed_at':None,'review_needed':node.get('legal',True)}}
  if tid in legal:summary.update(legal[tid])
  summaries.append(summary)
 input_hashes={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in ['public/data/question_inventory.json','scripts/wiso_taxonomy.json','scripts/wiso_patterns.json','scripts/wiso_legal_verified.json'] if (root/name).exists()}
 result={'proposed_topics':proposals,'input_hashes':input_hashes,'schema_version':1,'version':VERSION,'taxonomy':taxonomy,'texts':texts,'classifications':classes,'summaries':summaries,'retired_texts':prior.get('retired_texts',[])+[t for t in prior.get('texts',[]) if t['question_id'] not in active],'retired_classifications':prior.get('retired_classifications',[])+[v for k,v in old.items() if k not in active],'config':{'recentSeasonCount':4,'minAccuracyQuestions':3,'weakAccuracy':60,'relevance':{'questionWeight':.4,'seasonWeight':.4,'recentWeight':.2,'veryHigh':.7,'high':.5,'medium':.25},'priority':{'relevanceWeight':1,'needWeight':2,'weaknessWeight':1,'unpracticedBonus':.25}}}
 write(root/'public/data/wiso_focus.json',result)
 report={'proposed_topics':len(proposals),'inventory':len(inventory),'seasons':len({q['examId'] for q in inventory}),'usable_text':sum(valid_text(t['text']) for t in texts),'classified':sum(bool(c['topic_ids']) for c in classes),'unclassified':sum(not c['topic_ids'] for c in classes),'text_review':sum(bool(t['review_reasons']) for t in texts),'cache_hits':skipped,'methods':dict(Counter(t['extraction_method'] for t in texts)),'source_files_modified':0,'pdf_pages_rendered':0,'topics':{n['id']:sum(n['id'] in c['topic_ids'] for c in classes) for n in taxonomy['nodes']}}
 ranking=[]
 for node in taxonomy['nodes']:
  children={n['id'] for n in taxonomy['nodes'] if n['parent_id']==node['id']}|{node['id']}
  members={c['question_id'] for c in classes if children.intersection(c['topic_ids'])}
  seasons=sorted({q['examId'] for q in inventory if q['question_id'] in members})
  ranking.append({'topic_id':node['id'],'questions':len(members),'distinct_seasons':len(seasons),'seasons':seasons,'question_ids':sorted(members)})
 report['ranking']=sorted(ranking,key=lambda r:(-r['distinct_seasons'],-r['questions'],r['topic_id']))
 report['classification_status']='Machine proposals; targeted visual audit only. Topic overlap is intentional; counts are distinct question IDs, never word counts.'
 write(root/'docs/evidence/phase3d/pipeline-report.json',report);print(json.dumps({k:v for k,v in report.items() if k!='ranking'},indent=2));return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--no-ocr',action='store_true');args=p.parse_args();build(no_ocr=args.no_ocr)
