"""Winter portrait scan preflight. No fallback to Sommer imposed layout."""
from .base import LayoutProfile

class APWinterProfile(LayoutProfile):
    profile_id = 'ap_2017_18'
    version = '2b.1.1'
    exam = '2017_18_winter'
    module = 'Arbeitsplanung'
    source_hash = 'f5e152ae12d23f22345ae8b5f6f60208eaab095cbe5e3c7d5eecf563af6b6c21'
    expected = [str(i) for i in range(1,29)] + ['U'+str(i) for i in range(1,9)]
    config = {'geometries':[[595.26,841.86],[1190.52,841.86]],
              'heading_rule':'unsupported raster-only portrait headings',
              'columns':'1/2 variable-width columns','bands':'nonuniform','parts':{'Teil A':28,'Teil B':8},
              'expected_evidence':'Physical page 2 printed instructions, visually verified',
              'question_pages':list(range(3,11))+list(range(15,24)),
              'continuation_candidates':[{'page':20,'candidate_owner':'U5','evidence':'U5 on p19; flow chart response on p20, no machine-verified anchor'}],
              'context_pages':[1,2,11,12,13,14,24,25],
              'continuation_policy':'unassigned until portrait profile verified',
              'publication':'validation_only'}
    def detect(self, raw, image, ocr):
        if raw['source_page'] in self.config['context_pages']:
            return [], {'kind':'context','unresolved':[]}
        return [], {'kind':'unsupported_layout','unresolved':[
            [[0,0,raw['width'],raw['height']], 'raster portrait layout requires verified heading/boundary detector']]}
