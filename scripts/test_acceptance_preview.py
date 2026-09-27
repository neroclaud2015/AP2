import unittest
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from acceptance_artifacts import active_evidence, verify_preview

ROOT=Path(__file__).resolve().parents[1]
class AcceptancePreviewTests(unittest.TestCase):
    def test_saved_preview_matches_active_regions_and_keeps_ids(self):
        folder,report=active_evidence(ROOT,'fa_2017')
        preview=verify_preview(ROOT/'docs/evidence/layout_profiles/fa-preview',report)
        pages=[json.loads(p.read_text(encoding='utf-8')) for p in folder.glob('page-*.json')]
        anchors={a['anchor_id'] for p in pages for a in p['anchors']}
        self.assertEqual({i['anchor_id'] for i in preview['items']},anchors)
        for item in preview['items']:
            self.assertEqual(item['regions'],[r for p in sorted(pages,key=lambda p:p['page']) for r in p['regions'] if r['owner']==item['anchor_id']])
        q16=next(i for i in preview['items'] if i['question_number']=='16')
        table=next(r for r in q16['regions'] if r['role']=='table')
        self.assertGreaterEqual(table['bbox'][3],786.12)
        self.assertFalse(preview['formal_records_written'])

    def test_stale_preview_is_rejected(self):
        _,report=active_evidence(ROOT,'fa_2017')
        with TemporaryDirectory() as d:
            path=Path(d)/'preview-manifest.json'
            path.write_text(json.dumps({'profile_id':report['profile'],'source_hash':report['source_hash'],'config_hash':'stale'}),encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'Stale preview'):verify_preview(Path(d),report)

if __name__=='__main__':unittest.main()
