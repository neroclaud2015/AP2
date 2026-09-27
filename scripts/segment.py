"""Explicitly scoped Phase 1.5 segmentation; never calls archive ingestion."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import cv2
import numpy as np
from PIL import Image
import pymupdf
from ingest import save, read, digest, lock, now

# Backward-compatible API: layout decisions live in the frozen AP profile.
from layout_profiles.ap_2017 import (
    VERSION, DOCUMENT, CONFIG, CONFIG_HASH, REVISION, question_identity,
    assess_coverage, suspected_label, assign_cells, region_text, detect_seams,
    LabelOCR, label_at, detect_page,
)

def crop_question(pdfpage, regions, target):
    box=[min(r[0] for r in regions),min(r[1] for r in regions),max(r[2] for r in regions),max(r[3] for r in regions)]
    scale=CONFIG['dpi']/72
    canvas=Image.new('RGB',(round((box[2]-box[0])*scale),round((box[3]-box[1])*scale)), 'white')
    for region in regions:
        pix=pdfpage.get_pixmap(matrix=pymupdf.Matrix(scale,scale),clip=pymupdf.Rect(region),alpha=False)
        image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
        size=(round((region[2]-region[0])*scale),round((region[3]-region[1])*scale))
        canvas.paste(image.resize(size), (round((region[0]-box[0])*scale),round((region[1]-box[1])*scale)))
    target.parent.mkdir(parents=True,exist_ok=True)
    temp=target.with_suffix('.tmp.png'); canvas.save(temp); os.replace(temp,target)
    return [round(v,2) for v in box]

def materialize(root, entry, records):
    questions=[q for record in records for q in record['questions']]
    questions.sort(key=lambda q:(q['question_number'].startswith('U'),int(q['question_number'].lstrip('U'))))
    seen=set()
    for q in questions:
        if q['question_id'] in seen: raise ValueError('Duplicate detected label; refuse ambiguous publication')
        seen.add(q['question_id'])
    instructions=read(root/f'data/ingest/pages/{DOCUMENT}/002.json')
    source_text=' '.join(line['text'] for line in instructions['lines'])
    a=re.search(r'(\d+)\s+gebundenen\s+Aufgaben',source_text)
    b=re.search(r'(\d+)\s+ungebundenen\s+Aufgaben',source_text)
    if not a or not b: raise ValueError('Cannot verify question counts from original instructions')
    expected={str(i) for i in range(1,int(a.group(1))+1)} | {'U'+str(i) for i in range(1,int(b.group(1))+1)}
    coverage=assess_coverage(questions,expected)
    queue=[{'question_id':q['question_id'],'reasons':q['review_reasons']} for q in questions if q['review_status']=='needs_review']
    legacy=read(root/'public/data/2017_sommer.json')
    solution=next(d for d in legacy['documents'] if d['module']=='Solutions')
    data={'schema_version':2,'exam':'2017_sommer','module':'Arbeitsplanung','document_id':DOCUMENT,
          'extractor_version':VERSION,'segmentation_revision':REVISION,'source_sha256':entry['sha256'],
          'source_pdf':entry['public_pdf'],'questions':questions,'review_queue':queue,'coverage':coverage,
          'unresolved_regions':[r for record in records for r in record['layout']['unresolved']],
          'pages_processed':len(records),'pages_total':entry['pages_total'],'solution_document':solution,
          'source_pages':next(d['pages'] for d in legacy['documents'] if d['id']==DOCUMENT),
          'confidence_note':'Heuristic layout confidence, not a calibrated probability. Auto-ready is not human-confirmed.',
          'scope':'Only 2017 Sommer Arbeitsplanung; no other document reprocessed.'}
    save(root/'data/exams/2017_sommer_arbeitsplanung_segmented.json',data)
    save(root/'public/data/2017_sommer_arbeitsplanung_segmented.json',data)
    return data

from layout_profiles import select_profile
from segmentation_engine import analyze_page

def run(root, document, max_pages=None):
    root=Path(root).resolve()
    if document!=DOCUMENT: raise ValueError('Phase 1.5 permits only 2017 Sommer Arbeitsplanung')
    if max_pages is not None and max_pages<1: raise ValueError('max-pages must be positive')
    with lock(root):
        entry=read(root/'data/ingest/manifest.json')['documents'][document]
        if digest(root/entry['file'])!=entry['sha256']: raise ValueError('Immutable source changed')
        profile=select_profile('2017_sommer','Arbeitsplanung',entry['sha256'])
        path=root/'data/ingest/segmentation_manifest.json'
        manifest=read(path,{'schema_version':1,'documents':{}})
        versions=manifest['documents'].setdefault(document,{'source_sha256':entry['sha256'],'versions':{}})['versions']
        key=entry['sha256'][:16]+'-'+REVISION
        state=versions.setdefault(key,{'extractor_version':VERSION,'config_hash':CONFIG_HASH,'pages':{},'status':'pending'})
        processed=0; ocr=LabelOCR(); pdf=None
        try:
            for n in range(1,entry['pages_total']+1):
                recordpath=root/f'data/segmentation/{document}/{REVISION}/{n:03}.json'
                if str(n) in state['pages']:
                    continue
                if max_pages is not None and processed>=max_pages: break
                record=read(recordpath)
                if record is None:
                    raw=read(root/f'data/ingest/pages/{document}/{n:03}.json')
                    image=np.array(Image.open(root/'public'/raw['source_image']).convert('RGB'))
                    proposals,layout=analyze_page(profile,raw,image,ocr)
                    questions=[]
                    if proposals and pdf is None: pdf=pymupdf.open(root/entry['file'])
                    for proposal in proposals:
                        number=proposal['number']; qid=question_identity(document,n,proposal)
                        crop=f'assets/questions/{document}/{REVISION}/{qid}.png'
                        bbox=crop_question(pdf[n-1],proposal['regions'],root/'public'/crop)
                        questions.append({'question_id':qid,'exam':'2017_sommer','module':'Arbeitsplanung','question_number':number,
                            'source_pdf':entry['public_pdf'],'source_page':n,'source_page_image':raw['source_image'],
                            'source_size':[raw['width'],raw['height']],'bounding_box':bbox,'regions':proposal['regions'],
                            'cropped_question_image':crop,'extracted_text':region_text(raw['lines'],proposal['regions']),
                            'extraction_confidence':round(proposal['confidence'],3),'label_evidence':proposal['evidence'],
                            'review_status':'auto_ready' if proposal['confidence']>=CONFIG['review_threshold'] else 'needs_review',
                            'review_reasons':proposal['reasons'],'extractor_version':VERSION,'segmentation_revision':REVISION,
                            'tags':[],'solution_page':None,'solution_confirmed':False})
                    record={'schema_version':1,'source_sha256':entry['sha256'],'revision':REVISION,'page':n,'layout':layout,'questions':questions}
                    save(recordpath,record)
                    processed+=1
                state['pages'][str(n)]={'record':str(recordpath.relative_to(root)).replace('\\','/'),'completed_at':now()}
                state['status']='partially_complete'; save(path,manifest)
                print(f'Checkpoint page {n}: {len(record["questions"])} questions',flush=True)
        finally:
            if pdf: pdf.close()
        state['status']='complete' if len(state['pages'])==entry['pages_total'] else 'partially_complete'
        state['updated_at']=now(); manifest['documents'][document]['active_revision']=key; save(path,manifest)
        records=[read(root/info['record']) for _,info in sorted(state['pages'].items(),key=lambda item:int(item[0]))]
        data=materialize(root,entry,records)
        result={'processed_now':processed,'pages_complete':len(records),'questions':len(data['questions']),
                'needs_review':len(data['review_queue']),'revision':REVISION}
        save(root/'data/segmentation/last_run.json',result)
        return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--document',required=True,choices=[DOCUMENT])
    parser.add_argument('--max-pages',type=int)
    args=parser.parse_args()
    print(json.dumps(run(args.root,args.document,args.max_pages),indent=2))
