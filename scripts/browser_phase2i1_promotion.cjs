// Synthetic promotion is confined to an OS temporary directory and a loopback Vite server.
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const root=process.cwd(),fixture=fs.mkdtempSync(path.join(os.tmpdir(),'ap2-review-fixture-'));const py=process.env.AP2_PYTHON||'python';
const script=String.raw`
import sys,json,shutil
from pathlib import Path
from ingest import read
from manual_answer_promotion import apply,FIELDS
r=Path(sys.argv[1]);tmp=Path(sys.argv[2]);paths={'public/data/manual_answer_review_queue.json','data/source_registry.json','public/data/source_registry.json'}
for code in ['ap','fa']:
 paths.add(f'scripts/layout_profiles/winter2018_19_{code}.json')
 for kind in ['answers','layout']:
  rel=f'data/ingest/2018-19-{code}_registered_{kind}.json';paths.add(rel);paths.update(read(r/rel)['artifacts'])
for s in read(r/'data/source_registry.json')['sources']:
 if s['exam']=='2018-19-winter' and s['module'] in ['arbeitsplanung','funktionsanalyse']:
  for g in s['gates'].values():paths.update(g['artifacts'])
for rel in paths:
 dest=tmp/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(r/rel,dest)
rows=[]
for q in read(tmp/'public/data/manual_answer_review_queue.json')['items']:
 rows.append({k:q[k] for k in FIELDS}|{'official_answer':1,'official_answer_status':'confirmed','user_corrected':True,'locked':True,'confirmation_method':'manual_source_review','updated_at':'2026-09-28T10:00:00Z','machine_answer_at_confirmation':q['official_answer']})
print(apply(tmp,{'schema_version':1,'scope':'winter-2018-19-ap-fa','confirmations':rows}))
`;
let server,browser;
try{execFileSync(py,['-c',script,root,fixture],{env:{...process.env,PYTHONPATH:[path.join(root,'scripts'),process.env.PYTHONPATH||''].join(path.delimiter)},stdio:'pipe'});const {createServer}=await import('vite');server=await createServer({root,configFile:false,base:'./',server:{host:'127.0.0.1',port:5181,strictPort:true},plugins:[{name:'isolated-manual-promotion-fixture',enforce:'pre',load(id){for(const name of ['source_registry.json','promoted_modules.json'])if(id.replaceAll('\\','/').endsWith('/public/data/'+name))return fs.readFileSync(path.join(fixture,'public/data',name),'utf8')},configureServer(v){v.middlewares.use((req,res,next)=>{const rel=(req.url||'').split('?')[0];if(/^\/data\/2018_19_winter_(arbeitsplanung|funktionsanalyse)_reviewed_answers\.json$/.test(rel)){res.setHeader('Content-Type','application/json');res.end(fs.readFileSync(path.join(fixture,'public',rel.slice(1))));return}next()})}}]});await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext(),p=await ctx.newPage(),base='http://127.0.0.1:5181/',checks={};
 await p.goto(base+'?view=study&exam=2018-19-winter&module=funktionsanalyse&q=13');await p.getByRole('heading',{name:'Aufgabe 13',exact:true}).waitFor();await p.getByText('Gemeinsame Aufgabenbeschreibung & Anlagen',{exact:true}).click();const link=p.getByRole('link',{name:'Anlage · Seite 8 ↗',exact:true});assert.ok((await link.getAttribute('href')).includes('attachment-8-1.png'));assert.equal((await p.request.get(new URL(await link.getAttribute('href'),base).href)).status(),200);checks.fa_q13_study_shared_page8=true;
 await p.goto(base+'?view=exams&exam=2018-19-winter&module=funktionsanalyse');await p.getByRole('button',{name:'Neue Originalprüfung · Funktionsanalyse',exact:true}).click();await p.getByRole('button',{name:'Prüfungsaufgabe 13',exact:true}).click();await p.locator('.session-attachments summary').click();assert.ok((await p.getByRole('link',{name:'Anlage · Seite 8 ↗',exact:true}).getAttribute('href')).includes('attachment-8-1.png'));checks.fa_q13_exam_shared_page8=true;
 for(const module of ['arbeitsplanung','funktionsanalyse']){const c=await browser.newContext(),page=await c.newPage();await page.goto(base+'?view=tests&years=2017-sommer,2018-19-winter&module='+module);const title=module==='arbeitsplanung'?'Arbeitsplanung':'Funktionsanalyse';await page.locator('.exam-card').filter({has:page.getByRole('heading',{name:title,exact:true})}).getByRole('button',{name:'Kurz starten · 6 MC + 2 U',exact:true}).click();await page.locator('.exam-workspace .save-status').filter({hasText:'Sitzung gespeichert'}).waitFor();const mix=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('ap2-private-learning');r.onsuccess=()=>{const db=r.result,q=db.transaction('testSessions').objectStore('testSessions').getAll();q.onsuccess=()=>{resolve(q.result[0].source_mix.map(s=>s.exam));db.close()}}}));assert.deepEqual([...new Set(mix)].sort(),['2017-sommer','2018-19-winter']);checks[module+'_synthetic_promotion_test_pool']=true;await c.close()}
 fs.writeFileSync('docs/evidence/phase2i1/promotion-simulation.json',JSON.stringify({checks,synthetic_confirmations_only:true,real_user_confirmations:0,real_production_promotions:0,isolated_temporary_repository:true,pdf_rescan:0},null,2));console.log(checks);
}finally{if(browser)await browser.close();if(server)await server.close();console.log('Synthetic fixture retained outside repository:',fixture)}})().catch(e=>{console.error(e);process.exit(1)});
