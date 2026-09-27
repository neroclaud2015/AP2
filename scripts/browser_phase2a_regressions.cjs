const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs/promises');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const url=process.env.APP_URL||'http://127.0.0.1:5173/';const evidence=process.env.EVIDENCE_DIR||'docs/evidence/phase2a';try{
 const page=await browser.newPage();await page.goto(url+'?view=study&q=1');await page.getByRole('heading',{name:'Aufgabe 1',exact:true}).waitFor();
 await page.getByRole('button',{name:'Review / Quellen',exact:true}).click();await page.getByRole('button',{name:'Prüfen / Bearbeiten',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Zurück zum Lernen',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Start / Dashboard',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Abbrechen',exact:true}).click();await page.getByRole('button',{name:'Antwort ändern',exact:true}).click();await page.getByLabel('Richtige Antwort',{exact:true}).selectOption('5');await page.getByRole('button',{name:'Antwort speichern',exact:true}).click();await page.getByText('Confirmed · gesperrt',{exact:true}).waitFor();
 await page.goBack();await page.getByRole('radio',{name:'5',exact:true}).check();await page.getByRole('button',{name:'Antwort abgeben',exact:true}).click();await page.locator('.result-banner.richtig').waitFor();assert.match(await page.locator('.result-banner').innerText(),/Offizielle Antwort: 5/);await page.close();
 let slowStorage=false;
 if(!process.env.APP_URL){
  const slow=await browser.newPage();await slow.route('**/src/storage/storage.ts*',async route=>{const r=await route.fetch();const body=await r.text();const patched=body.replace('async saveLearningSession(session) {','async saveLearningSession(session) { await new Promise(resolve => setTimeout(resolve, 1200));');assert.notEqual(patched,body);await route.fulfill({response:r,body:patched});});
  await slow.goto(url);await slow.getByRole('button',{name:'Originalprüfungen',exact:true}).first().click();await slow.getByRole('button',{name:/Teil B U1–U8/}).click();await slow.getByLabel('U1 Teil 1',{exact:true}).fill('Dieser Entwurf darf nicht verloren gehen');
  assert.equal(await slow.getByRole('button',{name:'Aufgabe U2',exact:true}).isDisabled(),true);assert.equal(await slow.getByRole('button',{name:'Start / Dashboard',exact:true}).isDisabled(),true);
  await slow.goBack();await slow.getByRole('heading',{name:'Originalprüfungen',exact:true}).waitFor();await slow.goForward();await slow.getByLabel('U1 Teil 1',{exact:true}).waitFor();assert.equal(await slow.getByLabel('U1 Teil 1',{exact:true}).inputValue(),'Dieser Entwurf darf nicht verloren gehen');slowStorage=true;await slow.close();
 }
 await fs.mkdir(evidence,{recursive:true});await fs.writeFile(evidence+'/navigation-regressions.json',JSON.stringify({url,review_unsaved_exit_blocked:true,browser_back_uses_corrected_key:true,delayed_storage_navigation_safe:slowStorage},null,2));console.log('Navigation/state regressions passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
