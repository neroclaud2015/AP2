// Routing/state integration test; FA fixture intentionally reuses AP content with distinct IDs.
// It validates frontend isolation independently of generated FA source artifacts.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const base=process.env.APP_URL||'http://127.0.0.1:5173/';
 try{
  const page=await browser.newPage();
  await page.route('**/data/2017_sommer_funktionsanalyse_*.json',async route=>{
   const name=new URL(route.request().url()).pathname.split('/').at(-1).replace('funktionsanalyse','arbeitsplanung');
   const source=await fs.readFile(path.join(process.cwd(),'public/data',name),'utf8');
   const parsed=JSON.parse(source);for(const collection of [parsed.questions,parsed.answers,parsed.solutions])for(const item of collection??[]){item.question_id='fa-fixture-'+item.question_id;item.module='Funktionsanalyse';}parsed.module='Funktionsanalyse';
   await route.fulfill({json:parsed});
  });
  await page.goto(base+'?q=1');await page.getByRole('heading',{name:'Aufgabe 1',exact:true}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('module'),'arbeitsplanung');
  await page.getByText('Notiz',{exact:true}).click();await page.getByLabel('Lernnotiz',{exact:true}).fill('AP draft');
  await page.getByLabel('Lernmodul',{exact:true}).selectOption('funktionsanalyse');await page.getByRole('heading',{name:'Aufgabe 1',exact:true}).waitFor();
  await page.getByText('Notiz',{exact:true}).click();await page.getByLabel('Lernnotiz',{exact:true}).fill('FA draft');
  await page.getByLabel('Lernmodul',{exact:true}).selectOption('arbeitsplanung');await page.getByText('Notiz',{exact:true}).click();assert.equal(await page.getByLabel('Lernnotiz',{exact:true}).inputValue(),'AP draft');
  await page.goBack();await page.getByText('Notiz',{exact:true}).click();assert.equal(await page.getByLabel('Lernnotiz',{exact:true}).inputValue(),'FA draft');
  await page.reload();await page.getByRole('heading',{name:'Aufgabe 1',exact:true}).waitFor();await page.getByText('Notiz',{exact:true}).click();assert.equal(await page.getByLabel('Lernnotiz',{exact:true}).inputValue(),'FA draft');
  await page.getByRole('button',{name:'Review / Quellen',exact:true}).click();await page.getByRole('button',{name:'Aufgabe 2',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('q'),'2');
  await page.getByRole('button',{name:'Zurück zum Lernen',exact:true}).click();await page.getByRole('heading',{name:'Aufgabe 2',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('module'),'funktionsanalyse');
  await page.getByRole('button',{name:'Start',exact:true}).click();assert.equal(await page.locator('.module-cards .exam-card').count(),2);
  console.log('Module URL, drafts, reload, browser Back, Review selection and dashboard integration passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
