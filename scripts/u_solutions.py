"""Hash-bound Arbeitsplanung U1–U8 source crops only; no OCR or other-module extraction."""
import hashlib
import json
from pathlib import Path
import pymupdf
from PIL import Image
from ingest import digest, lock, read, save
from answers import DOC, artifact_digest, artifacts_valid

VERSION='2a.1'
SOURCE_HASH='1bca5421b9553e59df7103d82bfa3bbb45243009b2e09bcd9c4f3904fe1d9bd4'
REGIONS={
 'U1':[(6,[632,120,1157,506])],
 'U2':[(7,[26,18,553,429])],
 'U3':[(7,[26,430,553,634])],
 'U4':[(8,[630,123,1158,815]),(9,[25,22,552,158])],
 'U5':[(9,[25,160,552,401])],
 'U6':[(9,[25,402,552,588])],
 'U7':[(9,[25,590,552,733])],
 'U8':[(9,[632,126,1155,325])],
}
LABELS={
 'U1':['1 · Vier Maßnahmen zur Gefahrenvorsorge','2 · Vier Maßnahmen bei einem Arbeitsunfall','3 · Bedeutung der beiden Schilder'],
 'U2':['1 · Drei Anforderungen an Führungen','2 · Gleitführungen benennen','3 · Eigenschaften von Gleit- und Wälzführungen'],
 'U3':['1 · Fügeverfahren','2 · Vorteil des Werkstoffs CuSn','3 · Flächenpressung berechnen und Dimensionierung beurteilen'],
 'U4':['1 · Hydraulikschaltplan ergänzen','2 · Druck in MPa und bar berechnen'],
 'U5':['1 · Drei Prüfungen vor dem Pumpeneinbau','2 · Mindestinnendurchmesser und Rohrwahl','3 · Umweltschutz beim Ölwechsel'],
 'U6':['1 · Widerstandsverhalten','2 · NTC-Widerstand bei 60 °C','3 · Potenziometer einstellen'],
 'U7':['1 · Bemessungsstrom I','2 · Leiterquerschnitt berechnen','3 · Bemessungsstrom der Schutzeinrichtung'],
 'U8':['1 · Arbeitssicherheit beim Weichlöten','2 · Zwei Anweisungen übersetzen','3 · Passendes Lot'],
}
NUMERIC={'value':18.68,'unit':'A','tolerance':.02,'tolerance_policy':'Übungstoleranz ±0,02 A; keine offizielle Punktevergabe.',
 'evidence':'Lösung PDF page 9, left, U7.1: 18,68 A; visually checked against original crop.'}
CONFIG_HASH=hashlib.sha256(json.dumps([REGIONS,LABELS,NUMERIC],sort_keys=True).encode()).hexdigest()
REVISION=VERSION+'-'+CONFIG_HASH[:12]


def run(root):
 root=Path(root);pdf=root/f'public/assets/pdfs/{DOC}.pdf'
 if digest(pdf)!=SOURCE_HASH: raise ValueError('Unknown source; validate template before extracting')
 key=f'{SOURCE_HASH}:{VERSION}:{CONFIG_HASH}'
 manifest_path=root/'data/ingest/u_solution_manifest.json'
 output='data/exams/2017_sommer_arbeitsplanung_u_solutions.json';public='public/data/2017_sommer_arbeitsplanung_u_solutions.json'
 with lock(root):
  manifest=read(manifest_path,{'entries':{}});entry=manifest['entries'].get(key,{})
  if entry.get('status')=='complete' and artifacts_valid(root,entry.get('artifacts')):
   return {'status':'skipped','questions_processed':0}
  exam=read(root/'data/exams/2017_sommer_arbeitsplanung_segmented.json')
  records=[];processed=0
  for number,regions in REGIONS.items():
   folder=Path(f'assets/u-solutions/{REVISION}');(root/'public'/folder).mkdir(parents=True,exist_ok=True)
   checkpoint=root/f'data/ingest/u-solutions/{REVISION}/{number}.json'
   cached=read(checkpoint)
   if cached and cached.get('key')==key and artifacts_valid(root,cached.get('artifacts')):
    records.append(cached['record']);continue
   matches=[q for q in exam['questions'] if q['question_number']==number and q['module']=='Arbeitsplanung']
   if len(matches)!=1: raise ValueError('Uncertain question identity: '+number)
   images=[]
   with pymupdf.open(pdf) as doc:
    for page,box in regions:
     rect=pymupdf.Rect(box);assert doc[page-1].rect.contains(rect)
     pix=doc[page-1].get_pixmap(clip=rect,dpi=180,colorspace=pymupdf.csRGB)
     images.append(Image.frombytes('RGB',(pix.width,pix.height),pix.samples))
   combined=Image.new('RGB',(max(im.width for im in images),sum(im.height for im in images)+20*(len(images)-1)),'white');y=0
   for im in images: combined.paste(im,(0,y));y+=im.height+20
   crop=(folder/(number+'.png')).as_posix();combined.save(root/'public'/crop)
   parts=[{'id':str(i+1),'label':label,'type':'drawing' if number=='U4' and i==0 else 'numeric' if number=='U7' and i==0 else 'short_text'} for i,label in enumerate(LABELS[number])]
   if number=='U7': parts[0]['numeric']=NUMERIC
   record={'question_id':matches[0]['question_id'],'question_number':number,'exam':exam['exam'],'module':'Arbeitsplanung',
    'solution_source_pdf':f'assets/pdfs/{DOC}.pdf','solution_source_page':regions[0][0],
    'solution_bbox':regions[0][1],'regions':[{'source_page':p,'bbox':b} for p,b in regions],
    'cropped_solution_image':crop,'bbox_units':'PDF points, top-left origin','review_status':'auto_ready',
    'answer_type':'multi_part','subparts':parts,'source_hash':SOURCE_HASH,'extractor_revision':REVISION,
    'association_evidence':'Module headers, printed continuation pages 3–7, U number and original task matched visually. Adjacent Funktionsanalyse regions excluded.'}
   save(checkpoint,{'key':key,'record':record,'artifacts':{'public/'+crop:artifact_digest(root/'public'/crop)}})
   records.append(record);processed+=1
  result={'schema_version':1,'exam':exam['exam'],'module':'Arbeitsplanung','extractor_revision':REVISION,'solutions':records}
  save(root/output,result);save(root/public,result)
  paths=[output,public]+['public/'+r['cropped_solution_image'] for r in records]
  manifest['entries'][key]={'status':'complete','scope':'2017 Sommer Arbeitsplanung U1-U8','source_hash':SOURCE_HASH,'version':VERSION,'config_hash':CONFIG_HASH,'artifacts':{p:artifact_digest(root/p) for p in paths}}
  save(manifest_path,manifest)
  return {'status':'processed','questions_processed':processed,'solutions':len(records),'source_pages':[6,7,8,9]}


if __name__=='__main__': print(json.dumps(run(Path(__file__).resolve().parents[1]),indent=2))
