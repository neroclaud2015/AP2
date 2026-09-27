from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
shutil.copytree(root/'docs/evidence/module-year-filter',root/'dist/evidence/module-year-filter',dirs_exist_ok=True)
