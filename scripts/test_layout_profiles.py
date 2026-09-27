import unittest
from layout_profiles import select_profile
from layout_profiles.base import Region, UnsupportedLayout
from layout_validation import validate_ownership

class ProfileContracts(unittest.TestCase):
    def test_same_profile_can_register_another_validated_source(self):
        from layout_profiles import FA2017Profile, profile_metadata
        from unittest.mock import patch
        additional={'exam':'fixture-other-session','module':'Funktionsanalyse','source_hash':'fixture-verified-hash','validation_status':'compatible'}
        with patch.object(FA2017Profile,'validated_sources',FA2017Profile.validated_sources+(additional,)):
            selected=select_profile(additional['exam'],additional['module'],additional['source_hash'])
            self.assertEqual(selected.profile_id,'fa_2017')
            self.assertEqual(selected.source_hash,additional['source_hash'])
            self.assertEqual(selected.exam,additional['exam'])
            self.assertEqual(len(next(m for m in profile_metadata() if m['profile_id']=='fa_2017')['validated_sources']),2)

    def test_unknown_source_fails_closed(self):
        with self.assertRaises(UnsupportedLayout):
            select_profile('2017_sommer', 'WiSo', 'unknown')

    def test_old_region_adapter_keeps_page_and_owner(self):
        r = Region.from_legacy(4, [10,20,30,40], 'stable-id')
        self.assertEqual(r.to_dict(), {'page':4,'bbox':[10,20,30,40], 'role':'primary','owner':'stable-id','evidence':'legacy_verified_region'})

    def test_unowned_continuation_is_review_not_inherited(self):
        result = validate_ownership([{'anchor_id':'U1'}], [Region(4,[1,2,3,4],'continuation',None,'unresolved')])
        self.assertEqual(result, ['unowned_continuation'])

    def test_dangling_owner_is_not_accepted(self):
        result = validate_ownership([{'anchor_id':'U1'}], [Region(4,[1,2,3,4],'continuation','U2','printed_reference')])
        self.assertEqual(result, ['unknown_owner:U2'])



from tempfile import TemporaryDirectory
from pathlib import Path
from unittest.mock import patch
import json
import pymupdf
import layout_validation as validation
from layout_profiles.base import LayoutProfile
from layout_profiles.fa_2017 import FA2017Profile

class FixtureProfile(LayoutProfile):
    profile_id='fixture'
    source_hash='fixture-hash'
    version='fixture-v1'
    expected=['1','2']
    config={'geometries':[[100,100]]}
    def detect(self,raw,image,ocr):
        n=raw['source_page']
        return [{'number':str(n),'anchor':'slot0','label_box':[10,10,20,20],
                 'regions':[[0,0,100,100]],'evidence':'fixture','reasons':[]}], {'unresolved':[]}

class ResumeContracts(unittest.TestCase):
    def make_source(self,root):
        pdf=pymupdf.open()
        for _ in range(2):pdf.new_page(width=100,height=100)
        pdf.save(root/'fixture.pdf');pdf.close()

    def test_partial_resume_version_change_and_completed_skip(self):
        with TemporaryDirectory() as d:
            root=Path(d);self.make_source(root);profile=FixtureProfile()
            with patch.dict(validation.TARGETS,{'fixture':('exam','module','fixture.pdf',None)}), patch.object(validation,'select_profile',return_value=profile):
                first=validation.run(root,'fixture',1)
                self.assertEqual((first['status'],first['processed_now']),('validating',1))
                second=validation.run(root,'fixture')
                self.assertEqual((second['processed_now'],second['skipped_pages'],second['source_pages_read']),(1,1,1))
                with patch.object(validation.pymupdf,'open',side_effect=AssertionError('PDF rescan')), patch.object(validation,'analyze_page',side_effect=AssertionError('repeat detection')):
                    repeat=validation.run(root,'fixture')
                self.assertEqual((repeat['processed_now'],repeat['source_pages_read']),(0,0))
                profile.version='fixture-v2'
                with patch.object(validation.pymupdf,'open',side_effect=AssertionError('PDF rescan after version change')):
                    changed=validation.run(root,'fixture')
                self.assertEqual((changed['processed_now'],changed['source_pages_read']),(2,0))

    def test_corrupt_checkpoint_blocks_without_silent_rescan(self):
        with TemporaryDirectory() as d:
            root=Path(d);self.make_source(root);profile=FixtureProfile()
            with patch.dict(validation.TARGETS,{'fixture':('exam','module','fixture.pdf',None)}), patch.object(validation,'select_profile',return_value=profile):
                result=validation.run(root,'fixture')
                (Path(result['evidence'])/'overlay-001.png').write_bytes(b'corrupt')
                with self.assertRaisesRegex(ValueError,'integrity'):
                    validation.run(root,'fixture')
                manifest=json.loads((root/'data/ingest/layout_validation_manifest.json').read_text())
                module=manifest['modules']['fixture'];state=module['versions'][module['active_key']]
                self.assertEqual(state['status'],'blocked')
                self.assertNotIn('report',state)
                self.assertEqual(json.loads((Path(result['evidence'])/'report.json').read_text())['status'],'blocked')
                self.assertIn('<h1>Blocked</h1>',(Path(result['evidence'])/'index.html').read_text())

    def test_unknown_source_records_blocked_without_pdf_processing(self):
        with TemporaryDirectory() as d:
            root=Path(d);self.make_source(root)
            with patch.dict(validation.TARGETS,{'fixture':('exam','module','fixture.pdf',None)}), patch.object(validation.pymupdf,'open',side_effect=AssertionError('unknown source scanned')):
                with self.assertRaises(UnsupportedLayout):validation.run(root,'fixture')
            manifest=json.loads((root/'data/ingest/layout_validation_manifest.json').read_text())
            module=manifest['modules']['fixture']
            self.assertEqual(module['versions'][module['active_key']]['status'],'blocked')

    def test_geometry_rejection(self):
        with self.assertRaises(UnsupportedLayout):FixtureProfile().validate_geometry({'width':200,'height':100})

    def test_fa_config_passed_to_independent_grid(self):
        profile=FA2017Profile()
        with patch('layout_profiles.fa_2017.detect_page',return_value=([],{'unresolved':[]})) as detector:
            profile.detect({'source_page':1},None,None)
        self.assertIs(detector.call_args.args[3],profile.config)

    def test_overlapping_question_owners_block(self):
        record={'page':1,'geometry':[100,100],'anchors':[], 'regions':[
            Region(1,[0,0,60,60],'primary','a','test').to_dict(),
            Region(1,[50,50,90,90],'primary','b','test').to_dict()]}
        self.assertEqual(validation.geometry_issues([record])[0]['reason'],'overlapping_different_owners')

if __name__ == '__main__': unittest.main()
