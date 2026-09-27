"""Hash-bound FA profile: shared detector, independently verified ownership."""
from .base import LayoutProfile
from .grid import detect_page

class FA2017Profile(LayoutProfile):
    profile_id = 'fa_2017'
    version = '2b.1.4'
    implementation_dependencies = ('grid.py',)
    exam = '2017_sommer'
    module = 'Funktionsanalyse'
    source_hash = '7978554f21aeb854391be5b2e3d2c5b711f58fa5bae9d55055c72a1eb038bb0b'
    expected = [str(i) for i in range(1,29)] + ['U'+str(i) for i in range(1,9)]
    config = {'geometries':[[1190.4,841.44],[595.2,841.44]],
              'heading_rule':'three-band size/position plus local OCR; U booklet heading',
              'body_y':[50,293,533,782],'body_x':[48,297,555],
              'heading_x':[54,300],'max_choice':28,'u_heading_x':[15,90],'u_heading_top':60,
              'continuation_policy':'explicit Q16 table; no cross-half question continuation',
              'parts':{'Teil A':28,'Teil B':8},'shared_detector':'parameterized-grid-v1',
              'page_anchors':{3:['1','2','3'],4:['4','5','6','7','8','25','26','27','28'],
                5:['9','10','11','12','20','21','22','23','24'],6:['13','14','15','16','17','18','19'],
                8:['U8'],9:['U7'],10:['U1','U6'],11:['U2','U5'],12:['U3','U4']},
              'table_ownership':{'page':6,'owner':'16','bbox':[48,534,555,792],
                'evidence':'Q16 explicitly references Tabelle a; full-width printed hydraulic maintenance table below'},
              'context_pages':[1,2,7,13,14,15],
              'attachment_refs':{'U4':[14],'U5':[14],'U6':[13,15],'U7':[13,15],'U8':[13,15]},
              'visual_audit':'All 15 physical pages checked; Q16 table requires independent construction.'}
    def detect(self, raw, image, ocr):
        proposals,layout=detect_page(raw,image,ocr,self.config)
        if raw['source_page']==6:
            for p in proposals:
                if p['number']=='15':p['regions']=[[48,p['regions'][0][1],297,534]]
                if p['number']=='16':
                    p['regions']=[[297,p['regions'][0][1],555,534],[48,534,555,792]]
                    p['region_roles']=['primary','table']
                    p['region_evidence']=['printed Q16 column',self.config['table_ownership']['evidence']]
        actual=sorted(p['number'] for p in proposals)
        expected=sorted(self.config['page_anchors'].get(raw['source_page'],[]))
        if actual!=expected:layout.setdefault('issues',[]).append('page_anchor_pattern_mismatch')
        return proposals,layout
