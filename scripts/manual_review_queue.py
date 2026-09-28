"""Build source-bound review items from existing official output; legacy defaults preserved."""
from pathlib import Path
from copy import deepcopy
from ingest import read,save
from answers import artifact_digest
from portrait_dataset import objhash
SCOPE='winter-2018-19-ap-fa'
TARGETS={'arbeitsplanung':[3,9,10,22,24],'funktionsanalyse':[7,21,27]}

def queue(root,*,scope=SCOPE,targets=None,exam='2018_19_winter'):
 root=Path(root);items=[]
 for module,numbers in (TARGETS if targets is None else targets).items():
  prefix=f'{exam}_{module}';data=read(root/f'public/data/{prefix}_answers.json')
  for n in numbers:
   original=next(r for r in data['answers'] if r['question_number']==n);item=deepcopy(original)
   item['source_crop_sha256']=artifact_digest(root/'public'/item['source_crop']);item['evidence_hash']=objhash(original);item['overlay']=data['overlay']
   # The cached answer record supplies analysis coordinates and PDF-point crop bbox.
   cache=read(root/f'data/ingest/registered-{item["source_pdf_sha256"][:24]}_source_manifest.json');height=cache['pages'][str(item['source_page'])]['geometry'][1]
   box=item['answer_bbox'];item['row_positions']=[(next(m['center'][1] for m in item['measurements'] if m['row']==row)*height/item['analysis_size'][1]-box[1])/(box[3]-box[1])*100 for row in range(1,6)]
   items.append(item)
 return {'schema_version':1,'scope':scope,'items':items}
if __name__=='__main__':
 root=Path(__file__).resolve().parents[1];data=queue(root);save(root/'public/data/manual_answer_review_queue.json',data);print(f'{len(data["items"])} source-bound items; no PDF scan')
