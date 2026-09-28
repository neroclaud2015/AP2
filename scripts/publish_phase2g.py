"""Publish synthetic Phase 2G browser evidence; never copy personal stores."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parents[1]
shutil.copytree(root / 'docs/evidence/phase2g', root / 'dist/evidence/phase2g', dirs_exist_ok=True)
