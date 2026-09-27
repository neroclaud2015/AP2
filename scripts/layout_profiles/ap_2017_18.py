"""Winter 2017/18 AP: audited portrait raster profile, acceptance preview only."""
import json
from pathlib import Path
from .base import LayoutProfile,UnsupportedLayout
from .portrait_raster import analyze_portrait

class APWinterProfile(LayoutProfile):
    profile_id='ap_2017_18'
    version='2d.1.0'
    exam='2017_18_winter'
    module='Arbeitsplanung'
    source_hash='f5e152ae12d23f22345ae8b5f6f60208eaab095cbe5e3c7d5eecf563af6b6c21'
    implementation_dependencies=('portrait_raster.py','winter_2017_18.json')
    config=json.loads(Path(__file__).with_name('winter_2017_18.json').read_text(encoding='utf-8'))
    expected=config['expected']

    def validate_geometry(self,raw):
        page=self.config['pages'].get(str(raw['source_page']))
        if page is None or any(abs(v-e)>0.001 for v,e in zip([raw['width'],raw['height']],page['geometry'])):
            raise UnsupportedLayout('unsupported_layout: exact Winter page geometry')

    def analyze_cached(self,raw,image,ocr=None):
        self.validate_geometry(raw)
        return analyze_portrait(raw,image,self.config['pages'][str(raw['source_page'])],ocr)

    def detect(self,raw,image,ocr):
        record=self.analyze_cached(raw,image)
        proposals=[]
        for a in record['anchors']:
            regions=[r for r in record['regions'] if r['owner']==a['anchor_id']]
            proposals.append({'number':a['number'],'anchor':a['number'],'label_box':a['bbox'],
                'regions':[r['bbox'] for r in regions],'region_roles':[r['role'] for r in regions],
                'region_evidence':[r['evidence'] for r in regions],'evidence':a['evidence'],
                'reasons':a['review_reasons'],'confidence':.96})
        # Existing generic validator is deliberately unsupported: its IDs differ,
        # and this profile has an independent source-cache-only runner.
        return proposals,{'kind':record['classification'],'unresolved':[],
            'issues':['winter_requires_independent_cache_only_preview_runner'],
            'explicit_regions':[]}
