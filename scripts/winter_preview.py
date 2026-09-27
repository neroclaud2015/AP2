"""Winter acceptance preview from saved pixels only; no PDF/ZIP access or production writes."""
import argparse
from collections import Counter
from contextlib import contextmanager
import hashlib
import html
import json
import os
from pathlib import Path
import shutil
from PIL import Image,ImageDraw
from layout_profiles.ap_2017_18 import APWinterProfile
from layout_profiles.portrait_raster import patch_image,compose_cached_regions

ROOT=Path(__file__).resolve().parents[1]
SCHEMA=1


def read(path):return json.loads(Path(path).read_text(encoding='utf-8-sig'))

def save(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+'.tmp')
    temp.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(temp,path)

def digest(path):
    path=Path(path)
    value=json.dumps(read(path),sort_keys=True,separators=(',',':')).encode() if path.suffix=='.json' else path.read_bytes()
    return hashlib.sha256(value).hexdigest()

def code_hash():return hashlib.sha256(Path(__file__).read_text(encoding='utf-8-sig').replace('\r\n','\n').encode()).hexdigest()[:16]

def artifacts_valid(root,artifacts):
    for relative,wanted in artifacts.items():
        path=(root/relative).resolve();path.relative_to(root)
        if not path.exists() or digest(path)!=wanted:return False
    return bool(artifacts)

@contextmanager
def winter_lock(root):
    path=root/'data/ingest/.winter_layout.lock';path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('a+b') as f:
        f.seek(0)
        if os.name=='nt':
            import msvcrt
            if path.stat().st_size==0:f.write(b'0');f.flush();f.seek(0)
            msvcrt.locking(f.fileno(),msvcrt.LK_NBLCK,1)
        else:
            import fcntl
            fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)
        try:yield
        finally:
            f.seek(0)
            if os.name=='nt':msvcrt.locking(f.fileno(),msvcrt.LK_UNLCK,1)
            else:fcntl.flock(f,fcntl.LOCK_UN)


def source_cache(root,profile):
    source=read(root/'data/ingest/layout_validation_manifest.json')['sources'][profile.source_hash]
    if source['page_count']!=25 or set(source['pages'])!={str(i) for i in range(1,26)}:
        raise ValueError('Incomplete immutable Winter source cache')
    for item in source['pages'].values():
        for kind in ('raw','image'):
            path=(root/item[kind+'_path']).resolve();path.relative_to(root)
            if digest(path)!=item[kind+'_hash']:raise ValueError('Immutable Winter cached page changed; no rescan permitted')
    return source


def overlay(im,record):
    out=im.copy();d=ImageDraw.Draw(out);sx=im.width/record['geometry'][0];sy=im.height/record['geometry'][1]
    for r in record['regions']:
        b=[r['bbox'][0]*sx,r['bbox'][1]*sy,r['bbox'][2]*sx,r['bbox'][3]*sy]
        color='#16753c' if r['owner'] else '#d85f00';d.rectangle(b,outline=color,width=3)
        d.text((b[0]+6,b[1]+44),(r['owner'] or 'UNASSIGNED')+' / '+r['role'],fill=color,stroke_width=1,stroke_fill='white')
    for a in record['anchors']:
        b=[a['bbox'][0]*sx,a['bbox'][1]*sy,a['bbox'][2]*sx,a['bbox'][3]*sy]
        d.rectangle(b,outline='blue',width=3)
    return out


def validate_records(records,expected):
    anchors=[a for p in records for a in p['anchors']];regions=[r for p in records for r in p['regions']]
    counts=Counter(a['number'] for a in anchors);ids=Counter(a['anchor_id'] for a in anchors)
    issues=[{'page':p['page'],'reason':reason} for p in records for reason in p['issues']]
    for p in records:
        w,h=p['geometry']
        for r in p['regions']:
            b=r['bbox']
            if r['page']!=p['page'] or not (0<=b[0]<b[2]<=w and 0<=b[1]<b[3]<=h):issues.append({'page':p['page'],'reason':'out_of_page_region'})
            if r['owner'] is None or ids[r['owner']]!=1:issues.append({'page':p['page'],'reason':'unverified_or_ambiguous_owner'})
        for i,a in enumerate(p['regions']):
            for b in p['regions'][i+1:]:
                x,y=a['bbox'],b['bbox'];area=max(0,min(x[2],y[2])-max(x[0],y[0]))*max(0,min(x[3],y[3])-max(x[1],y[1]))
                if area>1 and a['owner']!=b['owner']:issues.append({'page':p['page'],'reason':'different_owner_overlap'})
        for a in p['anchors']:
            b=a['bbox']
            if not any(r['owner']==a['anchor_id'] and r['role']=='primary' and r['bbox'][0]<=b[0] and r['bbox'][1]<=b[1] and r['bbox'][2]>=b[2] and r['bbox'][3]>=b[3] for r in p['regions']):issues.append({'page':p['page'],'reason':'heading_outside_primary:'+a['number']})
    missing=sorted(set(expected)-set(counts));unexpected=sorted(set(counts)-set(expected));duplicates=sorted(n for n,v in counts.items() if v!=1)
    return {'missing':missing,'unexpected':unexpected,'duplicates':duplicates,'issues':issues,
            'compatible':not (missing or unexpected or duplicates or issues) and len(records)==25}


def contact_sheet(images,path,columns=4,width=1600,cell_height=440):
    cell_width=width//columns;out=Image.new('RGB',(width,((len(images)+columns-1)//columns)*cell_height),'white');d=ImageDraw.Draw(out)
    for i,(label,file) in enumerate(images):
        with Image.open(file) as original:
            im=original.convert('RGB');im.thumbnail((cell_width-16,cell_height-40))
        x=i%columns*cell_width;y=i//columns*cell_height;out.paste(im,(x+8,y+30));d.text((x+8,y+6),label,fill='black')
    out.save(path,quality=90)


def make_report(root,folder,profile,records,state):
    validation=validate_records(records,profile.expected)
    anchors=[{**a,'page':p['page']} for p in records for a in p['anchors']]
    anchors.sort(key=lambda a:(a['number'].startswith('U'),int(a['number'].lstrip('U'))))
    images={p['page']:Image.open(folder/f"page-{p['page']:03}.png").convert('RGB') for p in records}
    geometry={p['page']:p['geometry'] for p in records};regions=[r for p in records for r in p['regions']];items=[]
    for a in anchors:
        owned=[r for r in regions if r['owner']==a['anchor_id']]
        if not owned:continue
        im=compose_cached_regions(owned,images,geometry);name=a['number'] if a['number'].startswith('U') else 'Q'+a['number'];target=folder/'questions'/f'{name}.png';target.parent.mkdir(exist_ok=True);im.save(target)
        items.append({'anchor_id':a['anchor_id'],'question_number':a['number'],'image':f'questions/{name}.png',
                      'sha256':digest(target),'source_pages':list(dict.fromkeys(r['page'] for r in owned)),
                      'source_hash':profile.source_hash,'regions':owned,'heading_evidence':a,
                      'review_status':'needs_review' if a['review_reasons'] else 'visually_verified','user_acceptance':'pending'})
    for im in images.values():im.close()
    report={'schema_version':SCHEMA,'profile_id':profile.profile_id,'profile_version':profile.version,
            'source_hash':profile.source_hash,'config_hash':profile.config_hash,'runner_hash':code_hash(),
            'status':'compatible_dry_run' if validation['compatible'] else 'blocked',
            'classification':'Compatible with independent portrait profile; user acceptance pending' if validation['compatible'] else 'Blocked / Needs Review',
            'expected_question_count':36,'observed_question_count':len(anchors),'preview_count':len(items),
            'physical_pages_checked':len(records),'pages':[{'page':p['page'],'classification':p['classification'],'issues':p['issues']} for p in records],
            'missing':validation['missing'],'unexpected':validation['unexpected'],'duplicates':validation['duplicates'],
            'review_queue':validation['issues'],'review_count':len({i['page'] for i in validation['issues']}),
            'heading_method':'36 individually visually transcribed printed-number patches authenticated by exact cached RGB pixel SHA256. No sequence completion or nearest-owner inference; no OCR claim.',
            'ownership_policy':'Explicit per-region owner; p20 Ergebnis U5 print authenticates U5 continuation; Q8 L shape and Q26 labelled calculation area explicit.',
            'source_pdf_pages_opened':0,'source_pdf_pages_rendered':0,'formal_records_generated':False,
            'answers_extracted':False,'production_registration':False,'user_acceptance':'pending',
            'preview_resolution':'Original immutable 120dpi cached pixels, no super-resolution or PDF rerender',
            'attachment_refs':profile.config['attachment_refs'],'shared_description_page':14,
            'continuations':[r for r in regions if r['role'] in ('response_area','diagram')],
            'page_checkpoints':{n:p['input_hashes'] for n,p in state['pages'].items()}}
    save(folder/'report.json',report);save(folder/'preview-manifest.json',{'acceptance_only':True,'profile_id':profile.profile_id,'version':profile.version,'source_hash':profile.source_hash,'config_hash':profile.config_hash,'count':len(items),'items':items})
    save(folder/'ownership-mapping.json',regions)
    for start in range(0,len(records),12):contact_sheet([(f"Page {p['page']} / {p['classification']}",folder/f"overlay-{p['page']:03}.png") for p in records[start:start+12]],folder/f'pages-{start//12+1:02}.jpg')
    contact_sheet([(i['question_number'],folder/i['image']) for i in items],folder/'questions-contact.jpg',columns=6,width=2400,cell_height=480)
    css='body{font:18px system-ui;max-width:1450px;margin:25px auto;padding:0 20px;color:#19343c}a{color:#006286}img{max-width:100%;height:auto}article{border:1px solid #a9bcbc;padding:15px;margin:20px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}.notice{background:#fff1c5;padding:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,450px),1fr));gap:20px}'
    head="<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><style>"+css+"</style>"
    cards=[]
    for i in items:
        n=i['question_number'];cards.append(f"<article id='{n}'><h2>{n}</h2><p>Physical pages {', '.join(map(str,i['source_pages']))} · visually verified / awaiting user acceptance</p><a href='{i['image']}'><img loading='lazy' src='{i['image']}' alt='Winter AP {n} full question'></a><details><summary>Source / explicit regions / heading proof</summary><pre>{html.escape(json.dumps(i,indent=2))}</pre></details></article>")
    (folder/'index.html').write_text(head+"<title>Winter AP acceptance preview</title><h1>Winter 2017/18 Arbeitsplanung — dry-run preview</h1><p class='notice'>Acceptance only: no formal question records, answers or learning-module registration. All crops use saved 120dpi pixels. Source numbering is visually observed, not filled from sequence. User acceptance is pending.</p><p>"+html.escape(report['classification'])+f" · {len(items)} question previews / 25 physical pages</p><nav><a href='report.json'>Validation report</a> · <a href='preview-manifest.json'>Preview provenance</a> · <a href='pages.html'>Every page / ownership overlays</a> · <a href='questions-contact.jpg'>All-question contact sheet</a> · <a href='special-cases.html'>Q8 / Q26 / U5 ownership</a> · <a href='headings.html'>All observed number labels</a></nav><div class='grid'>"+''.join(cards)+"</div></html>",encoding='utf-8')
    sections=[];headings=[]
    for p in records:
        n=p['page'];sections.append(f"<article><h2>Physical page {n}: {p['classification']}</h2><p>{html.escape(p['classification_evidence'])}</p><a href='page-{n:03}.png'>Full cached source image</a> · <a href='page-{n:03}.json'>Page provenance</a><a href='overlay-{n:03}.png'><img loading='lazy' src='overlay-{n:03}.png' alt='Page {n} explicit owners'></a></article>")
        for i,proof in enumerate(p['proofs']):headings.append(f"<article><h2>Page {n}: {proof['number']} ({proof['kind']})</h2><img src='proof-{n:03}-{i:02}.png' alt='Observed printed {proof['number']}'><pre>{html.escape(json.dumps(proof,indent=2))}</pre></article>")
    (folder/'pages.html').write_text(head+"<title>Winter physical-page evidence</title><a href='index.html'>Question previews</a><h1>All25 physical pages</h1><p>Blue = observed heading; green = explicit proposed owner; orange = unresolved. Printed scores and source footers are not question numbers.</p>"+''.join(sections)+"</html>",encoding='utf-8')
    (folder/'headings.html').write_text(head+"<title>Observed Winter headings</title><a href='index.html'>Question previews</a><h1>Printed number and owner evidence</h1><p>These exact cropped pixels were visually inspected. SHA256 binds each transcription to this source. No omitted heading is inferred from order.</p><div class='grid'>"+''.join(headings)+"</div></html>",encoding='utf-8')
    (folder/'special-cases.html').write_text(head+"<title>Winter explicit ownership</title><a href='index.html'>All previews</a><h1>Nonuniform and cross-page ownership</h1><h2>Q8: L-shaped electrical circuit</h2><p>The right circuit belongs to Q8, extending alongside Q9; the Q9 panel is masked out while preserving page geometry.</p><img src='questions/Q8.png'><h2>Q26: labelled calculation workspace</h2><p>The right grid explicitly says Nebenrechnung Aufgabe26.</p><img src='questions/Q26.png'><h2>U5: pages19 and20</h2><p>The statement requests completion of the Grafcet. Page20 prints Ergebnis U5 next to its scoring field. This explicit label, matching symbols and the requested response establish ownership.</p><img src='proof-020-00.png'><img src='questions/U5.png'></html>",encoding='utf-8')
    return report


def run(root=ROOT,max_pages=None):
    root=Path(root).resolve();profile=APWinterProfile()
    key=f'{profile.source_hash}:{profile.version}:{profile.config_hash}:{code_hash()}'
    folder=root/'docs/evidence/phase2d/winter'/f'{profile.version}-{profile.config_hash}-{code_hash()}'
    folder.mkdir(parents=True,exist_ok=True);path=root/'data/ingest/winter_layout_manifest.json'
    with winter_lock(root):
        manifest=read(path) if path.exists() else {'schema_version':SCHEMA,'versions':{}}
        state=manifest['versions'].setdefault(key,{'status':'pending','source_hash':profile.source_hash,'profile_version':profile.version,'config_hash':profile.config_hash,'runner_hash':code_hash(),'pages':{}})
        manifest['active_key']=key;processed=0
        try:
            source=source_cache(root,profile)
            for n in range(1,26):
                item=source['pages'][str(n)];inputs={'raw_hash':item['raw_hash'],'image_hash':item['image_hash']}
                prior=state['pages'].get(str(n))
                if prior:
                    if prior['input_hashes']!=inputs or not artifacts_valid(root,prior['artifacts']):raise ValueError(f'Winter checkpoint integrity failure page{n}; no rescan')
                    continue
                if max_pages is not None and processed>=max_pages:break
                raw=read(root/item['raw_path'])['raw']
                with Image.open(root/item['image_path']) as cached:im=cached.convert('RGB')
                record=profile.analyze_cached(raw,im);record.update({'source_hash':profile.source_hash,'source_image_sha256':item['image_hash'],'source_raw_sha256':item['raw_hash'],'profile_version':profile.version,'config_hash':profile.config_hash,'source_image_cache':item['image_path'],'source_raw_cache':item['raw_path']})
                paths=[]
                for i,proof in enumerate(record['proofs']):
                    target=folder/f'proof-{n:03}-{i:02}.png';patch_image(im,proof['bbox'],record['geometry']).save(target);paths.append(target)
                target=folder/f'page-{n:03}.png';shutil.copy2(root/item['image_path'],target);paths.append(target)
                target=folder/f'overlay-{n:03}.png';overlay(im,record).save(target);paths.append(target)
                target=folder/f'page-{n:03}.json';save(target,record);paths.append(target)
                state['pages'][str(n)]={'input_hashes':inputs,'artifacts':{p.relative_to(root).as_posix():digest(p) for p in paths}}
                state['status']='validating';save(path,manifest);processed+=1
                print(f'Winter cache-only checkpoint {n}/25',flush=True)
            if len(state['pages'])<25:
                save(path,manifest);return {'status':'validating','processed_now':processed,'completed_pages':len(state['pages']),'source_pdf_pages_opened':0}
            if state['status']=='complete' and artifacts_valid(root,state.get('outputs',{})):
                report=read(folder/'report.json')
            else:
                records=[read(folder/f'page-{n:03}.json') for n in range(1,26)]
                report=make_report(root,folder,profile,records,state)
                failure=folder/'failure.json'
                if failure.exists():failure.unlink()
                allpaths=[p for p in folder.rglob('*') if p.is_file()]
                state['outputs']={p.relative_to(root).as_posix():digest(p) for p in allpaths};state['status']='complete';state['classification']=report['status'];state['report']=(folder/'report.json').relative_to(root).as_posix();state.pop('error',None);save(path,manifest)
            (folder.parent/'index.html').write_text("<!doctype html><meta charset='utf-8'><title>Winter AP preview</title><h1>Winter AP — acceptance preview only</h1><p>No formal records or learning-module registration.</p><a href='"+folder.name+"/index.html'>Open current36-question preview and evidence</a>",encoding='utf-8')
            return {'status':report['status'],'observed_questions':report['observed_question_count'],'preview_count':report['preview_count'],'needs_review':report['review_queue'],'processed_now':processed,'skipped_pages':25-processed,'source_pdf_pages_opened':0,'source_pdf_pages_rendered':0,'evidence':str(folder)}
        except Exception as e:
            state['status']='blocked';state['error']=str(e);state.pop('report',None);save(path,manifest)
            failure={'status':'blocked','error':str(e),'source_hash':profile.source_hash,'formal_records_generated':False}
            save(folder/'failure.json',failure);save(folder/'report.json',failure)
            (folder/'index.html').write_text("<!doctype html><meta charset='utf-8'><h1>Blocked / Needs Review</h1><p>"+html.escape(str(e))+"</p>",encoding='utf-8')
            (folder.parent/'index.html').write_text("<!doctype html><meta charset='utf-8'><h1>Winter preview blocked</h1><p>"+html.escape(str(e))+"</p>",encoding='utf-8')
            raise

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=ROOT);parser.add_argument('--max-pages',type=int);a=parser.parse_args();print(json.dumps(run(a.root,a.max_pages),indent=2))
