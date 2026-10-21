import sys,unittest,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from wiso_pipeline import valid_text,classify,reconcile,cache_key,extract,build,write,classify_record,propose_topics
class PipelineTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):(Path(__file__).resolve().parents[1]/'private').mkdir(exist_ok=True)
 def test_unreliable_text_does_not_classify(self):
  self.assertEqual(classify_record({'text':'Betriebsrat','confidence':.99})['topic_ids'],[])
  self.assertEqual(classify_record({'text':'Welche Aufgaben übernimmt der Betriebsrat in diesem Betrieb? Bitte beantworten Sie diese Frage.','confidence':.4})['topic_ids'],[])
 def test_new_topic_requires_distinct_seasons(self):
  inventory=[{'question_id':str(i),'examId':f'{2020+i}-sommer'} for i in range(3)]
  texts=[{'question_id':str(i),'text':'Welche Aufgaben erfüllt der Bundestag im Rahmen der Gewaltenteilung? Erläutern Sie diese Aufgaben.','confidence':.95} for i in range(3)]
  classifications=[{'question_id':str(i),'topic_ids':[],'review_reasons':[]} for i in range(3)]
  cues=[{'id':'democracy','label':'Demokratie','pattern':'bundestag'}]
  proposed=propose_topics(inventory,texts,classifications,cues);self.assertEqual(len(proposed),1);self.assertFalse(proposed[0]['active'])
  for q in inventory:q['examId']='2020-sommer'
  self.assertEqual(propose_topics(inventory,texts,classifications,cues),[])
 def test_missing_text(self):
  self.assertFalse(valid_text('')); self.assertFalse(classify('')['topic_ids'])
 def test_multi_topic(self):
  self.assertEqual(set(classify('Betriebsrat und Jugend- und Auszubildendenvertretung')['topic_ids']),{'betriebsrat','jav'})
 def test_locked_changed(self):
  old={'question_source_revision':'old','locked':True,'topic_ids':['jav']}
  result=reconcile(old,{'question_source_revision':'new','topic_ids':['betriebsrat']})
  self.assertEqual(result['topic_ids'],['jav']);self.assertIn('source_changed_since_confirmation',result['review_reasons'])
 def test_distractors_do_not_classify(self):
  self.assertEqual(classify('Wer trägt die Verantwortung für Arbeitsschutz? Betriebsrat JAV Gewerkschaft')['topic_ids'],['arbeitsschutz'])
 def test_cache_skips_extraction(self):
  with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]/'private') as directory:
   root=Path(directory); (root/'public').mkdir();(root/'public/crop.png').write_bytes(b'fixture')
   q={'question_id':'q','question_source_revision':'one','crop':'crop.png','text':'Welche Kündigungsfrist gilt in diesem Arbeitsverhältnis? Bitte beachten Sie den konkreten Fall.'}
   first,hit=extract(root,q,{},root/'cache');self.assertFalse(hit)
   second,hit=extract(root,q,{},root/'cache');self.assertTrue(hit);self.assertEqual(first,second)
   q['question_source_revision']='two';third,hit=extract(root,q,{},root/'cache');self.assertFalse(hit)
 def test_add_change_remove_production(self):
  with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]/'private') as directory:
   root=Path(directory);write(root/'scripts/wiso_taxonomy.json',{'version':'test','nodes':[]})
   q={'question_id':'q','question_source_revision':'one','crop':'missing.png','text':'Welche Kündigungsfrist gilt in diesem Arbeitsverhältnis? Bitte beachten Sie den konkreten Fall.','module':'wiso','examId':'2026-sommer'}
   write(root/'public/data/question_inventory.json',[q]);first=build(root,True);self.assertEqual(len(first['texts']),1);self.assertIn('kuendigung',first['classifications'][0]['topic_ids'])
   q['question_source_revision']='two';q['text']='Welche Aufgaben erfüllt der Betriebsrat bei einer Einstellung in diesem Betrieb? Erläutern Sie den Fall.';write(root/'public/data/question_inventory.json',[q]);second=build(root,True);self.assertEqual(second['texts'][0]['question_source_revision'],'two');self.assertEqual(second['classifications'][0]['topic_ids'],['betriebsrat'])
   write(root/'public/data/question_inventory.json',[]);third=build(root,True);self.assertEqual(third['classifications'],[]);self.assertEqual(len(third['retired_classifications']),1);self.assertEqual(len(third['retired_texts']),1)
 def test_cache_source_binding(self):
  self.assertNotEqual(cache_key('a','b'),cache_key('c','b'))
if __name__=='__main__':unittest.main()
