"""Package saved acceptance evidence for Pages; never run extraction or OCR."""
import argparse
from pathlib import Path
import json
import shutil
import html
from acceptance_artifacts import active_evidence, verify_preview

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'docs/evidence/layout_profiles'

def publish(destination):
    destination=Path(destination);destination.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((ROOT/'data/ingest/layout_validation_manifest.json').read_text(encoding='utf-8'))
    links=[]
    for target in ('fa_2017','wiso_2017','ap_2017_18'):
        module=manifest['modules'][target];state=module['versions'][module['active_key']]
        source,report=active_evidence(ROOT,target)
        if target=='fa_2017':verify_preview(BASE/'fa-preview',report)
        relative=source.relative_to(BASE)
        shutil.copytree(source,destination/relative,dirs_exist_ok=True)
        overviews=sorted(source.glob('overview-*.jpg'))
        overview_links=' | '.join(f"<a href='{relative.as_posix()}/{p.name}'>Overview {i+1}</a>" for i,p in enumerate(overviews))
        links.append('<li>'+target+' contact sheets: '+overview_links+'</li>')
        if target=='wiso_2017':
            links.append(f"<li>WiSo {report['status']}: <a href='{relative.as_posix()}/overlay-007.png'>page 7 (Q11 / U3)</a> | <a href='{relative.as_posix()}/overlay-008.png'>page 8 (Q8 / Q9)</a>. Any orange boxes are unassigned; green regions have explicit ownership.</li>")
        links.append(f"<li><a href='{relative.as_posix()}/index.html'>{target}: {report['classification']}</a> — {report['detected_question_count']}/{report['expected_question_count']} anchors, {report['physical_pages_checked']} physical pages</li>")
    for name in ('fa-preview','examples'):
        shutil.copytree(BASE/name,destination/name,dirs_exist_ok=True)
    for name in ('legacy-regression.json','resume-verification.json','profile-metadata.json'):
        shutil.copy2(BASE/name,destination/name)
    report=(ROOT/'docs/PHASE_2B_1_REPORT.md').read_text(encoding='utf-8')
    (destination/'report.html').write_text("<!doctype html><meta charset='utf-8'><title>Phase 2B.1 report</title><a href='index.html'>Evidence overview</a><pre style='white-space:pre-wrap;font:17px system-ui;max-width:1100px;margin:auto'>"+html.escape(report)+"</pre>",encoding='utf-8')
    legacy=json.loads((BASE/'legacy-regression.json').read_text(encoding='utf-8'))
    (destination/'legacy.html').write_text("<!doctype html><meta charset='utf-8'><title>Legacy AP regression</title><a href='index.html'>Evidence overview</a><h1>Legacy Sommer 2017 AP regression: passed</h1><p>36 stable question IDs, identical regenerated metadata and 36 byte-identical crops. Answer mappings and review queue unchanged.</p><pre>"+html.escape(json.dumps(legacy,indent=2))+"</pre>",encoding='utf-8')
    (destination/'index.html').write_text("<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Phase 2B.1 acceptance evidence</title><style>body{font:18px system-ui;max-width:1100px;margin:40px auto;padding:0 20px;color:#18313c}a{color:#075b87}li{margin:20px 0}.notice{padding:20px;background:#fff0c2}img{max-width:100%}</style><a href='../../'>Learning site</a><h1>Phase 2B.1 — visual acceptance</h1><p class='notice'>Archived Phase 2B.1 evidence with current active layout links. For current production and Winter acceptance status see <a href='../phase2d/'>Phase 2D evidence</a>. The historical report below records the earlier blocked state.</p><h2>FA question crops</h2><ul><li><a href='fa-preview/'>All 36 final question crops</a></li><li><a href='fa-preview/q15-q16.html'>Q15 / Q16 boundary and Q16 complete table</a></li><li><a href='fa-preview/contact-sheet.jpg'>36-question contact sheet</a></li></ul><h2>Full-page validation evidence</h2><ul>"+''.join(links)+"</ul><h2>Regression and metadata</h2><ul><li><a href='legacy.html'>Legacy AP regression results</a></li><li><a href='profile-metadata.json'>profile_id + validated_sources</a></li><li><a href='resume-verification.json'>Resume / skipped-page verification</a></li><li><a href='report.html'>Detailed validation report</a></li></ul><h2>WiSo U6 explicit continuation</h2><img src='examples/wiso-U6-ownership.jpg' alt='WiSo U6 cross-page ownership'></html>",encoding='utf-8')
    return str(destination)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--dest',type=Path,default=ROOT/'dist/evidence/layout-profiles')
    print(publish(parser.parse_args().dest))
