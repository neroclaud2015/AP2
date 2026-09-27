"""Acceptance-only crops from verified regions. No detector, answer extraction or data writes."""
from pathlib import Path
import hashlib
import html
import json
import pymupdf
from PIL import Image, ImageDraw
from layout_profiles import profile_metadata
from layout_profiles.base import Region
from segmentation_engine import render_regions
from acceptance_artifacts import active_evidence, verify_preview

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'docs/evidence/layout_profiles'

def folder_for(name):
    manifest=json.loads((ROOT/'data/ingest/layout_validation_manifest.json').read_text(encoding='utf-8'))
    module=manifest['modules'][name];state=module['versions'][module['active_key']]
    return ROOT/Path(state['report']).parent

def build():
    folder,report=active_evidence(ROOT,'fa_2017')
    if report['status']!='compatible':raise ValueError('FA layout must pass before a preview')
    source=ROOT/'public/assets/pdfs/0734a1589eed96809ac7896a.pdf'
    if hashlib.sha256(source.read_bytes()).hexdigest()!=report['source_hash']:raise ValueError('Source PDF hash mismatch')
    pages=[json.loads(p.read_text(encoding='utf-8')) for p in sorted(folder.glob('page-*.json'))]
    anchors=[{**a,'page':p['page']} for p in pages for a in p['anchors']]
    if len(anchors)!=36 or len({a['anchor_id'] for a in anchors})!=36:raise ValueError('Expected 36 unique anchors')
    anchors.sort(key=lambda a:(a['number'].startswith('U'),int(a['number'].lstrip('U'))))
    out=BASE/'fa-preview';out.mkdir(exist_ok=True);items=[]
    with pymupdf.open(source) as pdf:
        for a in anchors:
            regions=[Region(**r) for p in pages for r in p['regions'] if r['owner']==a['anchor_id']]
            image=render_regions(pdf,regions,dpi=180)
            name=('Q'+a['number'] if not a['number'].startswith('U') else a['number'])
            path=out/(name+'.png');image.save(path)
            items.append({'anchor_id':a['anchor_id'],'question_number':a['number'],'source_pages':sorted({r.page for r in regions}),
                'regions':[r.to_dict() for r in regions],'image':name+'.png','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                'review_reasons':a['review_reasons']})
    manifest={'acceptance_only':True,'formal_records_written':False,'question_ids_modified':False,
        'profile_id':report['profile'],'source_hash':report['source_hash'],'config_hash':report['config_hash'],
        'count':len(items),'items':items}
    (out/'preview-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    (BASE/'profile-metadata.json').write_text(json.dumps(profile_metadata(),indent=2),encoding='utf-8')
    cards=[]
    for item in items:
        name=Path(item['image']).stem
        cards.append(f"<article id='{name}'><h2>{name}</h2><p>PDF page {', '.join(map(str,item['source_pages']))} | {'Needs Review: heading evidence' if item['review_reasons'] else 'Verified layout'}</p><a href='{item['image']}'><img loading='lazy' src='{item['image']}' alt='{name} final question crop'></a><details><summary>Source regions / stable anchor</summary><pre>{html.escape(json.dumps(item,indent=2))}</pre></details></article>")
    css="body{font:18px system-ui;max-width:1500px;margin:24px auto;padding:0 20px;color:#182c35}a{color:#075c86}nav{display:flex;gap:20px;flex-wrap:wrap}img{max-width:100%;height:auto}article{border:1px solid #a5b9bd;padding:18px;break-inside:avoid}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere}.notice{padding:20px;background:#fff3cc}"
    header="<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><style>"+css+"</style>"
    (out/'index.html').write_text(header+"<title>FA 36-question acceptance preview</title><nav><a href='../index.html'>Evidence overview</a><a href='q15-q16.html'>Q15 / Q16 / full table</a><a href='contact-sheet.jpg'>36-question contact sheet</a></nav><h1>Sommer 2017 Funktionsanalyse — 36 question crops</h1><p class='notice'>Acceptance dry run only. These are not published learning records. Stable anchor IDs are retained. No answers were extracted. No browser storage is used. Multiple regions are stacked in source order.</p><main>"+''.join(cards)+"</main></html>",encoding='utf-8')
    rel='../'+folder.relative_to(BASE).as_posix()
    (out/'q15-q16.html').write_text(header+f"<title>Q15 / Q16 special boundary</title><nav><a href='index.html'>All 36 questions</a><a href='../index.html'>Evidence overview</a></nav><h1>Q15 / Q16 special boundary</h1><p>Q15 ends at y=534. Q16 contains its right-hand question panel AND the entire table below it. The common upper boundary is y=297.4. These regions do not overlap another question.</p><h2>Full-page ownership overlay</h2><a href='{rel}/overlay-006.png'><img src='{rel}/overlay-006.png' alt='Page 6 ownership overlay'></a><main><article><h2>Q15 final crop</h2><a href='Q15.png'><img src='Q15.png' alt='Q15 final crop'></a></article><article><h2>Q16 final crop + complete table</h2><a href='Q16.png'><img src='Q16.png' alt='Q16 final crop with complete table'></a></article></main></html>",encoding='utf-8')
    sheet=Image.new('RGB',(2400,2700),'white');d=ImageDraw.Draw(sheet)
    for i,item in enumerate(items):
        im=Image.open(out/item['image']);im.thumbnail((390,410));x=(i%6)*400;y=(i//6)*450
        sheet.paste(im,(x,y+30));d.text((x+8,y+5),Path(item['image']).stem+(' [Review]' if item['review_reasons'] else ''),fill='black')
    sheet.save(out/'contact-sheet.jpg',quality=90)
    verify_preview(out,report)
    return {'count':len(items),'formal_records_written':False,'output':str(out)}

if __name__=='__main__':print(json.dumps(build(),indent=2))
