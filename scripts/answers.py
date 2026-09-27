"""One hash-bound official mark grid. Never opens questions or infers answers from text."""
import argparse
import hashlib
import json
from pathlib import Path
import cv2
import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFont
from ingest import digest, lock, now, read, save

VERSION = '1.6.0'
DOC = 'ea47a013956459b9cf4c907b'
LAYOUT = {
    'scope': '2017 Sommer/Arbeitsplanung/Teil A', 'page': 2,
    'verified_pdf_sha256': '1bca5421b9553e59df7103d82bfa3bbb45243009b2e09bcd9c4f3904fe1d9bd4',
    'page_points': [595,842], 'reference_dpi': 120,
    'header_evidence': 'Visually verified numbered column template, bound to exact official PDF hash. No answer values in template.',
    'groups': [
        {'start':1,'count':10,'x':133.5,'dx':57.6,'y':412.5,'dy':18.65,'slope':-.15,'header_y':386},
        {'start':11,'count':10,'x':132,'dx':57.8,'y':525,'dy':18.85,'slope':-.15,'header_y':498},
        {'start':21,'count':8,'x':130.5,'dx':58.1,'y':638.5,'dy':19.15,'slope':-.15,'header_y':611},
    ],
    'ring_radius': [8,11.8], 'min_ring_ink': .45, 'min_angular_support': .75,
    'min_center_ink': .12, 'min_margin': .12,
}
LAYOUT_HASH = hashlib.sha256(json.dumps(LAYOUT,sort_keys=True).encode()).hexdigest()
REVISION = VERSION+'-'+LAYOUT_HASH[:12]


def detect_column(gray, centers, number_verified=True):
    """Five centers in top-to-bottom order, at reference 120 dpi. No answer OCR."""
    bw = cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,9)>0
    measurements=[]
    reasons=[]
    if len(centers)!=5 or any(centers[i+1][1]<=centers[i][1] for i in range(len(centers)-1)):
        return {'official_answer':None,'status':'needs_review','confidence':0,'review_reasons':['invalid_five_row_structure'],'measurements':[]}
    for row,(x,y) in enumerate(centers,1):
        xx,yy=np.meshgrid(np.arange(round(x)-13,round(x)+14),np.arange(round(y)-13,round(y)+14))
        if xx.min()<0 or yy.min()<0 or xx.max()>=gray.shape[1] or yy.max()>=gray.shape[0]:
            reasons.append('position_outside_page'); break
        radius=np.hypot(xx-x,yy-y)
        annulus=(radius>=LAYOUT['ring_radius'][0])&(radius<=LAYOUT['ring_radius'][1])
        ink=bw[yy,xx]
        sectors=((np.arctan2(yy-y,xx-x)+np.pi)/(2*np.pi)*12).astype(int)%12
        support=sum(float(ink[annulus&(sectors==s)].mean())>=.20 for s in range(12))/12
        measurements.append({'row':row,'center':[round(x,3),round(y,3)],
            'ring_ink':round(float(ink[annulus].mean()),4),'angular_support':round(support,4),
            'center_ink':round(float(ink[radius<=3].mean()),4)})
    if not number_verified: reasons.append('question_number_uncertain')
    if len(measurements)!=5 or any(m['center_ink']<LAYOUT['min_center_ink'] for m in measurements):
        reasons.append('five_dot_positions_not_clear')
    strong=[m for m in measurements if m['ring_ink']>=LAYOUT['min_ring_ink'] and m['angular_support']>=LAYOUT['min_angular_support']]
    possible=[m for m in measurements if m['ring_ink']>=.35 and m['angular_support']>=.5]
    if len(strong)!=1 or len(possible)!=1: reasons.append('no_unique_clear_circle')
    if len(strong)==1 and max([m['ring_ink'] for m in measurements if m!=strong[0]],default=0)>strong[0]['ring_ink']-LAYOUT['min_margin']:
        reasons.append('insufficient_ring_margin')
    ready=not reasons
    return {'official_answer':strong[0]['row'] if ready else None,
        'status':'auto_ready' if ready else 'needs_review','confidence':.98 if ready else 0,
        'review_reasons':reasons,'measurements':measurements}


def completeness(records, root):
    problems=[]
    for number in range(1,29):
        matches=[r for r in records if r['question_number']==number]
        if len(matches)!=1:
            problems.append({'question_number':number,'reason':'missing_or_duplicate_record'});continue
        r=matches[0]
        if r['official_answer'] not in range(1,6) or r['status']!='auto_ready':
            problems.append({'question_number':number,'reason':'no_unique_official_answer'})
        if not r.get('question_id') or not all((root/'public'/r[k]).is_file() for k in ['source_pdf','source_crop']):
            problems.append({'question_number':number,'reason':'missing_question_link_or_source'})
    return {'expected':28,'records':len(records),'unique_complete':not problems and len(records)==28,'problems':problems}


def font(size):
    for name in ['C:/Windows/Fonts/arial.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if Path(name).exists(): return ImageFont.truetype(name,size)
    return ImageFont.load_default(size=size)


def render_page(root, pdf, source_hash):
    source=read(root/'data/exams/2017_sommer_arbeitsplanung_segmented.json')
    questions=[q for q in source['questions'] if q['question_number'].isdigit()]
    if source['exam']!='2017_sommer' and source['exam']!='2017 Sommer':
        raise ValueError('Unexpected exam scope')
    if source['module']!='Arbeitsplanung': raise ValueError('Unexpected module')
    numbers=[int(q['question_number']) for q in questions]
    if sorted(numbers)!=list(range(1,29)): raise ValueError('Existing question links not uniquely Q1–Q28; segmentation left untouched')
    by_number={int(q['question_number']):q['question_id'] for q in questions}
    directory=Path('assets/answers')/DOC/REVISION
    (root/'public'/directory).mkdir(parents=True,exist_ok=True)
    with pymupdf.open(pdf) as document:
        page=document[LAYOUT['page']-1]
        if [page.rect.width,page.rect.height]!=LAYOUT['page_points']: raise ValueError('Unverified page dimensions')
        pix=page.get_pixmap(dpi=120,colorspace=pymupdf.csGRAY)
        gray=np.frombuffer(pix.samples,np.uint8).reshape(pix.height,pix.width)
        pix=page.get_pixmap(dpi=300,colorspace=pymupdf.csRGB)
        full=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
    overlay=full.copy();draw=ImageDraw.Draw(overlay); records=[]
    for group in LAYOUT['groups']:
        for column in range(group['count']):
            number=group['start']+column
            x=group['x']+column*group['dx']; y=group['y']+column*group['slope']
            centers=[(x,y+row*group['dy']) for row in range(5)]
            found=detect_column(gray,centers)
            bbox=[x-23,group['header_y'],x+23,centers[-1][1]+13]
            crop_path=(directory/f'Q{number:02}.png').as_posix()
            full.crop(tuple(round(v*2.5) for v in bbox)).save(root/'public'/crop_path)
            chosen=found['official_answer']
            circle=centers[chosen-1] if chosen else None
            ring_box=[circle[0]-12,circle[1]-12,circle[0]+12,circle[1]+12] if circle else None
            record={'question_id':by_number[number],'exam':source['exam'],'module':'Arbeitsplanung',
                'question_number':number,'official_answer_type':'multiple_choice',
                **found,'official_answer_status':found['status'], 'solution_source_page':2,
                'source_pdf':f'assets/pdfs/{DOC}.pdf','source_page':2,
                'answer_bbox':[round(v*.6,3) for v in bbox],
                'circle_bbox':[round(v*.6,3) for v in ring_box] if ring_box else None,
                'bbox_units':'PDF points; origin top-left','source_crop':crop_path,
                'source_pdf_sha256':source_hash,'parser_version':VERSION,'parser_revision':REVISION,
                'question_number_evidence':'source_hash_bound_verified_header_template',
                'user_corrected':False,'locked':False}
            records.append(record)
            draw.rectangle(tuple(round(v*2.5) for v in bbox),outline='#2676ff',width=2)
            draw.text((round((x-16)*2.5),round((group['header_y']-11)*2.5)),f'Q{number}',font=font(18),fill='#0038c9')
            for row,(cx,cy) in enumerate(centers,1):
                px,py=cx*2.5,cy*2.5
                draw.ellipse((px-7,py-7,px+7,py+7),outline='#0875d1',width=2)
                draw.text((px+30,py-10),str(row),font=font(18),fill='#0046bb')
            if ring_box: draw.rectangle(tuple(round(v*2.5) for v in ring_box),outline='#00a02b',width=4)
    # Whole answer grid plus a legible row -> answer legend; no redrawn source marks.
    grid=overlay.crop((95*2,375*2.5,690*2.5,735*2.5))
    canvas=Image.new('RGB',(1900,grid.height+510),'white');d=ImageDraw.Draw(canvas)
    d.text((24,12),'Official Arbeitsplanung / PDF page 2 / blue: columns + rows 1-5 / green: detected circle',font=font(26),fill='black')
    canvas.paste(grid,(24,65))
    for i,r in enumerate(records):
        text=f"Q{r['question_number']}: row {r['official_answer']} -> answer {r['official_answer']}" if r['official_answer'] else f"Q{r['question_number']}: NEEDS REVIEW"
        d.text((24+(i%4)*465,grid.height+90+(i//4)*42),text,font=font(24),fill='#076c28' if r['official_answer'] else '#a00000')
    overlay_path=(directory/'answer-grid-overlay.png').as_posix();canvas.save(root/'public'/overlay_path)
    result={'schema_version':1,'exam':source['exam'],'module':'Arbeitsplanung','part':'A',
        'parser_version':VERSION,'parser_revision':REVISION,'layout_config_hash':LAYOUT_HASH,
        'source_pdf_sha256':source_hash,'solution_source_page':2,'header_evidence':LAYOUT['header_evidence'],
        'confidence_note':'Deterministic rule grade, not a calibrated probability. No semantic/OCR answer inference.',
        'overlay':overlay_path,'answers':records}
    result['completeness']=completeness(records,root)
    return result


def artifact_digest(path):
    # Git CRLF/LF conversion must not invalidate a completed page's JSON exports.
    if Path(path).suffix=='.json':
        return hashlib.sha256(json.dumps(read(path),sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
    return digest(path)


def artifacts_valid(root, artifacts):
    try:
        return bool(artifacts) and all((root/p).is_file() and artifact_digest(root/p)==h for p,h in artifacts.items())
    except (ValueError,OSError):
        return False


def run(root, stop_after_checkpoint=False):
    root=Path(root)
    pdf=root/f'public/assets/pdfs/{DOC}.pdf'
    source_hash=digest(pdf)
    # Unknown scans must not inherit reviewed column numbering.
    if source_hash!=LAYOUT['verified_pdf_sha256']:
        raise ValueError('Unverified source: needs_review. Validate a new scoped layout; no answers guessed or overwritten.')
    key=f'{source_hash}:{VERSION}:{LAYOUT_HASH}'
    manifest_path=root/'data/ingest/answer_manifest.json'
    checkpoint=root/f'data/ingest/answers/{DOC}/{REVISION}/page-002.json'
    outputs=['data/exams/2017_sommer_arbeitsplanung_answers.json','public/data/2017_sommer_arbeitsplanung_answers.json']
    with lock(root):
        manifest=read(manifest_path,{'schema_version':1,'entries':{}})
        entry=manifest['entries'].get(key,{})
        if entry.get('status')=='complete' and artifacts_valid(root,entry.get('artifacts')):
            return {'status':'skipped','pages_processed':0,'pages_skipped':1,'key':key}
        cached=read(checkpoint)
        resumed=bool(cached and cached.get('key')==key and artifacts_valid(root,cached.get('artifacts')))
        if resumed:
            result=cached['result']
        else:
            manifest['entries'][key]={'status':'processing','source_pdf_hash':source_hash,'parser_version':VERSION,
                'layout_config_hash':LAYOUT_HASH,'scope':LAYOUT['scope'],'page':2,'started_at':now()}
            save(manifest_path,manifest)
            result=render_page(root,pdf,source_hash)
            paths=['public/'+r['source_crop'] for r in result['answers']]+['public/'+result['overlay']]
            cached={'key':key,'result':result,'artifacts':{p:artifact_digest(root/p) for p in paths}}
            save(checkpoint,cached)
        if stop_after_checkpoint:
            return {'status':'interrupted_after_checkpoint','pages_processed':0 if resumed else 1,'key':key}
        for output in outputs: save(root/output,result)
        artifacts={**cached['artifacts'],**{p:artifact_digest(root/p) for p in outputs}}
        manifest['entries'][key]={**manifest['entries'].get(key,{}),'status':'complete','completed_at':now(),
            'artifacts':artifacts,'answers':28,'auto_ready':sum(r['status']=='auto_ready' for r in result['answers'])}
        save(manifest_path,manifest)
        return {'status':'resumed' if resumed else 'processed','pages_processed':0 if resumed else 1,
            'auto_ready':sum(r['status']=='auto_ready' for r in result['answers']),
            'needs_review':[r['question_number'] for r in result['answers'] if r['status']=='needs_review'],
            'complete':result['completeness']['unique_complete'],'key':key}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--stop-after-checkpoint',action='store_true',help='Deterministic interruption/resume verification')
    args=parser.parse_args()
    print(json.dumps(run(args.root,args.stop_after_checkpoint),ensure_ascii=False,indent=2))
