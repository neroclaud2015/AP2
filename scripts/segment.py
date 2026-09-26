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

VERSION = '1.5.3'
DOCUMENT = '35c77ffdb630f70057e4cfb8'
CONFIG = {'layout': 'ihk-ap2-imposed-three-band-v1', 'dpi': 180, 'review_threshold': .90,
          'body_x': [48, 297, 555], 'body_y': [50, 293, 533, 782]}
CONFIG_HASH = hashlib.sha256(json.dumps(CONFIG, sort_keys=True).encode()).hexdigest()[:12]
REVISION = VERSION + '-' + CONFIG_HASH

def question_identity(document, page, proposal):
    return f"{document}-p{page}-{proposal['anchor']}"


def assess_coverage(questions, expected):
    actual = {q['question_number'] for q in questions}
    missing = sorted(expected - actual)
    unexpected = sorted(actual - expected)
    if missing or unexpected:
        for question in questions:
            question['review_status'] = 'needs_review'
            question['extraction_confidence'] = min(question['extraction_confidence'], .6)
            question['review_reasons'] = list(set(question['review_reasons'] + ['question_coverage_mismatch']))
    return {'expected_count': len(expected), 'observed_count': len(questions), 'missing': missing, 'unexpected': unexpected}


def suspected_label(raw, x, y):
    return any(len(line['text'].strip()) <= 4 and abs(line['bbox'][0]-x)<14 and
               y-8<=line['bbox'][1]<=y+24 and line['bbox'][3]-line['bbox'][1]>=18
               for line in raw['lines'])


def assign_cells(markers, xs, ys, workspaces=None):
    """Partition each printed band, continuing an earlier owner through L shapes."""
    owners = [None, None]
    rectangles = {}
    for row in range(len(ys) - 1):
        current = {m['col']: m['number'] for m in markers if m['row'] == row}
        if 0 in current:
            owners = [current[0], current.get(1, current[0])]
        elif 1 in current:
            owners[1] = current[1]
        for col in (0, 1):
            if workspaces and (row, col) in workspaces:
                owners[col] = workspaces[(row, col)]
        if owners[0] and owners[0] == owners[1]:
            rectangles.setdefault(owners[0], []).append([xs[0], ys[row], xs[2], ys[row + 1]])
        else:
            for col, owner in enumerate(owners):
                if owner:
                    rectangles.setdefault(owner, []).append([xs[col], ys[row], xs[col + 1], ys[row + 1]])
    for number, regions in rectangles.items():
        merged = []
        for box in regions:
            if merged and merged[-1][0] == box[0] and merged[-1][2] == box[2] and merged[-1][3] == box[1]:
                merged[-1][3] = box[3]
            else:
                merged.append(box.copy())
        rectangles[number] = merged
    return rectangles

def region_text(lines, regions):
    selected = []
    for line in lines:
        a, b, c, d = line['bbox']
        if any(x0 <= (a+c)/2 < x1 and y0 <= (b+d)/2 < y1 for x0,y0,x1,y1 in regions):
            selected.append(line)
    return '\n'.join(line['text'] for line in sorted(selected, key=lambda l: (round(l['bbox'][1]/6), l['bbox'][0])))

def detect_seams(image, offset, scale, nominal):
    """Snap template band boundaries to observed long printed separators."""
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 70, 180)
    lines = cv2.HoughLinesP(edges, 1, np.pi/1800, 100, minLineLength=175*scale, maxLineGap=12*scale)
    seams, supported = list(nominal), []
    for index in (1, 2):
        found = []
        for segment in ([] if lines is None else np.asarray(lines).reshape(-1,4)):
            x0,y0,x1,y1 = [float(v)/scale for v in segment]
            if abs(y1-y0) < 4 and abs((y0+y1)/2 - nominal[index]) < 13:
                start, end = min(x0,x1), max(x0,x1)
                if offset+40 <= start <= offset+310 and end <= offset+565 and end-start > 180:
                    found.append(((y0+y1)/2, end-start))
        if found:
            seams[index] = round(max(found, key=lambda item:item[1])[0], 1)
            supported.append(index)
    return seams, supported

class LabelOCR:
    def __init__(self): self.engine = None
    def __call__(self, patch):
        if self.engine is None:
            from rapidocr_onnxruntime import RapidOCR
            self.engine = RapidOCR(intra_op_num_threads=2, inter_op_num_threads=2)
        return self.engine(patch, use_det=False, use_cls=False)[0] or []

def label_at(image, raw, x, y, ocr):
    pdf = []
    for line in raw['lines']:
        text = line['text'].strip()
        box = line['bbox']
        if re.fullmatch(r'\d{1,2}', text) and 1 <= int(text) <= 28 and abs(box[0]-x) < 14 and y-8 <= box[1] <= y+24 and box[3]-box[1] >= 16:
            pdf.append((text, box))
    if len(pdf) == 1:
        return {'number': pdf[0][0], 'label_confidence': .96, 'evidence': 'pdf_heading_size_and_position', 'label_box': pdf[0][1]}
    sx, sy = image.shape[1]/raw['width'], image.shape[0]/raw['height']
    x0,y0,x1,y1 = [int(v) for v in ((x-6)*sx, y*sy, (x+40)*sx, (y+40)*sy)]
    patch = image[y0:y1,x0:x1]
    bw = (cv2.cvtColor(patch, cv2.COLOR_RGB2GRAY)<150).astype('uint8')*255
    contours,_ = cv2.findContours(bw,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    for contour in sorted(contours,key=cv2.contourArea,reverse=True):
        xx,yy,w,h = cv2.boundingRect(contour)
        extent=cv2.contourArea(contour)/max(1,w*h)
        if 20<w<65 and 18<h<50 and extent>.6 and yy<25:
            inverted=255-patch[yy+2:yy+h-2,xx+2:xx+w-2]
            padded=cv2.copyMakeBorder(inverted,10,10,10,10,cv2.BORDER_CONSTANT,value=(255,255,255))
            for text, confidence in ocr(padded):
                if re.fullmatch(r'\d{1,2}',text) and 1<=int(text)<=28 and confidence>.80:
                    return {'number':text,'label_confidence':round(float(confidence),3),'evidence':'inverted_label_ocr',
                            'label_box':[(x0+xx)/sx,(y0+yy)/sy,(x0+xx+w)/sx,(y0+yy+h)/sy]}
    # Conventional number omitted by the embedded text layer (e.g. 8 read as I).
    head=patch[:int(27*sy),:int(34*sx)]
    for text, confidence in ocr(cv2.copyMakeBorder(head,8,8,8,8,cv2.BORDER_CONSTANT,value=(255,255,255))):
        if re.fullmatch(r'\d{1,2}',text) and 1<=int(text)<=28 and confidence>.83:
            return {'number':text,'label_confidence':round(float(confidence),3),'evidence':'label_ocr',
                    'label_box':[x,y,x+34,y+27]}
    return None

def detect_page(raw, image, ocr):
    if raw['width'] < raw['height']:
        return [], {'kind':'attachment','unresolved':[]}
    results, unresolved = [], []
    half=raw['width']/2
    for side in range(2):
        offset=side*half
        ulabels=[l for l in raw['lines'] if re.fullmatch(r'U[1-8]',l['text'].strip()) and offset+15<l['bbox'][0]<offset+90 and l['bbox'][1]<60]
        if ulabels:
            for label in ulabels:
                results.append({'number':label['text'].strip(),'regions':[[offset+20,15,offset+half-20,808]],
                                'confidence':.96,'reasons':[],'anchor':f'h{side}-U','evidence':'U_heading_and_booklet_half','label_box':label['bbox']})
            continue
        # Cover/instruction half-pages contain no question body at the row anchors.
        halftext=region_text(raw['lines'],[[offset,0,offset+half,raw['height']]])
        if 'Vorgabezeit' in halftext or 'Schriftliche' in halftext or 'Markierungsbogens' in halftext and side==0:
            continue
        ys,seam_evidence=detect_seams(image,offset,image.shape[1]/raw['width'],CONFIG['body_y'])
        xs=[offset+x for x in CONFIG['body_x']]
        markers=[]
        for row in range(3):
            for col in range(2):
                label=label_at(image,raw,offset+(54 if col==0 else 300),ys[row]+2,ocr)
                if label:
                    markers.append({**label,'row':row,'col':col})
                elif suspected_label(raw,offset+(54 if col==0 else 300),ys[row]+2):
                    unknown=f'UNRESOLVED-{side}-{row}-{col}'
                    markers.append({'number':unknown,'row':row,'col':col,'label_box':[offset+(54 if col==0 else 300),ys[row]+8,offset+340,ys[row]+30]})
                    unresolved.append({'anchor':f'h{side}-r{row}-c{col}','reason':'unreadable_heading','source_page':raw['source_page']})
        # Heading baselines provide a second boundary observation when scanned rules fragment.
        for row in (1,2):
            heads=[m['label_box'][1] for m in markers if m['row']==row]
            if heads:
                ys[row]=round(min(heads)-5,1)
        workspaces = {}
        for line in raw['lines']:
            match = re.search(r'Nebenrechnung Aufgabe\s+(\d+)\s*[:;]', line['text'])
            if match and match.group(1) in {m['number'] for m in markers}:
                x,y = line['bbox'][:2]
                if xs[0] <= x < xs[-1]:
                    col = 0 if x < xs[1] else 1
                    row = next((r for r in range(3) if ys[r] <= y < ys[r+1]), None)
                    if row is not None:
                        workspaces[(row,col)] = match.group(1)
        regions=assign_cells(markers,xs,ys,workspaces)
        for marker in markers:
            if marker['number'].startswith('UNRESOLVED'): continue
            areas=regions[marker['number']]
            reasons=[]
            confidence=min(.96,marker['label_confidence'])
            if len(areas)>1:
                confidence=min(confidence,.84); reasons.append('non_rectangular_layout')
            if len(seam_evidence)<2:
                confidence=min(confidence,.93)
            if marker['evidence']=='label_ocr':
                confidence=min(confidence,.89); reasons.append('single_ocr_label_evidence')
            if marker['label_confidence']<.90:
                reasons.append('uncertain_question_number')
            results.append({'number':marker['number'],'regions':areas,'confidence':confidence,'reasons':reasons,
                            'anchor':f'h{side}-r{marker["row"]}-c{marker["col"]}','evidence':marker['evidence'],'label_box':marker['label_box']})
    return results,{'kind':'question_page' if results else 'context','unresolved':unresolved}

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

def run(root, document, max_pages=None):
    root=Path(root).resolve()
    if document!=DOCUMENT: raise ValueError('Phase 1.5 permits only 2017 Sommer Arbeitsplanung')
    if max_pages is not None and max_pages<1: raise ValueError('max-pages must be positive')
    with lock(root):
        entry=read(root/'data/ingest/manifest.json')['documents'][document]
        if digest(root/entry['file'])!=entry['sha256']: raise ValueError('Immutable source changed')
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
                    proposals,layout=detect_page(raw,image,ocr)
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
