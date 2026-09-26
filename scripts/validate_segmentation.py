"""Validate saved segmentation only; never opens or extracts any PDF."""
import json
from pathlib import Path
from PIL import Image

def validate(root):
    root=Path(root)
    data=json.loads((root/'public/data/2017_sommer_arbeitsplanung_segmented.json').read_text(encoding='utf8'))
    errors=[]; ids=set()
    if data['pages_processed']!=13 or data['coverage']['missing'] or data['coverage']['unexpected']:
        errors.append('Incomplete source-backed question coverage')
    if data.get('unresolved_regions'): errors.append('Unresolved heading regions')
    for q in data['questions']:
        if q['question_id'] in ids: errors.append('Duplicate question identity')
        ids.add(q['question_id'])
        if not 1<=q['source_page']<=13: errors.append('Invalid source page')
        if not (root/'public'/q['source_pdf']).exists(): errors.append('Missing source PDF')
        b=q['bounding_box'];w,h=q['source_size']
        if not 0<=b[0]<b[2]<=w or not 0<=b[1]<b[3]<=h: errors.append('Invalid bbox: '+q['question_id'])
        for region in q['regions']:
            if not b[0]-.1<=region[0]<region[2]<=b[2]+.1 or not b[1]-.1<=region[1]<region[3]<=b[3]+.1:
                errors.append('Region outside bbox: '+q['question_id'])
        try:
            with Image.open(root/'public'/q['cropped_question_image']) as image:
                image.verify()
        except Exception: errors.append('Invalid crop image: '+q['question_id'])
    for index,q in enumerate(data['questions']):
        for other in data['questions'][index+1:]:
            if q['source_page']!=other['source_page']:continue
            for a in q['regions']:
                for b in other['regions']:
                    area=max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
                    if area>.1: errors.append('Overlapping question regions: '+q['question_number']+'/'+other['question_number'])
    return {'errors':errors,'questions':len(ids),'needs_review':sum(q['review_status']=='needs_review' for q in data['questions']),
            'revision':data['segmentation_revision'],'coverage':data['coverage']}

if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    result=validate(root)
    (root/'docs/evidence/phase15/validation.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2));raise SystemExit(bool(result['errors']))
