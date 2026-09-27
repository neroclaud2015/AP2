"""Scoped profile validation: checkpoints and evidence, never archive discovery."""
import argparse
from collections import Counter
import hashlib
import json
import html
from pathlib import Path
import zipfile
import pymupdf
import numpy as np
from PIL import Image, ImageDraw
from ingest import read, save, lock, now
from layout_profiles import select_profile
from layout_profiles.base import Region, UnsupportedLayout
from layout_profiles.ap_2017 import LabelOCR
from segmentation_engine import analyze_page

TARGETS = {
 'fa_2017':('2017_sommer','Funktionsanalyse','public/assets/pdfs/0734a1589eed96809ac7896a.pdf',None),
 'wiso_2017':('2017_sommer','WiSo','public/assets/pdfs/35f662246f2737dba0b61b88.pdf',None),
 'ap_2017_18':('2017_18_winter','Arbeitsplanung','../2017_18 Winter-20260926T101140Z-1-001.zip','2017_18 Winter/17_18 Arbeitsplanung.pdf'),
}

def validate_ownership(anchors, regions):
    known={a['anchor_id'] for a in anchors}; errors=[]
    for r in regions:
        if r.owner is None: errors.append('unowned_'+r.role)
        elif r.owner not in known: errors.append('unknown_owner:'+r.owner)
    return errors

def geometry_issues(records):
    issues=[]
    for record in records:
        w,h=record['geometry'];regions=record['regions']
        for r in regions:
            x0,y0,x1,y1=r['bbox']
            if not (0<=x0<x1<=w and 0<=y0<y1<=h):
                issues.append({'page':record['page'],'reason':'out_of_page_region'})
        for a in record['anchors']:
            b=a['bbox']
            if not any(r['owner']==a['anchor_id'] and r['role']=='primary' and
                r['bbox'][0]<=b[0] and r['bbox'][1]<=b[1] and r['bbox'][2]>=b[2] and r['bbox'][3]>=b[3] for r in regions):
                issues.append({'page':record['page'],'reason':'heading_outside_primary:'+a['number']})
        for i,left in enumerate(regions):
            for right in regions[i+1:]:
                if left['owner'] is None or right['owner'] is None or left['owner']==right['owner']:continue
                a,b=left['bbox'],right['bbox']
                area=max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
                if area>1:issues.append({'page':record['page'],'reason':'overlapping_different_owners'})
    return issues

def publish_failure(folder, state, error):
    state['status']='blocked';state['error']=type(error).__name__+': '+str(error)
    state.pop('report',None)
    failed={'status':'blocked','classification':'Blocked','error':state['error'],
            'formal_records_generated':False}
    save(folder/'failure.json',failed);save(folder/'report.json',failed)
    (folder/'index.html').write_text("<!doctype html><meta charset='utf-8'><h1>Blocked</h1><p>Validation failed; no compatibility claim is valid.</p><pre>"+html.escape(state['error'])+"</pre>",encoding='utf-8')

def content_hash(path):
    if path.suffix=='.json':
        data=json.dumps(read(path),sort_keys=True,separators=(',',':')).encode()
    else: data=path.read_bytes()
    return hashlib.sha256(data).hexdigest()

def raw_page(page, n):
    lines=[]
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines',[]):
            lines.append({'text':''.join(s['text'] for s in line['spans']), 'bbox':list(line['bbox'])})
    return {'source_page':n,'width':page.rect.width,'height':page.rect.height,'lines':lines}

def overlay(image, raw, anchors, regions, path):
    out=image.copy(); draw=ImageDraw.Draw(out); scale=out.width/raw['width']
    for r in regions:
        box=[v*scale for v in r.bbox]; color='#008033' if r.owner else '#d05000'
        draw.rectangle(box,outline=color,width=3)
        label=(r.owner or 'UNASSIGNED')+' / '+r.role
        draw.text((box[0]+3,box[1]+26),label,fill=color,stroke_width=1,stroke_fill='white')
    for a in anchors:
        box=[v*scale for v in a['bbox']];draw.rectangle(box,outline='blue',width=3)
        draw.text((box[0],max(0,box[1]-14)),a['number'],fill='blue',stroke_width=1,stroke_fill='white')
    out.save(path)

def report(root, profile, records, folder):
    anchors=[a for r in records for a in r['anchors']]
    counts=Counter(a['number'] for a in anchors)
    expected=set(profile.expected); missing=sorted(expected-set(counts)); unexpected=sorted(set(counts)-expected) if expected else []
    duplicates=sorted(n for n,c in counts.items() if c>1)
    issues=[{'page':r['page'],'reason':issue} for r in records for issue in r['issues']]+geometry_issues(records)
    regions=[r for page in records for r in page['regions']]
    ownership_errors=validate_ownership(anchors,[Region(**r) for r in regions])
    for r in regions:
        for error in validate_ownership(anchors,[Region(**r)]):
            issues.append({'page':r['page'],'reason':error})
    issues=list({(i['page'],i['reason']):i for i in issues}.values())
    blocking_issues=[i for i in issues if i['reason'] not in ('single_ocr_label_evidence',)]
    complete=bool(expected) and not missing and not unexpected and not duplicates and not blocking_issues and not ownership_errors
    result={'profile':profile.profile_id,'version':profile.version,'config_hash':profile.config_hash,
        'source_hash':profile.source_hash,'status':'compatible' if complete else 'blocked',
        'classification':'Compatible with new profile' if complete else 'Blocked',
        'detected_question_count':len(counts),'anchor_count':len(anchors),'expected_question_count':len(expected) if expected else None,
        'expected':profile.expected,'missing':missing,'duplicates':duplicates,'unexpected':unexpected,
        'continuation_regions':[r for r in regions if r['role'] in ('continuation','response_area','table')],
        'review_count':len({i['page'] for i in issues}), 'review_unit':'physical pages',
        'question_review_count':sum(bool(a.get('review_reasons')) for a in anchors),
        'blocking_issues':blocking_issues,'attachment_references':profile.config.get('attachment_refs',{}),
        'continuation_candidates':profile.config.get('continuation_candidates',[]),
        'review_queue':[{**i,'status':'needs_review'} for i in issues],
        'issues':issues,'ownership_errors':ownership_errors,'physical_pages_checked':len(records),
        'formal_records_generated':False}
    save(folder/'report.json',result)
    sheet_w=1600; cell_w=400;cell_h=330
    for start in range(0,len(records),12):
        group=records[start:start+12]; sheet=Image.new('RGB',(sheet_w,((len(group)+3)//4)*cell_h),'white');d=ImageDraw.Draw(sheet)
        for i,r in enumerate(group):
            im=Image.open(folder/f"page-{r['page']:03}.png");im.thumbnail((390,300))
            x=(i%4)*400;y=(i//4)*cell_h;sheet.paste(im,(x,y+24));d.text((x+5,y+4),f"Physical page {r['page']} | {len(r['anchors'])} anchors",fill='black')
        sheet.save(folder/f'overview-{start//12+1:02}.jpg',quality=90)
    sections=[]
    for r in records:
        sections.append(f"<h2>Physical page {r['page']}</h2><p>{'; '.join(r['issues']) or 'No automatic issue'}</p><a href='overlay-{r['page']:03}.png'><img src='overlay-{r['page']:03}.png'></a>")
    (folder/'index.html').write_text("<!doctype html><meta charset='utf-8'><title>Layout ownership evidence</title><style>body{font:16px sans-serif;max-width:1400px;margin:auto}img{max-width:100%}h2{margin-top:3em}</style><h1>"+profile.profile_id+" — "+result['classification']+"</h1><p>Blue: detected anchors. Green: proposed explicit owner. Orange: unassigned / Needs Review. A green boundary is not by itself acceptance; consult report.json.</p><a href='report.json'>Structured report</a> | <a href='continuation-mapping.json'>Continuation mapping</a>"+''.join(sections),encoding='utf-8')
    save(folder/'continuation-mapping.json',result['continuation_regions'])
    return result

def run(root, target, max_pages=None):
    root=Path(root).resolve(); exam,module,relative,member=TARGETS[target]
    if member:
        with zipfile.ZipFile(root/relative) as z: data=z.read(member)
    else: data=(root/relative).read_bytes()
    source_hash=hashlib.sha256(data).hexdigest()
    try:
        profile=select_profile(exam,module,source_hash)
    except UnsupportedLayout as error:
        # An altered source must supersede a previously compatible active run.
        folder=root/'docs/evidence/layout_profiles'/target/('unsupported-'+source_hash[:16])
        folder.mkdir(parents=True,exist_ok=True)
        path=root/'data/ingest/layout_validation_manifest.json'
        with lock(root):
            manifest=read(path,{'schema_version':1,'modules':{}})
            module_state=manifest['modules'].setdefault(target,{'versions':{}})
            key=source_hash+':unsupported_layout'
            state=module_state['versions'].setdefault(key,{'source_hash':source_hash,'pages':{}})
            module_state['active_key']=key
            publish_failure(folder,state,error);save(path,manifest)
        raise
    key=f'{source_hash}:{profile.version}:{profile.config_hash}'
    folder=root/'docs/evidence/layout_profiles'/target/(profile.version+'-'+profile.config_hash)
    folder.mkdir(parents=True,exist_ok=True)
    manifest_path=root/'data/ingest/layout_validation_manifest.json'
    with lock(root):
        manifest=read(manifest_path,{'schema_version':1,'modules':{}})
        versions=manifest['modules'].setdefault(target,{'versions':{}})['versions']
        state=versions.setdefault(key,{'status':'pending','profile_version':profile.version,'config_hash':profile.config_hash,'source_hash':source_hash,'pages':{}})
        # Shared immutable physical-page cache survives profile/config revisions.
        source=manifest.setdefault('sources',{}).setdefault(source_hash,{'pages':{}})
        for old in versions.values():
            if old.get('source_hash')!=source_hash:continue
            if 'page_count' in old:source['page_count']=old['page_count']
            for number, info in old.get('pages',{}).items():
                if number not in source['pages']:
                    raw_path=next(p for p in info['artifacts'] if p.endswith('.json'))
                    image_path=next(p for p in info['artifacts'] if p.endswith('.png') and '/page-' in p)
                    source['pages'][number]={'raw_path':raw_path,'image_path':image_path,
                        'raw_hash':info['artifacts'][raw_path],'image_hash':info['artifacts'][image_path]}
        manifest['modules'][target]['active_key']=key
        state['status']='validating';save(manifest_path,manifest)
        pdf=None;processed=0;source_reads=0;ocr=LabelOCR()
        try:
            if 'page_count' not in state:
                if 'page_count' in source:state['page_count']=source['page_count']
                else:
                    pdf=pymupdf.open(stream=data,filetype='pdf');state['page_count']=len(pdf);source['page_count']=len(pdf)
            for n in range(1,state['page_count']+1):
                checkpoint=folder/f'page-{n:03}.json'
                prior=state['pages'].get(str(n))
                if prior:
                    if not all((root/p).exists() and content_hash(root/p)==h for p,h in prior['artifacts'].items()):
                        raise ValueError(f'Checkpoint integrity failure at page {n}; refusing silent rescan')
                    continue
                if max_pages is not None and processed>=max_pages:break
                cached=source['pages'].get(str(n))
                if cached:
                    for label in ('raw','image'):
                        if content_hash(root/cached[label+'_path'])!=cached[label+'_hash']:
                            raise ValueError('Source page cache integrity failure; refusing silent rescan')
                    raw=read(root/cached['raw_path'])['raw']
                    im=Image.open(root/cached['image_path']).convert('RGB')
                else:
                    if pdf is None:pdf=pymupdf.open(stream=data,filetype='pdf')
                    page=pdf[n-1];raw=raw_page(page,n)
                    pix=page.get_pixmap(matrix=pymupdf.Matrix(120/72,120/72),alpha=False)
                    im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples);source_reads+=1
                proposals,layout=analyze_page(profile,raw,np.asarray(im),ocr)
                anchors=[];regions=[];issues=layout.get('issues',[]).copy()
                for p in proposals:
                    aid=f'{target}-p{n}-{p["anchor"]}'
                    anchors.append({'anchor_id':aid,'number':p['number'],'bbox':p['label_box'],'evidence':p['evidence'],'review_reasons':p['reasons']})
                    for i,bbox in enumerate(p['regions']):
                        role=p.get('region_roles',['primary' if j==0 else 'continuation' for j in range(len(p['regions']))])[i]
                        evidence=p.get('region_evidence',[p['evidence']]*len(p['regions']))[i]
                        regions.append(Region(n,bbox,role,aid,evidence))
                    issues.extend(p['reasons'])
                for unresolved in layout['unresolved']:
                    if isinstance(unresolved,dict):
                        reason=unresolved['reason'];issues.append(reason)
                        bbox=unresolved.get('bbox')
                        if bbox is None:
                            # Missing geometry is explicit and blocks acceptance; mark the whole page conservatively.
                            bbox=[0,0,raw['width'],raw['height']]
                            reason+='; exact region unavailable'
                        regions.append(Region(n,bbox,'primary',None,reason));continue
                    box,reason=unresolved
                    regions.append(Region(n,box,'primary',None,reason));issues.append(reason)
                for r in layout.get('explicit_regions',[]):regions.append(Region(**r))
                record={'page':n,'geometry':[raw['width'],raw['height']],'raw':raw,'anchors':anchors,
                    'regions':[r.to_dict() for r in regions],'issues':sorted(set(issues)),
                    'review_status':'needs_review' if issues else 'auto_ready','layout':layout}
                im.save(folder/f'page-{n:03}.png');overlay(im,raw,anchors,regions,folder/f'overlay-{n:03}.png');save(checkpoint,record)
                paths=[checkpoint,folder/f'page-{n:03}.png',folder/f'overlay-{n:03}.png']
                state['pages'][str(n)]={'artifacts':{p.relative_to(root).as_posix():content_hash(p) for p in paths},'completed_at':now()}
                if str(n) not in source['pages']:
                    source['pages'][str(n)]={'raw_path':checkpoint.relative_to(root).as_posix(),
                        'image_path':(folder/f'page-{n:03}.png').relative_to(root).as_posix(),
                        'raw_hash':content_hash(checkpoint),'image_hash':content_hash(folder/f'page-{n:03}.png')}
                save(manifest_path,manifest);processed+=1;print(f'{target}: checkpoint {n}/{state["page_count"]}',flush=True)
        except Exception as e:
            publish_failure(folder,state,e)
            save(manifest_path,manifest);raise
        finally:
            if pdf:pdf.close()
        records=[read(folder/f'page-{n:03}.json') for n in range(1,state['page_count']+1) if str(n) in state['pages']]
        if len(records)==state['page_count']:
            try:
                result=report(root,profile,records,folder)
            except Exception as e:
                publish_failure(folder,state,e)
                save(manifest_path,manifest);raise
            state.pop('error',None)
            (folder/'failure.json').unlink(missing_ok=True)
            state['status']=result['status'];state['report']=(folder/'report.json').relative_to(root).as_posix()
        else:result={'status':'validating','physical_pages_checked':len(records)}
        save(manifest_path,manifest)
        return {**result,'processed_now':processed,'source_pages_read':source_reads,'skipped_pages':len(records)-processed,'evidence':str(folder)}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target',required=True,choices=list(TARGETS))
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--max-pages',type=int)
    args=parser.parse_args();result=run(args.root,args.target,args.max_pages)
    print(json.dumps({k:v for k,v in result.items() if k not in ('issues','continuation_regions','expected')},indent=2))
