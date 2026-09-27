import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from layout_profiles.ap_2017_18 import APWinterProfile
from layout_profiles.base import UnsupportedLayout
from layout_profiles.portrait_raster import analyze_portrait,compose_cached_regions,pixel_box
import winter_preview as runner

ROOT=Path(__file__).resolve().parents[1]

class PortraitContracts(unittest.TestCase):
    def setUp(self):
        self.profile=APWinterProfile()
        self.source=runner.read(ROOT/'data/ingest/layout_validation_manifest.json')['sources'][self.profile.source_hash]
    def page(self,n):
        cache=self.source['pages'][str(n)]
        raw=runner.read(ROOT/cache['raw_path'])['raw']
        with Image.open(ROOT/cache['image_path']) as im:image=im.convert('RGB')
        return raw,image
    def test_all_observed_headings_and_explicit_owners(self):
        records=[self.profile.analyze_cached(*self.page(n)) for n in range(1,26)]
        result=runner.validate_records(records,self.profile.expected)
        self.assertTrue(result['compatible'],result)
        self.assertEqual(sum(len(p['anchors']) for p in records),36)
        self.assertEqual(records[19]['classification'],'continuation')
        self.assertEqual(records[19]['regions'][0]['owner'],'winter-ap-p19-U5')
        self.assertIn('Ergebnis U5',records[19]['regions'][0]['evidence'])
        self.assertEqual(records[24]['classification'],'attachment')
    def test_changed_heading_never_filled_from_sequence(self):
        raw,im=self.page(4);slot=self.profile.config['pages']['4']['slots'][0]
        im.paste('white',pixel_box(slot['heading_box'],im,[raw['width'],raw['height']]))
        record=self.profile.analyze_cached(raw,im)
        self.assertNotIn('2',[a['number'] for a in record['anchors']])
        self.assertIsNone(record['regions'][0]['owner'])
        self.assertIn('unverified_heading_pixels:2',record['issues'])
    def test_changed_u5_owner_stays_unassigned(self):
        raw,im=self.page(20);config=self.profile.config['pages']['20']
        im.paste('white',pixel_box(config['explicit_regions'][0]['evidence_box'],im,[raw['width'],raw['height']]))
        record=self.profile.analyze_cached(raw,im)
        self.assertIsNone(record['regions'][0]['owner'])
        self.assertEqual(record['anchors'],[])
    def test_exact_geometry_rejected(self):
        raw,im=self.page(4);raw={**raw,'width':raw['width']+.1}
        with self.assertRaises(UnsupportedLayout):self.profile.analyze_cached(raw,im)
    def test_crop_masks_neighbor_and_preserves_explicit_page_order(self):
        a=Image.new('RGB',(10,10),'red');b=Image.new('RGB',(10,10),'blue')
        regions=[{'page':2,'bbox':[0,0,10,5],'role':'primary','owner':'owner'},
                 {'page':2,'bbox':[5,5,10,10],'role':'diagram','owner':'owner'},
                 {'page':1,'bbox':[0,0,10,10],'role':'response_area','owner':'owner'}]
        result=compose_cached_regions(regions,{1:a,2:b},{1:[10,10],2:[10,10]})
        self.assertEqual(result.getpixel((2,2)),(0,0,255))
        self.assertEqual(result.getpixel((2,7)),(255,255,255))
        self.assertEqual(result.getpixel((7,7)),(0,0,255))
        self.assertEqual(result.getpixel((2,result.height-2)),(255,0,0))
    def test_resume_no_pdf_zip_or_repeat_analysis(self):
        import pymupdf,zipfile
        with patch.object(pymupdf,'open',side_effect=AssertionError('No PDF access')),patch.object(zipfile,'ZipFile',side_effect=AssertionError('No archive access')),patch.object(APWinterProfile,'analyze_cached',side_effect=AssertionError('Completed page reanalysis')),patch.object(runner,'make_report',side_effect=AssertionError('Completed accepted evidence must never regenerate')):
            result=runner.run(ROOT)
        self.assertEqual(result['processed_now'],0)
        self.assertEqual(result['skipped_pages'],25)
        self.assertEqual(result['preview_count'],36)
        self.assertEqual(result['source_pdf_pages_opened'],0)

if __name__=='__main__':unittest.main()
