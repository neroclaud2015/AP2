"""FA U1-U8 official source crops, independently verified mixed-module page regions."""
from pathlib import Path
import hashlib
import json
import pymupdf
from PIL import Image
from answers import DOC,artifact_digest,artifacts_valid
from fa_answers import SOURCE_HASH
from ingest import read,save,lock,digest
from fa_dataset import validated_dataset,record_digest

VERSION='2b.2.2'
REGIONS={'U1':[(7,[632,121,1165,232])],'U2':[(7,[632,232,1165,360])],
 'U3':[(7,[632,360,1165,500])],'U4':[(7,[632,500,1165,795])],
 'U5':[(6,[25,15,555,318])],'U6':[(6,[25,318,555,630])],
 'U7':[(6,[25,630,555,802])],'U8':[(5,[632,122,1165,260])]}
COUNTS={'U1':3,'U2':3,'U3':4,'U4':3,'U5':2,'U6':3,'U7':3,'U8':4}
CONFIG={'regions':REGIONS,'subpart_counts':COUNTS,'drawings':[['U4','3'],['U5','1']],
 'association_evidence':'FA module title on physical page5 right and page7 right; printed U1-U8 headings and booklet order pages9/10/11. Physical page6 left continues FA, excluding AP right. Official numbered subparts visually verified; no scoring rubric inferred.'}
CONFIG_HASH=hashlib.sha256(json.dumps(CONFIG,sort_keys=True).encode()).hexdigest();REVISION='fa-'+VERSION+'-'+CONFIG_HASH[:12]

def run(root):
 root=Path(root);pdf=root/f'public/assets/pdfs/{DOC}.pdf'
 if digest(pdf)!=SOURCE_HASH:raise ValueError('Unknown official source')
 exam,identity_hash=validated_dataset(root)
 key=SOURCE_HASH+':'+VERSION+':'+CONFIG_HASH+':'+identity_hash;manifest_path=root/'data/ingest/fa_u_solution_manifest.json'
 with lock(root):
  manifest=read(manifest_path,{'entries':{}});old=manifest['entries'].get(key,{})
  if old.get('status')=='complete' and artifacts_valid(root,old.get('artifacts')):return {'status':'skipped','questions_processed':0}
  records=[];processed=0;doc=None
  try:
   for number,regions in REGIONS.items():
    checkpoint=root/f'data/ingest/fa-u-solutions/{REVISION}/{number}.json';cached=read(checkpoint)
    if cached and cached['key']==key:
     if cached.get('record_hash')!=record_digest(cached['record']):raise ValueError('U checkpoint metadata integrity failure')
     if artifacts_valid(root,cached.get('artifacts')):records.append(cached['record']);continue
    matches=[q for q in exam['questions'] if q['question_number']==number]
    if len(matches)!=1:raise ValueError('Uncertain FA U identity')
    if doc is None:doc=pymupdf.open(pdf)
    panels=[]
    for page,box in regions:
     if not doc[page-1].rect.contains(pymupdf.Rect(box)):raise ValueError('U region outside page')
     pix=doc[page-1].get_pixmap(clip=pymupdf.Rect(box),dpi=180,colorspace=pymupdf.csRGB)
     panels.append(Image.frombytes('RGB',(pix.width,pix.height),pix.samples))
    im=Image.new('RGB',(max(p.width for p in panels),sum(p.height for p in panels)+20*(len(panels)-1)),'white');y=0
    for p in panels:im.paste(p,(0,y));y+=p.height+20
    crop=f'assets/u-solutions/{REVISION}/{number}.png';(root/'public'/crop).parent.mkdir(parents=True,exist_ok=True);im.save(root/'public'/crop)
    parts=[{'id':str(n),'label':f'{n} · Teilaufgabe {n}','type':'drawing' if [number,str(n)] in CONFIG['drawings'] else 'short_text'} for n in range(1,COUNTS[number]+1)]
    record={'question_id':matches[0]['question_id'],'question_number':number,'exam':'2017_sommer','module':'Funktionsanalyse',
      'solution_source_pdf':f'assets/pdfs/{DOC}.pdf','solution_source_page':regions[0][0],'solution_bbox':regions[0][1],
      'regions':[{'source_page':p,'bbox':b} for p,b in regions],'cropped_solution_image':crop,
      'bbox_units':'PDF points, top-left origin','review_status':'auto_ready','answer_type':'multi_part','subparts':parts,
      'source_hash':SOURCE_HASH,'extractor_revision':REVISION,'association_evidence':CONFIG['association_evidence'],
      'grading_policy':'User self-assessment only; no point rubric or numeric tolerance inferred.'}
    save(checkpoint,{'key':key,'record':record,'record_hash':record_digest(record),'artifacts':{'public/'+crop:artifact_digest(root/'public'/crop)}})
    records.append(record);processed+=1
  finally:
   if doc:doc.close()
  result={'schema_version':1,'exam':'2017_sommer','module':'Funktionsanalyse','extractor_revision':REVISION,'solutions':records}
  outputs=['data/exams/2017_sommer_funktionsanalyse_u_solutions.json','public/data/2017_sommer_funktionsanalyse_u_solutions.json']
  for p in outputs:save(root/p,result)
  paths=outputs+['public/'+r['cropped_solution_image'] for r in records]
  manifest['entries'][key]={'status':'complete','source_hash':SOURCE_HASH,'version':VERSION,'config_hash':CONFIG_HASH,'identity_hash':identity_hash,'artifacts':{p:artifact_digest(root/p) for p in paths}}
  save(manifest_path,manifest)
  return {'status':'processed','questions_processed':processed,'source_pages':[5,6,7],'solutions':8}

if __name__=='__main__':print(json.dumps(run(Path(__file__).resolve().parents[1]),indent=2))
