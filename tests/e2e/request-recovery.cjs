const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {chromium} = require('playwright');
let browser;
before(async () => {
  browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {})});
  await fs.mkdir('test-results/request-recovery', {recursive: true});
});
after(async () => { await browser?.close(); });

async function fixture(t, width = 390) {
  const {startRequestPreview} = await import('../helpers/request-preview.mjs');
  const preview = await startRequestPreview();
  const context = await browser.newContext({viewport: {width, height: 844}});
  // Block every non-local request, including fonts/marketplace popups. This suite is offline.
  await context.route('**/*', route => new URL(route.request().url()).origin === preview.origin ? route.continue() : route.abort());
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await context.close(); await preview.close(); assert.deepEqual(errors, []); });
  return {...preview, page, context};
}
const notice = (page, text) => page.locator('#notice').filter({hasText: text}).waitFor();
async function openDraft(page, origin) {
  await page.goto(origin + '/client');
  await notice(page, 'เริ่มร่างใหม่แล้ว');
  return page.locator('#requests').inputValue();
}

test('canceling a new request keeps the unsaved brief and does not create a record', async t => {
  const {page, origin, db} = await fixture(t);
  const first = await openDraft(page, origin);
  await page.locator('#goal').fill('รายละเอียดที่ยังไม่ได้บันทึก');
  let prompted = false;
  page.once('dialog', async dialog => { prompted = true; await dialog.dismiss(); });
  await page.locator('#new').click();
  await page.waitForFunction(() => !document.querySelector('#new').disabled);
  await page.screenshot({path: 'test-results/request-recovery/unsaved-brief-mobile.png', fullPage: true});
  assert.equal(await page.locator('#requests').inputValue(), first, 'cancel must keep the selected request');
  assert.equal(await page.locator('#goal').inputValue(), 'รายละเอียดที่ยังไม่ได้บันทึก');
  assert.equal(prompted, true, 'dirty brief must trigger discard confirmation');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ygg_requests').get().n, 1);
});

test('canceling legacy import preserves unsaved fields without creating a record', async t => {
  const {page, origin, db} = await fixture(t);
  const first = await openDraft(page, origin);
  await page.locator('#goal').fill('ร่างปัจจุบันที่ยังไม่บันทึก');
  await page.evaluate(() => localStorage.setItem('yggmetro-spectrumsale-v1', JSON.stringify({goal: 'ข้อมูลร่างเก่า'})));
  let prompted = false;
  page.once('dialog', async dialog => { prompted = true; await dialog.dismiss(); });
  await page.locator('#import-draft').click();
  await page.waitForFunction(() => !document.querySelector('#new').disabled);
  assert.equal(await page.locator('#requests').inputValue(), first);
  assert.equal(await page.locator('#goal').inputValue(), 'ร่างปัจจุบันที่ยังไม่บันทึก');
  assert.equal(prompted, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ygg_requests').get().n, 1);
});

test('failed new request preserves the selected request and its unsaved brief for retry', async t => {
  const {page, origin, db} = await fixture(t);
  const first = await openDraft(page, origin);
  await page.locator('#goal').fill('เก็บร่างนี้ไว้เมื่อเครือข่ายขัดข้อง');
  page.once('dialog', dialog => dialog.accept());
  await page.route('**/api/v1/requests/BRIEF-*', route => route.request().method() === 'POST' && !route.request().url().endsWith('/upsert')
    ? route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({code: 'REQUEST_STORE_UNAVAILABLE'})}) : route.continue());
  await page.locator('#new').click();
  await notice(page, 'บันทึกข้อมูลไม่สำเร็จ');
  assert.equal(await page.locator('#requests').inputValue(), first);
  assert.equal(await page.locator('#goal').inputValue(), 'เก็บร่างนี้ไว้เมื่อเครือข่ายขัดข้อง');
  // A retry must save into the original ID, not create an unexpected new request.
  await page.unroute('**/api/v1/requests/BRIEF-*');
  await page.locator('#save').click();
  await notice(page, 'บันทึกร่างแล้ว');
  assert.equal(await page.locator('#requests').inputValue(), first);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ygg_requests').get().n, 1);
  assert.equal(JSON.parse(db.prepare('SELECT brief_json FROM ygg_requests WHERE request_id=?').get(first).brief_json).goal, 'เก็บร่างนี้ไว้เมื่อเครือข่ายขัดข้อง');
});

test('failed selection restores the current draft and cannot overwrite the other request', async t => {
  const {page, origin, db} = await fixture(t, 1440);
  const first = await openDraft(page, origin);
  await page.locator('#goal').fill('request A'); await page.locator('#save').click(); await notice(page, 'บันทึกร่างแล้ว');
  await page.locator('#new').click(); await notice(page, 'เริ่มร่างใหม่แล้ว');
  const second = await page.locator('#requests').inputValue();
  await page.locator('#goal').fill('request B'); await page.locator('#save').click(); await notice(page, 'บันทึกร่างแล้ว');
  await page.locator('#requests').selectOption(first);
  await page.waitForFunction(() => document.querySelector('#goal').value === 'request A');
  await page.locator('#goal').fill('updated request A');
  page.once('dialog', dialog => dialog.accept());
  await page.route('**/api/v1/requests/' + second, route => route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({code: 'REQUEST_STORE_UNAVAILABLE'})}));
  await page.locator('#requests').selectOption(second); await notice(page, 'บันทึกข้อมูลไม่สำเร็จ');
  assert.equal(await page.locator('#requests').inputValue(), first);
  assert.equal(await page.locator('#goal').inputValue(), 'updated request A');
  await page.locator('#save').click(); await notice(page, 'บันทึกร่างแล้ว');
  assert.equal(JSON.parse(db.prepare('SELECT brief_json FROM ygg_requests WHERE request_id=?').get(second).brief_json).goal, 'request B');
  await page.screenshot({path: 'test-results/request-recovery/recovered-selection-desktop.png', fullPage: true});
});
