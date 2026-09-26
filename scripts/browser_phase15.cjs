const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.APP_URL||'http://127.0.0.1:5173/';
 try {
  await page.goto(url);await page.getByRole('heading',{name:/Die Originalaufgabe/}).waitFor();
  await page.locator('.question-art img').evaluate(img=>img.decode());
  assert.equal(await page.locator('.number-grid button').count(),36);
  for(let i=0;i<36;i++){
   await page.locator('.number-grid button').nth(i).click();
   await page.locator('.question-art img').evaluate(img=>img.decode());
   assert.ok((await page.getByRole('link',{name:/Original-PDF · Seite/}).getAttribute('href')).includes('#page='));
  }
  await page.getByRole('button',{name:'Aufgabe 3',exact:true}).click();
  await fs.mkdir('docs/evidence/phase15',{recursive:true});
  await page.screenshot({path:'docs/evidence/phase15/study-desktop.png',fullPage:true});
  await page.getByRole('tab',{name:/Review \(4\)/}).click();
  assert.equal(await page.locator('.queue-item').count(),4);
  await page.locator('.queue-item').filter({hasText:'Aufgabe 8'}).click();
  assert.equal(await page.locator('.import-button input').isDisabled(), true);
  await page.getByLabel('Aufgabennummer',{exact:true}).fill('8 geprüft');
  await page.getByLabel('Wissens-Tags').fill('Schweißen, Test');
  await page.getByLabel('Extrahierter Text').fill('User corrected text.');
  const oldLeft=Number(await page.getByLabel('Ausschnitt Links').inputValue());
  await page.getByLabel('Ausschnitt Links').fill(String(oldLeft+2));
  await page.getByLabel('Lösungsseite',{exact:true}).selectOption('2');
  await page.getByLabel('Diese Lösungszuordnung bestätigen').check();
  await page.screenshot({path:'docs/evidence/phase15/review-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Speichern · Confirmed',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Gespeichert'}).waitFor();
  assert.equal(await page.locator('.question-art canvas').count(),1);
  await page.reload();await page.getByRole('heading',{name:'Aufgabe 8 geprüft',exact:true}).waitFor();
  await page.getByRole('tab',{name:/Review \(3\)/}).click();
  assert.equal(await page.locator('.queue-item').count(),3);
  await page.getByRole('tab',{name:'Aufgaben',exact:true}).click();
  await page.getByRole('button',{name:'Prüfen / Bearbeiten',exact:true}).click();
  assert.equal(await page.getByLabel('Extrahierter Text').inputValue(),'User corrected text.');
  assert.equal(await page.getByLabel('Wissens-Tags').inputValue(),'Schweißen, Test');
  assert.equal(await page.getByLabel('Lösungsseite',{exact:true}).inputValue(),'2');
  assert.equal(await page.getByLabel('Ausschnitt Links').inputValue(),String(oldLeft+2));
  const svg=page.locator('.crop-editor svg');await svg.scrollIntoViewIfNeeded();const box=await svg.boundingBox();
  await page.mouse.move(box.x+box.width*.52,box.y+box.height*.34);await page.mouse.down();await page.mouse.move(box.x+box.width*.75,box.y+box.height*.64);await page.mouse.up();
  assert.notEqual(await page.getByLabel('Ausschnitt Links').inputValue(),String(oldLeft+2));
  await page.getByRole('button',{name:'Abbrechen',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Änderungen exportieren'}).click();
  const download=await downloadPromise;const exported=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.equal(exported.reviews[0].question_number,'8 geprüft');
  exported.reviews[0].review_status='needs_review';
  await page.locator('.import-button input').setInputFiles({name:'review.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  await page.getByRole('status').filter({hasText:'Sicherung importiert'}).waitFor();
  await page.getByRole('tab',{name:/Review \(4\)/}).waitFor();
  // Screenshots of the learning UI use unmodified original question 3.
  await page.getByRole('button',{name:'Aufgabe 3',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/evidence/phase15/study-mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  await fs.writeFile('docs/evidence/phase15/browser.json',JSON.stringify({url,questions:36,crop_images_loaded:36,initial_review_count:4,edited_review_count:3,edit_fields_persisted:true,crop_drag:true,export_import:true,mobile_overflow:false,errors},null,2));
  console.log('Phase 1.5 browser passed: 36 crops, 4-item review queue, edit/reload, crop drag, answer confirmation, backup, mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
