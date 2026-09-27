from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
shutil.copytree(root/'docs/evidence/phase2f',root/'dist/evidence/phase2f',dirs_exist_ok=True)
