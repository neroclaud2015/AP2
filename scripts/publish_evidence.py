"""Publish one checked-in static evidence directory without rebuilding sources."""
from pathlib import Path
import argparse,shutil
p=argparse.ArgumentParser();p.add_argument('name');a=p.parse_args();root=Path(__file__).resolve().parents[1]
if not a.name or Path(a.name).name!=a.name or a.name in ('.','..'):raise ValueError('Single evidence folder name required')
source=root/'docs/evidence'/a.name;target=root/'dist/evidence'/a.name
if not source.is_dir():raise ValueError('Evidence folder does not exist')
shutil.copytree(source,target,dirs_exist_ok=True)
print('Published',a.name)
