"""Package saved Phase 2E acceptance evidence; never run data extraction."""
from pathlib import Path
import json,html,shutil
ROOT=Path(__file__).resolve().parents[1]
def publish(destination=None):
 dest=Path(destination) if destination else ROOT/'dist/evidence/phase2e';dest.mkdir(parents=True,exist_ok=True)
 shutil.copytree(ROOT/'docs/evidence/phase2e',dest,dirs_exist_ok=True)
 rows=[]
 for slug,title in [('arbeitsplanung','Arbeitsplanung'),('funktionsanalyse','Funktionsanalyse'),('wiso','WiSo')]:
  prefix=ROOT/f'public/data/2017_18_winter_{slug}'
  paths=[Path(str(prefix)+'_'+kind+'.json') for kind in ['segmented','answers','u_solutions']]
  if all(p.exists() for p in paths):
   q,a,u=[json.loads(p.read_text(encoding='utf-8-sig')) for p in paths];pending=[x['question_number'] for x in a['answers'] if x['official_answer_status']=='needs_review']
   rows.append(f"<article><h2>{title}</h2><p>{len(q['questions'])} Aufgaben · {len(a['answers'])} Auswahlantworten · {len(u['solutions'])} U-Lösungen</p><p>Antwort-Review: {html.escape(str(pending))}</p><a href='../../?view=study&amp;exam=2017-18-winter&amp;module={slug}&amp;q=1'>Winter {title} lernen</a></article>")
  else:rows.append(f'<article><h2>{title}</h2><p>Noch nicht verfügbar / siehe Validierungsbericht.</p></article>')
 links=[]
 for folder,label in [('winter-ap','Winter AP Quellen und Antworten'),('winter-fa','Winter FA Vorschau und Quellen'),('winter-wiso','Winter WiSo Vorschau und Quellen')]:
  path=dest/folder/'index.html'
  if path.exists():links.append(f"<li><a href='{folder}/'>{label}</a></li>")
 for path,label in [('modules/acceptance.json','Winter FA / WiSo Browserprüfung'),('lifecycle/browser-acceptance.json','Verwerfen / Löschen Browserprüfung'),('lifecycle/discarded-history.png','Verworfene Versuche'),('navigation/acceptance.json','Zwei Prüfungsjahre / echter gemischter Test'),('navigation/mixed-ap-result.png','AP Modultest aus Sommer und Winter')]:
  if (dest/path).exists():links.append(f"<li><a href='{path}'>{label}</a></li>")
 report=ROOT/'docs/PHASE_2E_REPORT.md'
 if report.exists():(dest/'report.html').write_text("<!doctype html><meta charset='utf-8'><title>Phase 2E Report</title><pre style='white-space:pre-wrap;font:17px system-ui;max-width:1100px;margin:auto'>"+html.escape(report.read_text(encoding='utf-8-sig'))+'</pre>',encoding='utf8')
 (dest/'index.html').write_text("<!doctype html><html lang='de'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Phase 2E · Acceptance</title><style>body{font:18px system-ui;line-height:1.7;max-width:1100px;margin:35px auto;padding:0 22px;color:#193f35}article{border:1px solid #cad8cf;border-radius:12px;padding:22px;margin:18px 0}a{color:#006958}li{margin:14px 0}</style><a href='../../'>Lernseite</a><h1>Phase 2E · Winter 2017/18 und Testverlauf</h1><p>Verworfene Versuche bleiben lokal gespeichert, fehlen aber in Standardverlauf und Auswertungen. Dauerhaftes Löschen betrifft ausschließlich den ausgewählten Versuch; beide Aktionen verlangen eine Bestätigung.</p>"+''.join(rows)+"<h2>Prüfbelege</h2><ul>"+''.join(links)+"<li><a href='report.html'>Vollständiger Bericht</a></li></ul><p>Keine weiteren Prüfungsjahre verarbeitet. Originalbilder bleiben maßgeblich; keine KI-generierten Aufgaben oder adaptive Planung.</p></html>",encoding='utf8')
 return str(dest)
if __name__=='__main__':print(publish())
