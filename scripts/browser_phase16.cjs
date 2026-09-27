const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.APP_URL||'http://127.0.0.1:5173/';
 try{
  await page.goto(url+'?q=3');await page.getByRole('heading',{name:'Aufgabe 3',exact:true}).waitFor();
  assert.equal(await page.locator('.official-answer').count(),1,'multiple-choice answer panel exists');
  const dataset=await (await page.request.get(url+'data/2017_sommer_arbeitsplanung_answers.json')).json();
  for(const answer of dataset.answers){
   await page.getByRole('button',{name:`Aufgabe ${answer.question_number}`,exact:true}).click();
   assert.equal(await page.getByTestId('official-answer').innerText(),String(answer.official_answer));
   await page.getByRole('button',{name:'Offizielle Antwortquelle ansehen',exact:true}).click();
   await page.locator('.answer-source img').evaluate(img=>img.decode());
   assert.ok((await page.getByRole('link',{name:'Original-Antwortseite ↗',exact:true}).getAttribute('href')).endsWith('#page=2'));
  }
  await page.getByRole('button',{name:'Aufgabe U1',exact:true}).click();assert.equal(await page.locator('.official-answer').count(),0);
  await page.getByRole('button',{name:'Aufgabe 3',exact:true}).click();
  await page.getByRole('button',{name:'Offizielle Antwortquelle ansehen',exact:true}).click();
  await fs.mkdir('docs/evidence/phase16',{recursive:true});
  await page.screenshot({path:'docs/evidence/phase16/study-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Antwort ändern',exact:true}).click();
  assert.equal(await page.locator('.import-button input').isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:'Aufgabe 4',exact:true}).isDisabled(),true);
  assert.deepEqual(await page.getByLabel('Richtige Antwort',{exact:true}).locator('option').allTextContents(),['Auswählen','1','2','3','4','5']);
  await page.getByLabel('Richtige Antwort',{exact:true}).selectOption('5');
  await page.getByRole('button',{name:'Antwort speichern',exact:true}).click();
  await page.getByText('Confirmed · gesperrt',{exact:true}).waitFor();
  await page.reload();await page.getByText('Confirmed · gesperrt',{exact:true}).waitFor();
  assert.equal(await page.getByTestId('official-answer').innerText(),'5');
  // A newer automatic answer cannot overwrite a local lock, even when the server changes.
  await page.route('**/data/2017_sommer_arbeitsplanung_answers.json',async route=>{
   const changed=structuredClone(dataset);changed.parser_revision='next-version-test';
   changed.answers.forEach(a=>{a.official_answer=1;a.parser_revision='next-version-test';});
   await route.fulfill({json:changed});
  });
  await page.reload();await page.getByText('Confirmed · gesperrt',{exact:true}).waitFor();
  assert.equal(await page.getByTestId('official-answer').innerText(),'5');
  await page.unroute('**/data/2017_sommer_arbeitsplanung_answers.json');
  let parserRerun=null;
  if(process.env.PYTHON_EXE){
   parserRerun=JSON.parse(execFileSync(process.env.PYTHON_EXE,['scripts/answers.py'],{encoding:'utf8',env:process.env}));
   assert.equal(parserRerun.status,'skipped');assert.equal(parserRerun.pages_processed,0);
   await page.reload();await page.getByText('Confirmed · gesperrt',{exact:true}).waitFor();
   assert.equal(await page.getByTestId('official-answer').innerText(),'5');
  }
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Änderungen exportieren'}).click();
  const backup=JSON.parse(await fs.readFile(await (await downloadEvent).path(),'utf8'));
  assert.equal(backup.schema_version,2);assert.equal(backup.answer_reviews.length,1);
  assert.equal(backup.answer_reviews[0].locked,true);assert.equal(backup.answer_reviews[0].user_corrected,true);
  assert.equal(backup.answer_reviews[0].official_answer,5);
  // A slow backup read must block edits until its atomic import completes.
  await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>{window.releaseBackupRead=()=>original.call(this).then(resolve);});};});
  await page.locator('.import-button input').setInputFiles({name:'slow-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  assert.equal(await page.getByRole('button',{name:'Antwort ändern',exact:true}).isDisabled(),true,'pending import blocks manual edits');
  assert.equal(await page.getByRole('button',{name:'Aufgabe 4',exact:true}).isDisabled(),true);
  await page.evaluate(()=>window.releaseBackupRead());await page.getByRole('status').filter({hasText:'Sicherung importiert'}).waitFor();
  await page.reload();await page.getByText('Confirmed · gesperrt',{exact:true}).waitFor();
  const invalid=structuredClone(backup);invalid.answer_reviews[0].official_answer=6;
  await page.locator('.import-button input').setInputFiles({name:'invalid-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
  await page.getByRole('status').filter({hasText:'Import nicht möglich'}).waitFor();assert.equal(await page.getByTestId('official-answer').innerText(),'5');
  await page.locator('.import-button input').setInputFiles({name:'old-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema_version:1,reviews:[]}))});
  await page.getByRole('status').filter({hasText:'Sicherung importiert'}).waitFor();assert.equal(await page.getByTestId('official-answer').innerText(),'5');
  const fresh=await browser.newContext();const restore=await fresh.newPage();await restore.goto(url+'?q=3');
  await restore.getByRole('heading',{name:'Aufgabe 3',exact:true}).waitFor();
  await restore.locator('.import-button input').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await restore.getByText('Confirmed · gesperrt',{exact:true}).waitFor();assert.equal(await restore.getByTestId('official-answer').innerText(),'5');
  // Missing/ambiguous machine records enter only the answer exception queue.
  await restore.route('**/data/2017_sommer_arbeitsplanung_answers.json',async route=>{
   const incomplete=structuredClone(dataset);incomplete.answers=incomplete.answers.filter(a=>a.question_number!==1);
   const ambiguous=incomplete.answers.find(a=>a.question_number===2);ambiguous.official_answer=null;ambiguous.official_answer_status='needs_review';ambiguous.review_reasons=['no_unique_clear_circle'];
   await route.fulfill({json:incomplete});
  });
  await restore.reload();await restore.getByRole('tab',{name:/Review \(6\)/}).click();
  assert.equal(await restore.locator('.answer-queue .queue-item').count(),2);
  await restore.locator('.answer-queue .queue-item').filter({hasText:'Antwort Q1'}).click();
  assert.equal(await restore.getByTestId('official-answer').innerText(),'—');
  assert.equal(await restore.getByRole('button',{name:'Antwort bestätigen',exact:true}).isDisabled(),true);
  await fresh.close();
  await page.getByRole('tab',{name:/Review \(4\)/}).click();
  assert.equal(await page.locator('.answer-queue .queue-item').count(),0);
  await page.getByRole('tab',{name:'Aufgaben',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Offizielle Antwortquelle ansehen',exact:true}).click();
  await page.screenshot({path:'docs/evidence/phase16/study-mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  await fs.writeFile('docs/evidence/phase16/browser.json',JSON.stringify({url,answers:28,source_crops_loaded:28,refresh_preserved:true,new_machine_revision_preserved:true,parser_rerun:parserRerun,backup_restore:true,slow_import_blocks_edits:true,invalid_backup_preserves_data:true,schema1_backup_compatible:true,missing_ambiguous_answer_queue:true,locked:true,user_corrected:true,U_answers_extracted:false,answer_review_count:0,mobile_overflow:false,errors},null,2));
  console.log('Phase 1.6 browser checks passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
