from pathlib import Path
from PIL import Image,ImageDraw
from ingest import read,save
from registered_ingest import cache_metadata
from answers import font
import html,json
root=Path(__file__).resolve().parents[1];out=root/'docs/evidence/phase2i2';out.mkdir(exist_ok=True)
for code in ['ap','fa','wiso']:
 c=read(root/f'scripts/layout_profiles/sommer2019_{code}.json');q=read(root/f'public/data/{c["name"]}_segmented.json');u=read(root/f'public/data/{c["name"]}_reviewed_u_solutions.json');a=read(root/f'public/data/{c["name"]}_answers.json');cache=cache_metadata(root,c['source_hash']);folder=out/code;folder.mkdir(exist_ok=True)
 links=[]
 for n,p in c['pages'].items():
  im=Image.open(root/cache['pages'][n]['image']).convert('RGB');im.thumbnail((900,1250));d=ImageDraw.Draw(im);w,h=p['geometry']
  def rect(b,color,label):
   b=[b[0]*im.width/w,b[1]*im.height/h,b[2]*im.width/w,b[3]*im.height/h];d.rectangle(b,outline=color,width=3);d.text((b[0]+3,b[1]+20),label,font=font(18),fill=color)
  for s in p['slots']:
   for b,r in zip(s['regions'],s['roles']):rect(b,'#006e35',s['observed_number']+' '+r)
  for r in p['explicit_regions']:rect(r['bbox'],'#cc6000',r['owner'])
  im.save(folder/f'page-{int(n):02}.jpg');links.append(f'<details><summary>Page {n} · {p["classification"]}'+(f' · duplicate of {p["duplicate_of"]}' if p.get('duplicate_of') else '')+f'</summary><img loading="lazy" src="page-{int(n):02}.jpg"></details>')
 cards=''.join(f'<article><h2>{r["question_number"]}</h2><p>Physical page {r["source_page"]} · {len(r["source_regions"])} regions</p><a href="../../../{r["cropped_question_image"]}"><img loading="lazy" src="../../../{r["cropped_question_image"]}"></a></article>' for r in q['questions'])
 ucards=''.join(f'<article><h2>{r["question_number"]} · official solution</h2><img loading="lazy" src="../../../{r["cropped_solution_image"]}"></article>' for r in u['solutions'])
 style='<meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{font:17px system-ui;max-width:1250px;margin:24px auto;padding:12px}img{max-width:100%}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{border:1px solid #bbb;padding:12px}details{margin:16px 0}</style>'
 (folder/'index.html').write_text('<!doctype html>'+style+f'<a href="../">← Report</a><h1>Sommer 2019 · {c["module"]}</h1><p>{len(q["questions"])} questions · original source crops · no missing anchors</p><h2>Question previews</h2><div class="gallery">'+cards+'</div><h2>Ownership: all physical pages</h2>'+''.join(links)+'<h2>Official MC detection overlay</h2><img src="../../../'+a['overlay']+'"><h2>Reviewed official U crops</h2><div class="gallery">'+ucards+'</div>',encoding='utf8')
 # Full preview contact sheet, with each original image also linked at full resolution.
 for start in range(0,len(q['questions']),12):
  group=q['questions'][start:start+12];sheet=Image.new('RGB',(1200,((len(group)+3)//4)*400),'#eee');d=ImageDraw.Draw(sheet)
  for k,r in enumerate(group):
   im=Image.open(root/'public'/r['cropped_question_image']);im.thumbnail((290,365));x=k%4*300;y=k//4*400;sheet.paste(im,(x,y+27));d.text((x+5,y+3),r['question_number'],font=font(18),fill='black')
  sheet.save(folder/f'questions-{start//12+1}.jpg')
 sheet=Image.new('RGB',(1400,1000),'#eee');d=ImageDraw.Draw(sheet)
 for k,r in enumerate(u['solutions']):
  im=Image.open(root/'public'/r['cropped_solution_image']);im.thumbnail((340,465));x=k%4*350;y=k//4*500;sheet.paste(im,(x,y+25));d.text((x+5,y+4),r['question_number'],font=font(18),fill='black')
 sheet.save(folder/'reviewed-u.jpg')
print('Three evidence galleries created from cached pixels only')
