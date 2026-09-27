"""WiSo: bounded heading slots and explicit, nonadjacent U6 continuation."""
import re
import cv2
from .base import LayoutProfile
from .heading_patches import read_heading

HEADING_PATCHES={(7,"11"):[303,60,338,94],(7,"U3"):[650,62,696,95],(8,"8"):[49,305,72,333],(8,"9"):[301,305,324,333]}

# [number, primary bbox]; coordinates verified against this exact source only.
PAGES = {
 4:[('U1',[55,50,570,794]),('15',[638,302,890,535]),('16',[890,302,1165,535]),('17',[638,535,890,785]),('18',[890,535,1165,785])],
 5:[('13',[48,45,297,288]),('14',[297,45,565,288]),('U6',[50,288,570,797]),('1',[638,50,890,290]),('2',[890,50,1165,290]),('3',[638,290,890,535])],
 6:[('U2',[50,48,570,535]),('U5',[642,48,1170,795]),('4',[48,535,297,785]),('5',[297,535,565,785])],
 7:[('10',[48,50,297,292]),('11',[297,50,565,292]),('12',[48,292,297,537]),('U3',[642,50,1170,797])],
 8:[('6',[48,50,297,298]),('7',[297,50,565,298]),('8',[48,298,297,550]),('9',[297,298,565,550]),('U4',[642,50,1170,795])],
}

class WiSo2017Profile(LayoutProfile):
    profile_id = 'wiso_2017'
    version = '2d.1.0'
    implementation_dependencies = ('heading_patches.py',)
    exam = '2017_sommer'
    module = 'WiSo'
    source_hash = '3542821032c4d6b251a2e78c7e370428c373ff41b38f0759304205c105b07697'
    expected = [str(i) for i in range(1,19)] + ['U'+str(i) for i in range(1,7)]
    config = {'geometries':[[1190.4,841.44],[595.2,841.44]],
              'heading_rule':'each printed question panel has a bounded heading window; PDF text or localized OCR',
              'heading_patches':{str(k):v for k,v in HEADING_PATCHES.items()},'panels':PAGES,'columns':'panel-defined','bands':'variable panel boundaries',
              'continuation_policy':'explicit printed U6 marginal score label plus subparts 3/4 continuing 1/2; bottom printed border at y301 retained through y302',
              'continuations':[{'page':4,'bbox':[638,45,1170,302],'owner':'wiso_2017-p5-slot2',
                 'role':'continuation','evidence':'Printed U6 score label on p4 right; tablet purchase scenario subparts 3/4 continue p5 U6 subparts 1/2'}],
              'parts':{'Gebundene Aufgaben':18,'Ungebundene Aufgaben':6},
              'context_pages':[1,2,3,9],
              'attachment_refs':{'U1':[9]},
              'visual_audit':'All 9 physical pages checked; p7 raster-only, p8 Q8/Q9 headings absent from text layer.'}
    def detect(self, raw, image, ocr):
        proposals=[];unresolved=[]
        for index,(expected,box) in enumerate(PAGES.get(raw['source_page'],[])):
            # The profile defines a panel, but its number must be observed, never filled from sequence.
            if (raw['source_page'],expected) in HEADING_PATCHES:
                observed=read_heading(image,raw,HEADING_PATCHES[(raw['source_page'],expected)],ocr)
                if observed['number']!=expected:
                    unresolved.append([box,'unverified_heading:'+expected]);continue
                proposals.append({'number':observed['number'],'anchor':f'slot{index}','label_box':observed['bbox'],'regions':[box],
                    'confidence':observed['confidence'],'evidence':'three_threshold_local_heading_ocr_with_visual_source_evidence','reasons':[]})
                continue
            x,y=box[:2]; candidates=[]
            for line in raw['lines']:
                b=line['bbox']; t=line['text'].strip()
                if x<=b[0]<=x+36 and y<=b[1]<=y+30 and b[3]-b[1]>=15 and re.fullmatch(r'(?:[1-9]|1[0-8]|U[1-6])',t):
                    candidates.append((t,b,'pdf_heading_in_verified_panel',.96))
            if len(candidates)!=1:
                sx=image.shape[1]/raw['width'];sy=image.shape[0]/raw['height']
                patch=image[round(y*sy):round((y+38)*sy),round(x*sx):round((x+52)*sx)]
                patch=cv2.copyMakeBorder(patch,10,10,10,10,cv2.BORDER_CONSTANT,value=(255,255,255))
                candidates=[]
                for text,score in ocr(patch):
                    text=text.strip().replace(' ','')
                    if re.fullmatch(r'(?:[1-9]|1[0-8]|U[1-6])',text) and score>.8:
                        candidates.append((text,[x,y,x+38,y+32],'localized_heading_ocr',float(score)))
            if len(candidates)!=1 or candidates[0][0]!=expected:
                unresolved.append([box,'unverified_heading:'+expected]);continue
            number,bbox,evidence,confidence=candidates[0]
            proposals.append({'number':number,'anchor':f'slot{index}','label_box':bbox,'regions':[box],
                'confidence':confidence,'evidence':evidence,'reasons':[]})
        layout={'kind':'question_page' if raw['source_page'] in PAGES else 'context','unresolved':unresolved,
                'explicit_regions':[c for c in self.config['continuations'] if c['page']==raw['source_page']]}
        return proposals,layout
