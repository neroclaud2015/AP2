"""Build cache-only registered module galleries; does not alter ingestion gates."""
from pathlib import Path
from PIL import Image,ImageDraw
from ingest import read
from registered_ingest import cache_metadata
from answers import font
import argparse,html

def build(root,layout_path,out):
 c=read(layout_path);q=read(root/f'public/data/{c["name"]}_segmented.json');u=read(root/f'public/data/{c["name"]}_u_solutions.json');a=read(root/f'public/data/{c["name"]}_answers.json');cache=cache_metadata(root,c['source_hash']);folder=out/c['module'].lower();folder.mkdir(parents=True,exist_ok=True)
 registered=next((m for m in read(root/'public/data/promoted_modules.json',[]) if m['examId']==c['exam'].replace('_','-') and m['slug']==c['module'].lower()),None)
 if registered:
  u=read(root/'public'/registered['solutionsPath']);a=read(root/'public'/registered['answersPath'])
 links=[]
 for n,p in c['pages'].items():
  with Image.open(root/cache['pages'][n]['image']) as original:im=original.convert('RGB')
  im.thumbnail((900,1250));d=ImageDraw.Draw(im);w,h=p['geometry']
  def rect(b,color,label):
   b=[b[0]*im.width/w,b[1]*im.height/h,b[2]*im.width/w,b[3]*im.height/h];d.rectangle(b,outline=color,width=3);d.text((b[0]+3,b[1]+20),label,font=font(17),fill=color)
  for s in p['slots']:
   for b,role in zip(s['regions'],s['roles']):rect(b,'#006e35',s['observed_number']+' '+role)
  for r in p['explicit_regions']:rect(r['bbox'],'#cc6000',r['owner'])
  for r in c['attachment_crops']:
   if r['page']==int(n):rect(r['bbox'],'#3344cc',r['role']+' / '+','.join(r.get('question_numbers',[])))
  im.save(folder/f'page-{int(n):02}.jpg');links.append(f'<details><summary>Page {n} · {p["classification"]}</summary><img loading="lazy" src="page-{int(n):02}.jpg"></details>')
 def img(path):return f'<a href="../../../{path}"><img loading="lazy" src="../../../{path}"></a>'
 cards=[]
 for r in q['questions']:
  context=[v for v in q['attachment_images'] if r['question_number'] in v.get('question_numbers',[])]
  cards.append(f'<article><h2>{r["question_number"]}</h2><p>Physical page {r["source_page"]} · {len(r["source_regions"])} regions</p>'+img(r['cropped_question_image'])+''.join(f'<details><summary>Original context: page {v["page"]} · {v["role"]}</summary>'+img(v['image'])+'</details>' for v in context)+'</article>')
 review=[str(r['question_number']) for r in a['answers'] if r['official_answer'] is None]
 style='<meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font:17px system-ui;max-width:1250px;margin:24px auto;padding:12px}img{max-width:100%}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{border:1px solid #bbb;padding:12px}details{margin:16px 0}</style>'
 text='<!doctype html>'+style+f'<a href="../">← Report</a><h1>{html.escape(c["exam"]+" · "+c["module"])}</h1><p>{len(q["questions"])} questions · MC {len(a["answers"])-len(review)}/{len(a["answers"])} · U {len(u["solutions"])}</p><p>Needs Review: '+(', '.join('Q'+n for n in review) or 'none')+'</p><h2>Question previews</h2><div class="gallery">'+''.join(cards)+'</div><h2>Ownership: every physical page</h2>'+''.join(links)+'<h2>Official MC detection overlay</h2>'+img(a['overlay'])+'<h2>Official U source crops</h2><div class="gallery">'+''.join('<article><h2>'+r['question_number']+'</h2>'+img(r['cropped_solution_image'])+'</article>' for r in u['solutions'])+'</div>'
 (folder/'index.html').write_text(text,encoding='utf8')
 return {'module':c['module'],'questions':len(q['questions']),'review':review}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--out',required=True);parser.add_argument('layouts',nargs='+');args=parser.parse_args();root=Path(__file__).resolve().parents[1]
 for p in args.layouts:print(build(root,root/p,root/args.out))
