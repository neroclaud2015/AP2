from pathlib import Path
import json
from PIL import Image,ImageDraw
root=Path.cwd();out=root/'docs/evidence/phase2e/winter-ap';out.mkdir(parents=True,exist_ok=True)
a=json.loads((root/'public/data/2017_18_winter_arbeitsplanung_answers.json').read_text());u=json.loads((root/'public/data/2017_18_winter_arbeitsplanung_u_solutions.json').read_text())
sheet=Image.new('RGB',(1400,880),'white');d=ImageDraw.Draw(sheet)
for i,r in enumerate(a['answers']):
 im=Image.open(root/'public'/r['source_crop']);im.thumbnail((175,175));x=(i%7)*200;y=(i//7)*220;sheet.paste(im,(x,y+30));d.text((x+5,y+5),f"Q{r['question_number']} = {r['official_answer']}",fill='black')
sheet.save(out/'mc-overlay.png')
sheet=Image.new('RGB',(1600,1800),'white');d=ImageDraw.Draw(sheet)
for i,r in enumerate(u['solutions']):
 im=Image.open(root/'public'/r['cropped_solution_image']);im.thumbnail((780,390));x=(i%2)*800;y=(i//2)*450;sheet.paste(im,(x,y+30));d.text((x+5,y+5),f"{r['question_number']} official p{r['solution_source_page']}",fill='black')
sheet.save(out/'u-contact-sheet.png')
html='<meta charset="utf-8"><h1>Winter 2017/18 Arbeitsplanung official answers</h1><p>28 deterministic MC answers + 8 official U screenshots. Source SHA256 '+a['source_hash']+'. Full source PDF and full-page private cache are withheld. Only authorized individual answer crops are shown.</p><h2>MC</h2><img style="max-width:100%" src="mc-overlay.png"><h2>U</h2><img style="max-width:100%" src="u-contact-sheet.png">'
(out/'index.html').write_text(html,encoding='utf-8')
# Annotated evidence from already-authorized individual crops only.
sheet=Image.new('RGB',(1960,1080),'white');d=ImageDraw.Draw(sheet)
for i,r in enumerate(a['answers']):
 im=Image.open(root/'public'/r['source_crop']).convert('RGB');im.thumbnail((160,210));x=(i%7)*280+12;y=(i//7)*270+35;sheet.paste(im,(x,y))
 d.text((x,y-25),f"Q{r['question_number']} | answer {r['official_answer']}",fill='black')
 box=r['answer_bbox'];sx=im.width/(box[2]-box[0]);sy=im.height/(box[3]-box[1])
 for m in r['measurements'][:5]:
  cx=x+(m['center'][0]-box[0])*sx;cy=y+(m['center'][1]-box[1])*sy;chosen=m['row']==r['official_answer'];color='#08782e' if chosen else '#2b60a7'
  d.line((cx+7*sx,cy,x+im.width+10,cy),fill=color,width=1)
  d.text((x+im.width+15,cy-5),f"row {m['row']}"+(' SELECTED' if chosen else ''),fill=color)
  if chosen:d.rectangle((cx-7*sx,cy-7*sy,cx+7*sx,cy+7*sy),outline=color,width=3)
sheet.save(out/'mc-annotated-overlay.png')
html=html.replace('<h2>U</h2>','<h2>Annotated candidate rows</h2><img style="max-width:100%" src="mc-annotated-overlay.png"><h2>U</h2>')
(out/'index.html').write_text(html,encoding='utf-8')
