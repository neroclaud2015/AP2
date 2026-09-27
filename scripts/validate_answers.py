"""Validate saved Phase 1.6 artifacts; never render or scan source PDFs."""
from pathlib import Path
from PIL import Image
from answers import DOC, LAYOUT, LAYOUT_HASH, REVISION, VERSION, completeness, artifacts_valid
from ingest import read, digest


def validate(root):
    root=Path(root)
    data=read(root/'data/exams/2017_sommer_arbeitsplanung_answers.json')
    assert data==read(root/'public/data/2017_sommer_arbeitsplanung_answers.json'), 'public and canonical answer datasets differ'
    assert data['parser_version']==VERSION and data['layout_config_hash']==LAYOUT_HASH
    assert data['source_pdf_sha256']==digest(root/f'public/assets/pdfs/{DOC}.pdf')==LAYOUT['verified_pdf_sha256']
    assert completeness(data['answers'],root)==data['completeness']
    assert len(data['answers'])==28 and sorted(r['question_number'] for r in data['answers'])==list(range(1,29))
    segmented=read(root/'data/exams/2017_sommer_arbeitsplanung_segmented.json')
    by_number={int(q['question_number']):q for q in segmented['questions'] if q['question_number'].isdigit()}
    assert len({r['question_id'] for r in data['answers']})==28
    for r in data['answers']:
        assert r['question_id']==by_number[r['question_number']]['question_id']
        assert r['exam']==segmented['exam'] and r['module']=='Arbeitsplanung'
        assert r['official_answer_type']=='multiple_choice' and r['source_page']==r['solution_source_page']==2
        assert r['official_answer_status']==r['status'] and r['parser_revision']==REVISION
        assert r['locked'] is False and r['user_corrected'] is False
        assert len(r['measurements'])==5 and [m['row'] for m in r['measurements']]==list(range(1,6))
        box=r['answer_bbox'];assert len(box)==4 and 0<=box[0]<box[2]<=595 and 0<=box[1]<box[3]<=842
        with Image.open(root/'public'/r['source_crop']) as image: assert image.width>50 and image.height>200
        if r['status']=='auto_ready':
            assert r['official_answer'] in range(1,6) and not r['review_reasons']
            circle=r['circle_bbox'];assert circle and box[0]<=circle[0]<circle[2]<=box[2] and box[1]<=circle[1]<circle[3]<=box[3]
            m=r['measurements'][r['official_answer']-1]
            assert m['ring_ink']>=LAYOUT['min_ring_ink'] and m['angular_support']>=LAYOUT['min_angular_support']
        else:
            assert r['official_answer'] is None and r['review_reasons']
    manifest=read(root/'data/ingest/answer_manifest.json')
    key=f"{data['source_pdf_sha256']}:{VERSION}:{LAYOUT_HASH}"
    assert manifest['entries'][key]['status']=='complete'
    assert artifacts_valid(root,manifest['entries'][key]['artifacts'])
    print(f"Answers valid: {len(data['answers'])} scoped records; unique complete = {data['completeness']['unique_complete']}; no PDF scan.")


if __name__=='__main__': validate(Path(__file__).resolve().parents[1])
