from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
shutil.copytree(root/"docs/evidence/phase2i",root/"dist/evidence/phase2i",dirs_exist_ok=True)
