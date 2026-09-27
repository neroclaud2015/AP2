"""Publish saved Phase 2D evidence only; no extraction, OCR or PDF reads."""
from pathlib import Path
import shutil,json,html
from layout_profiles import profile_metadata
ROOT=Path(__file__).resolve().parents[1]
def publish(destination=None):
 dest=Path(destination) if destination else ROOT/'dist/evidence/phase2d'
 shutil.copytree(ROOT/'docs/evidence/phase2d',dest,dirs_exist_ok=True)
 (dest/'profile-metadata.json').write_text(json.dumps(profile_metadata(),indent=2),encoding='utf8')
 report=(ROOT/'docs/PHASE_2D_REPORT.md').read_text(encoding='utf8')
 (dest/'report.html').write_text("<!doctype html><meta charset='utf-8'><title>Phase 2D report</title><a href='./'>Evidence</a><pre style='white-space:pre-wrap;font:17px system-ui;max-width:1100px;margin:auto'>"+html.escape(report)+'</pre>',encoding='utf8')
 return str(dest)
if __name__=='__main__':print(publish())
