"""Publish navigation acceptance evidence without touching any dataset."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
shutil.copytree(root/'docs/evidence/phase2e1',root/'dist/evidence/phase2e1',dirs_exist_ok=True)
