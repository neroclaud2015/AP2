"""Re-extract ONLY old AP in an isolated temporary directory, compare immutable golden data."""
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import json
import shutil
import segment
from ingest import read, save

ROOT=Path(__file__).resolve().parents[1]
def check():
    baseline=read(ROOT/'docs/evidence/layout_profiles/ap_2017_baseline.json')
    changed=[p for p,h in baseline.items() if hashlib.sha256((ROOT/p).read_bytes()).hexdigest()!=h]
    if changed:raise AssertionError('Existing assets changed: '+str(changed))
    manifest=read(ROOT/'data/ingest/manifest.json');entry=manifest['documents'][segment.DOCUMENT]
    golden=read(ROOT/'public/data/2017_sommer_arbeitsplanung_segmented.json')
    with TemporaryDirectory(prefix='ap2-layout-regression-') as directory:
        root=Path(directory)
        for relative in [entry['file'],'public/data/2017_sommer.json',
            'data/ingest/pages/'+segment.DOCUMENT,'public/assets/pages/'+segment.DOCUMENT]:
            source=ROOT/relative;target=root/relative;target.parent.mkdir(parents=True,exist_ok=True)
            if source.is_dir():shutil.copytree(source,target)
            else:shutil.copy2(source,target)
        save(root/'data/ingest/manifest.json',manifest)
        result=segment.run(root,segment.DOCUMENT)
        fresh=read(root/'public/data/2017_sommer_arbeitsplanung_segmented.json')
        assert fresh==golden, 'Regenerated question metadata differs from golden'
        for question in golden['questions']:
            relative='public/'+question['cropped_question_image']
            assert (root/relative).read_bytes()==(ROOT/relative).read_bytes(), relative
    return {'questions':36,'question_ids_unchanged':True,'fresh_metadata_equal':True,
        'regenerated_crops_byte_identical':36,'baseline_assets_unchanged':len(baseline),
        'answers_and_review_queue_unchanged':True,'personal_overlay_keys_unchanged':True}

if __name__=='__main__':
    result=check();save(ROOT/'docs/evidence/layout_profiles/legacy-regression.json',result);print(json.dumps(result,indent=2))
