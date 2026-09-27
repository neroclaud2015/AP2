"""Layout contracts. Unknown sources are unsupported; no nearest-profile fallback."""
from dataclasses import dataclass, asdict
import hashlib
import json
import inspect
from pathlib import Path

class UnsupportedLayout(ValueError):
    pass

@dataclass
class Region:
    page: int
    bbox: list
    role: str
    owner: str | None
    evidence: str

    def __post_init__(self):
        if self.role not in {'primary','continuation','diagram','table','response_area'}:
            raise ValueError('Unknown region role')
        if self.page < 1 or len(self.bbox) != 4 or self.bbox[0] >= self.bbox[2] or self.bbox[1] >= self.bbox[3]:
            raise ValueError('Invalid region geometry')

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_legacy(cls, page, bbox, owner):
        return cls(page, list(bbox), 'primary', owner, 'legacy_verified_region')

class LayoutProfile:
    profile_id = ''
    version = '2b.1.0'
    expected = []
    config = {}

    implementation_dependencies = ()

    @property
    def implementation_hash(self):
        folder=Path(__file__).parent
        files=[folder/'base.py',Path(inspect.getfile(type(self))),folder.parent/'segmentation_engine.py',folder.parent/'layout_validation.py']
        files.extend(folder/name for name in self.implementation_dependencies)
        payload=''.join(p.name+'\n'+p.read_text(encoding='utf-8').replace('\r\n','\n') for p in files)
        return hashlib.sha256(payload.encode()).hexdigest()

    @property
    def config_hash(self):
        value = {'config':self.config,'expected':self.expected,'profile':self.profile_id,'implementation':self.implementation_hash}
        return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()[:16]

    def accepts_geometry(self, raw):
        return any(abs(raw['width']-w)<1 and abs(raw['height']-h)<1 for w,h in self.config['geometries'])

    def validate_geometry(self, raw):
        if not self.accepts_geometry(raw):
            raise UnsupportedLayout('unsupported_layout: page geometry')
