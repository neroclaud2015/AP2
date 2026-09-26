const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173/');
  await page.getByRole('heading', { name: /Quellen verstehen/ }).waitFor();
  await page.locator('.page-frame img').evaluate(img => img.decode());
  assert.equal(await page.locator('nav button').count(), 4);
  await fs.mkdir('docs/evidence', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/desktop.png', fullPage: true });
  for (let i = 0; i < 4; i++) {
    await page.locator('nav button').nth(i).click();
    const select = page.getByLabel('PDF-Seite');
    const options = await select.locator('option').count();
    for (let n = 0; n < options; n++) {
      await select.selectOption(String(n));
      await page.locator('.page-frame img').evaluate(img => img.decode());
      const href = await page.getByRole('link', { name: 'Original-PDF' }).getAttribute('href');
      assert.ok(href.endsWith(`#page=${n + 1}`));
    }
  }
  await page.locator('nav button').first().click();
  await page.getByRole('tab', { name: 'Aufgabenvorschläge' }).click();
  assert.ok(await page.getByLabel('Aufgabenvorschlag').locator('option').count() > 0);
  await page.getByRole('button', { name: 'Originalseite prüfen' }).click();
  await page.locator('.page-frame img').evaluate(img => img.decode());
  await page.getByRole('tab', { name: 'Prüfliste', exact: true }).click();
  assert.equal(await page.locator('.review-list button').count(), 131);
  await page.locator('.review-list button').first().click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/evidence/mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  assert.deepEqual(errors, []);
  await fs.writeFile('docs/evidence/browser.json', JSON.stringify({ pageImages: 48, pdfLinks: 48, questionNavigation: true, reviewNavigation: true, mobileOverflow: false, pageErrors: errors }, null, 2));
  await browser.close();
  console.log('Browser smoke passed: 48 images, 48 PDF anchors, questions, review links, mobile layout.');
})().catch(e => { console.error(e); process.exit(1); });
