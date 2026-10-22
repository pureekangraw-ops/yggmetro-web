const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright');
const ADMIN_TOKEN = 'synthetic-browser-journey-admin-'.repeat(2);
let browser;
before(async () => {
  browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {})});
  await fs.mkdir('test-results/request-journey', {recursive: true});
});
after(async () => { await browser?.close(); });

async function fixture(t, width = 390) {
  const {startRequestPreview} = await import('../helpers/request-preview.mjs');
  const preview = await startRequestPreview({adminToken: ADMIN_TOKEN});
  const contexts = [], errors = [];
  async function newPage() {
    const context = await browser.newContext({viewport: {width, height: 900}});
    contexts.push(context);
    // Local synthetic requests only, including popups: no model, payment, CDN or delivery calls.
    await context.route('**/*', route => new URL(route.request().url()).origin === preview.origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    return page;
  }
  t.after(async () => {
    for (const context of contexts) await context.close();
    await preview.close();
    assert.deepEqual(errors, [], 'all customer/Admin browser pages must be free of uncaught errors');
  });
  return {...preview, newPage};
}
const notice = (page, text) => page.locator('#notice').filter({hasText: text}).waitFor();
const idle = page => page.waitForFunction(() => !document.querySelector('#requests').disabled);
async function selected(page, id) {
  await page.waitForFunction(value => document.querySelector('#request-id').textContent === 'เลขคำขอ: ' + value, id);
  await idle(page);
}
async function select(page, id) { await page.locator('#requests').selectOption(id); await selected(page, id); }
async function save(page, goal) {
  await page.locator('#goal').fill(goal);
  await page.locator('#save').click();
  await notice(page, 'บันทึกร่างแล้ว');
  await idle(page);
}
async function open(page, origin) {
  await page.goto(origin + '/client');
  await notice(page, 'เริ่มร่างใหม่แล้ว');
  await idle(page);
  return page.locator('#requests').inputValue();
}
async function requestFromShop(page, origin) {
  await page.goto(origin + '/shop');
  // The launcher intentionally hides when it overlaps content. Find an ordinary scroll
  // position where a customer can open it; never force-click or disable collision rules.
  await page.evaluate(async () => {
    [...document.images].forEach(image => { image.loading = 'eager'; });
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    await document.fonts.ready;
  });
  const extent = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= extent; y += 100) {
    // scrollTo(x,y) inherits smooth CSS scrolling: two frames can observe a transient
    // visible launcher that hides at the final position. Settle real scroll positions.
    await page.evaluate(top => scrollTo({top, behavior: 'instant'}), y);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (await page.locator('#go-sales-launcher').isVisible()) break;
  }
  await page.screenshot({path: `test-results/request-journey/shop-entry-${page.viewportSize().width}.png`, fullPage: true});
  assert.equal(await page.locator('#go-sales-launcher').isVisible(), true, 'catalog support launcher must be reachable at a settled scroll position');
  await page.locator('#go-sales-launcher').click();
  await page.locator('#go-sales-input').fill('ขอคุยกับพนักงาน');
  await page.locator('#go-sales-send').click();
  const link = page.locator('#go-sales-messages a[href="/client?service=lab"]');
  await link.waitFor();
  assert.match(await page.locator('#go-sales-messages').textContent(), /ไม่สามารถยืนยันได้ว่ามี Admin ออนไลน์/);
  await link.click();
}
async function login(page, origin, id) {
  await page.goto(origin + '/admin/requests');
  await page.locator('#token').fill(ADMIN_TOKEN);
  await page.locator('#login button').first().click();
  await notice(page, 'เข้าสู่ศูนย์รับงานแล้ว');
  await idle(page);
  await select(page, id);
}
async function send(page, text) {
  await page.locator('#text').fill(text);
  await page.locator('#send').click();
  await notice(page, 'บันทึกข้อความแล้ว');
  await page.waitForFunction(() => !document.querySelector('#send').disabled);
}
function customerMessages(db, id) {
  return db.prepare("SELECT text FROM ygg_messages WHERE request_id=? AND sender_type='CUSTOMER' ORDER BY rowid").all(id).map(row => row.text);
}

for (const width of [390, 1440]) {
  test(`Shop → saved request → Admin takeover/reply → delivery, isolation and revisit at ${width}px`, {timeout: 120000}, async t => {
    const {origin, db, newPage} = await fixture(t, width);
    const customer = await newPage(), office = await newPage(), other = await newPage();
    await requestFromShop(customer, origin);
    await notice(customer, 'เปิดคำขอแล้ว');
    await idle(customer);
    const requestId = await customer.locator('#requests').inputValue();
    assert.equal(await customer.locator('#serviceLine').inputValue(), '');
    assert.match(await customer.locator('#shop-context-text').textContent(), /ขอคุยกับพนักงาน/);
    await customer.locator('#serviceLine').selectOption('DIGITAL');
    assert.match(await customer.locator('#brief').textContent(), /ไม่ใช่การยืนยันรับงานหรือชำระเงิน/);
    await customer.locator('#materials').fill('synthetic customer A private materials');
    await save(customer, 'synthetic customer A website');

    await customer.locator('#new').click(); await notice(customer, 'เริ่มร่างใหม่แล้ว'); await idle(customer);
    const secondId = await customer.locator('#requests').inputValue();
    await save(customer, 'synthetic second request');
    await select(customer, requestId);
    await customer.reload(); await notice(customer, 'โหลดคำขอของคุณแล้ว'); await selected(customer, requestId);
    assert.equal(await customer.locator('#goal').inputValue(), 'synthetic customer A website');
    await customer.locator('a[href="/"]').click();
    await customer.goBack(); await selected(customer, requestId);
    await customer.goto(origin + '/');
    await customer.locator('[data-go-sales-open]').click();
    await customer.locator('#go-sales-panel a[href="/client"]').click();
    await notice(customer, 'โหลดคำขอของคุณแล้ว'); await selected(customer, requestId);

    // No model credential is configured: a failed AI attempt must be attributed to System.
    assert.match(await customer.locator('#responder').textContent(), /AI - GO/);
    await send(customer, 'synthetic question during AI outage');
    const outage = customer.locator('.message').filter({hasText: 'AI - GO ไม่พร้อมตอบชั่วคราว'});
    assert.equal(await outage.locator('strong').textContent(), 'System');
    await customer.locator('#confirm').click();
    await customer.locator('#status').filter({hasText: 'ศูนย์รับงาน'}).waitFor(); await idle(customer);
    const replay = await customer.evaluate(async id => {
      const response = await fetch('/api/v1/requests/' + id + '/confirm', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'});
      return {status: response.status, body: await response.json()};
    }, requestId);
    assert.equal(replay.status, 200); assert.equal(replay.body.workCreated, false);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM ygg_request_events WHERE request_id=? AND kind='STATUS' AND to_value='SUBMITTED'").get(requestId).n, 1);

    await open(other, origin);
    const denied = await other.evaluate(async id => {
      const calls = [
        ['/api/v1/requests/' + id, undefined],
        ['/api/v1/requests/' + id + '/messages', {messageId: 'foreign-attempt', text: 'not mine'}],
        ['/api/v1/requests/' + id + '/confirm', {}],
        ['/api/v1/admin/requests', undefined],
        ['/api/v1/admin/requests/' + id + '/handoff', {responder: 'ADMIN', version: 0}],
      ];
      return Promise.all(calls.map(async ([path, data]) => {
        const response = await fetch(path, {method: data === undefined ? 'GET' : 'POST', ...(data === undefined ? {} : {headers: {'content-type': 'application/json'}, body: JSON.stringify(data)})});
        return {status: response.status, text: await response.text()};
      }));
    }, requestId);
    assert.deepEqual(denied.map(item => item.status), [404, 404, 404, 401, 401]);
    assert.ok(denied.every(item => !item.text.includes('private materials')));

    await login(office, origin, requestId);
    await office.locator('#takeover').click(); await notice(office, 'เปลี่ยนผู้ดูแลแล้ว'); await idle(office);
    await customer.bringToFront();
    await customer.locator('#responder').filter({hasText: 'Admin'}).waitFor({timeout: 15000});
    const handoff = customer.locator('.message').filter({hasText: 'Admin เข้ามารับช่วงการสนทนาแล้ว'});
    assert.equal(await handoff.locator('strong').textContent(), 'System');
    await send(office, 'synthetic verified Admin response');
    await customer.reload(); await notice(customer, 'โหลดคำขอของคุณแล้ว'); await selected(customer, requestId);
    const reply = customer.locator('.message').filter({hasText: 'synthetic verified Admin response'});
    assert.equal(await reply.locator('strong').textContent(), 'Admin');
    const beforeReplyCount = db.prepare('SELECT COUNT(*) n FROM ygg_messages WHERE request_id=?').get(requestId).n;
    await send(customer, 'synthetic customer thanks Admin');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM ygg_messages WHERE request_id=?').get(requestId).n, beforeReplyCount + 1, 'Admin-owned conversations cannot emit an AI reply');

    // Refresh the Admin's CAS version before status mutations after the customer message.
    await login(office, origin, requestId);
    for (const [status, label] of [['REVIEWING', 'กำลังตรวจสอบ'], ['IN_PROGRESS', 'กำลังดำเนินงาน']]) {
      await office.locator('#next-status').selectOption(status);
      await office.locator('#change-status').click();
      await office.locator('#status').filter({hasText: label}).waitFor(); await idle(office);
    }
    const deliveryText = 'synthetic private delivery: approved website outline ' + width;
    await office.locator('#next-status').selectOption('DELIVERED');
    await office.locator('#delivery-text').fill(deliveryText);
    await office.locator('#delivery-url').fill('https://delivery.invalid/private-fixture');
    await select(office, secondId);
    assert.equal(await office.locator('#delivery-text').inputValue(), '');
    assert.equal(await office.locator('#delivery-url').inputValue(), '');
    assert.equal(await office.locator('#next-status').inputValue(), 'REVIEWING');
    await select(office, requestId);
    assert.equal(await office.locator('#delivery-text').inputValue(), deliveryText);
    assert.equal(await office.locator('#next-status').inputValue(), 'DELIVERED');
    await office.locator('#change-status').click();
    await office.locator('#status').filter({hasText: 'ส่งมอบงาน'}).waitFor(); await idle(office);
    await customer.reload(); await notice(customer, 'โหลดคำขอของคุณแล้ว'); await selected(customer, requestId);
    assert.equal(await customer.locator('#delivery pre').textContent(), deliveryText);
    const digest = createHash('sha256').update(deliveryText).digest('hex');
    assert.equal(await customer.locator('#delivery small').textContent(), 'SHA-256: ' + digest);
    assert.equal(db.prepare('SELECT delivery_sha256 FROM ygg_requests WHERE request_id=?').get(requestId).delivery_sha256, digest);
    assert.equal(await customer.locator('#delivery a').getAttribute('href'), 'https://delivery.invalid/private-fixture');
    const foreignDelivery = await other.evaluate(async id => {
      const response = await fetch('/api/v1/requests/' + id); return {status: response.status, body: await response.text()};
    }, requestId);
    assert.equal(foreignDelivery.status, 404); assert.ok(!foreignDelivery.body.includes(deliveryText));
    assert.equal(await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await office.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await customer.screenshot({path: `test-results/request-journey/delivered-customer-${width}.png`, fullPage: true});
    await office.screenshot({path: `test-results/request-journey/delivered-admin-${width}.png`, fullPage: true});

    // Reauthentication never retains another session's request/composer/delivery screen.
    await office.locator('#token').fill('invalid-synthetic-admin-token-'.repeat(2));
    await office.locator('#login button').first().click(); await notice(office, 'กรุณาตรวจรหัสเข้าถึง Admin'); await idle(office);
    assert.equal(await office.locator('#goal').inputValue(), '');
    assert.equal(await office.locator('#delivery-text').inputValue(), '');
    assert.equal(await office.locator('#requests option').count(), 0);
    assert.equal(await office.locator('#messages .message').count(), 0);
    assert.equal(await office.locator('#delivery').textContent(), '');
    assert.ok(!(await office.evaluate(() => JSON.stringify({...localStorage, ...sessionStorage}))).includes(ADMIN_TOKEN));
    await office.locator('#token').fill(ADMIN_TOKEN); await office.locator('#login button').first().click();
    await notice(office, 'เข้าสู่ศูนย์รับงานแล้ว'); await idle(office);
    await Promise.all([office.waitForEvent('load'), office.locator('#logout').click()]);
    assert.equal(await office.locator('#goal').inputValue(), '');
    assert.equal(await office.locator('#messages .message').count(), 0);
    const loggedOut = await office.evaluate(async () => (await fetch('/api/v1/admin/requests')).status);
    assert.equal(loggedOut, 401);
  });
}

test('lost committed message response retries the exact payload once and keeps newer composition', {timeout: 60000}, async t => {
  const {origin, db, newPage} = await fixture(t);
  const page = await newPage(), requestId = await open(page, origin);
  const payloads = [];
  let loseResponse = true;
  await page.route('**/api/v1/requests/' + requestId + '/messages', async route => {
    payloads.push(route.request().postDataJSON());
    if (loseResponse) {
      loseResponse = false;
      await route.fetch(); // Commit to the real isolated workflow before losing the response.
      await route.abort('failed');
    } else await route.continue();
  });
  await page.locator('#text').fill('original once'); await page.locator('#send').click();
  await notice(page, 'เชื่อมต่อไม่สำเร็จ');
  assert.deepEqual(customerMessages(db, requestId), ['original once']);
  await page.locator('#text').fill('newer unsent composition'); await page.locator('#send').click();
  await notice(page, 'บันทึกข้อความแล้ว');
  await page.waitForFunction(() => !document.querySelector('#send').disabled);
  assert.deepEqual(payloads[0], payloads[1]);
  assert.deepEqual(customerMessages(db, requestId), ['original once']);
  assert.equal(await page.locator('#text').inputValue(), 'newer unsent composition');
  await page.locator('#send').click();
  await page.waitForFunction(() => document.querySelector('#text').value === '' && !document.querySelector('#send').disabled);
  assert.notEqual(payloads[2].messageId, payloads[1].messageId);
  assert.deepEqual(customerMessages(db, requestId), ['original once', 'newer unsent composition']);
  await page.screenshot({path: 'test-results/request-journey/uncertain-send-recovered-mobile.png', fullPage: true});
});

test('late response and repeated submit cannot erase edits or cross request composers', {timeout: 60000}, async t => {
  const {origin, db, newPage} = await fixture(t, 1440);
  const page = await newPage(), first = await open(page, origin);
  await save(page, 'request A');
  await page.locator('#new').click(); await notice(page, 'เริ่มร่างใหม่แล้ว'); await idle(page);
  const second = await page.locator('#requests').inputValue(); await save(page, 'request B'); await select(page, first);
  let release, ready;
  const committed = new Promise(resolve => ready = resolve);
  const held = new Promise(resolve => release = resolve);
  let requestCount = 0;
  await page.route('**/api/v1/requests/' + first + '/messages', async route => {
    requestCount++;
    const response = await route.fetch(); ready(); await held; await route.fulfill({response});
  });
  try {
    await page.locator('#text').fill('A sent once'); await page.locator('#send').click(); await committed;
    await page.evaluate(() => document.querySelector('#composer').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})));
    await page.locator('#text').fill('next A draft');
    await select(page, second); assert.equal(await page.locator('#text').inputValue(), '');
    await page.locator('#text').fill('B only draft'); release();
    // Switch back and wait until the original request's in-flight state is released.
    await select(page, first); await page.waitForFunction(() => !document.querySelector('#send').disabled);
    assert.equal(await page.locator('#text').inputValue(), 'next A draft');
    await select(page, second); assert.equal(await page.locator('#text').inputValue(), 'B only draft');
    assert.equal(requestCount, 1); assert.deepEqual(customerMessages(db, first), ['A sent once']); assert.deepEqual(customerMessages(db, second), []);
    await page.screenshot({path: 'test-results/request-journey/request-scoped-composer-desktop.png', fullPage: true});
  } finally { release(); }
});

test('safe network errors preserve edits and canceled browser navigation keeps unsaved brief', {timeout: 60000}, async t => {
  const {origin, newPage} = await fixture(t);
  const page = await newPage(), requestId = await open(page, origin);
  await save(page, 'saved original');
  await page.locator('#goal').fill('unsaved private brief');
  let prompted = false;
  page.once('dialog', async dialog => { prompted = true; assert.equal(dialog.type(), 'beforeunload'); await dialog.dismiss(); });
  await page.goto(origin + '/services').catch(error => assert.match(error.message, /ERR_ABORTED|Navigation/));
  assert.equal(prompted, true); assert.match(page.url(), /\/client$/);
  assert.equal(await page.locator('#goal').inputValue(), 'unsaved private brief');
  await page.route('**/api/v1/requests/' + requestId + '/upsert', route => route.fulfill({status: 502, contentType: 'text/html', body: '<html>INTERNAL_EXCEPTION /private/server.js password=fixture</html>'}));
  await page.locator('#save').click(); await notice(page, 'เชื่อมต่อไม่สำเร็จ'); await idle(page);
  assert.doesNotMatch(await page.locator('#notice').textContent(), /INTERNAL|server\.js|password|Unexpected|JSON/);
  assert.equal(await page.locator('#goal').inputValue(), 'unsaved private brief');
  await page.unroute('**/api/v1/requests/' + requestId + '/upsert');
  await page.locator('#save').click(); await notice(page, 'บันทึกร่างแล้ว'); await idle(page);
  await page.reload(); await notice(page, 'โหลดคำขอของคุณแล้ว');
  assert.equal(await page.locator('#goal').inputValue(), 'unsaved private brief');
  await page.screenshot({path: 'test-results/request-journey/network-recovery-mobile.png', fullPage: true});
});

test('home Custom Order form creates one owned submitted request and opens its customer readback', {timeout: 60000}, async t => {
  const {origin, db, newPage} = await fixture(t);
  const page = await newPage();
  await page.goto(origin + '/');
  await page.locator('nav a[href="/custom-order"]').click();
  const form = page.locator('#custom-order-form');
  await form.locator('[name=service]').selectOption('digital');
  await form.locator('[name=contact]').fill('synthetic@example.invalid');
  await form.locator('[name=goal]').fill('synthetic direct custom website brief');
  await form.locator('[name=reference]').fill('https://reference.invalid/private-fixture');
  await form.locator('button').click();
  await form.locator('[role=status]').filter({hasText: 'บันทึกคำขอแล้ว รอ Admin ตรวจสอบ'}).waitFor();
  const link = page.locator('#custom-request-link'); await link.waitFor();
  const records = db.prepare('SELECT * FROM ygg_requests').all(); assert.equal(records.length, 1);
  const row = records[0], brief = JSON.parse(row.brief_json);
  assert.equal(row.status, 'SUBMITTED'); assert.equal(brief.serviceLine, 'DIGITAL');
  assert.equal(brief.goal, 'synthetic direct custom website brief');
  assert.match(brief.audience, /synthetic@example\.invalid/);
  assert.equal(brief.materials, 'https://reference.invalid/private-fixture');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ygg_request_events WHERE request_id=? AND to_value='SUBMITTED'").get(row.request_id).n, 1);
  await link.click(); await notice(page, 'โหลดคำขอของคุณแล้ว'); await selected(page, row.request_id);
  assert.equal(await page.locator('#serviceLine').inputValue(), 'DIGITAL');
  assert.equal(await page.locator('#goal').inputValue(), brief.goal);
  assert.equal(await page.locator('#status').textContent(), 'ศูนย์รับงาน');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM ygg_requests').get().n, 1, 'readback must not silently create a second draft');
  await page.screenshot({path: 'test-results/request-journey/custom-order-submitted-mobile.png', fullPage: true});
});

test('custom form lost confirmation response retries one request and retains newer edits', {timeout: 60000}, async t => {
  const {origin, db, newPage} = await fixture(t, 1440);
  const page = await newPage();
  await page.goto(origin + '/'); await page.locator('nav a[href="/custom-order"]').click();
  const form = page.locator('#custom-order-form');
  await form.locator('[name=service]').selectOption('digital');
  await form.locator('[name=contact]').fill('synthetic-retry@example.invalid');
  await form.locator('[name=goal]').fill('original immutable custom brief');
  let lost = false;
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    if (!lost && request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/confirm')) {
      const response = await route.fetch();
      assert.equal(response.status(), 200, 'the isolated server must commit confirmation before response loss');
      lost = true; await route.abort('failed');
    } else await route.continue();
  });
  await form.locator('button').click();
  await page.waitForFunction(() => !document.querySelector('#custom-order-form button').disabled);
  assert.equal(lost, true);
  assert.equal(await form.locator('[name=goal]').inputValue(), 'original immutable custom brief');
  assert.match(await form.locator('[role=status]').textContent(), /ไม่สำเร็จ|ลอง/);
  const first = db.prepare('SELECT * FROM ygg_requests').all(); assert.equal(first.length, 1); assert.equal(first[0].status, 'SUBMITTED');
  await form.locator('[name=goal]').fill('newer custom composition must remain');
  await form.locator('button').click();
  await form.locator('[role=status]').filter({hasText: 'บันทึกคำขอแล้ว รอ Admin ตรวจสอบ'}).waitFor();
  assert.equal(await form.locator('[name=goal]').inputValue(), 'newer custom composition must remain');
  const rows = db.prepare('SELECT * FROM ygg_requests').all(); assert.equal(rows.length, 1);
  assert.equal(rows[0].request_id, first[0].request_id); assert.equal(JSON.parse(rows[0].brief_json).goal, 'original immutable custom brief');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ygg_request_events WHERE request_id=? AND to_value='SUBMITTED'").get(rows[0].request_id).n, 1);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('yggmetro-request-selection')), rows[0].request_id);
  await page.locator('#custom-request-link').waitFor();
  await page.screenshot({path: 'test-results/request-journey/custom-order-response-loss-desktop.png', fullPage: true});
});

async function fillReloadFixture(form, goal, contact) {
  await form.locator('[name=service]').selectOption('digital');
  await form.locator('[name=contact]').fill(contact);
  await form.locator('[name=goal]').fill(goal);
  await form.locator('[name=reference]').fill('https://reference.invalid/reload-fixture');
}
async function assertOnlyRequestIdsStored(page, id, privateValues) {
  const storage = await page.evaluate(() => ({session: Object.fromEntries(Object.entries(sessionStorage)), local: Object.fromEntries(Object.entries(localStorage))}));
  assert.ok(Object.values(storage.session).includes(id), 'same-tab recovery must retain its request ID');
  assert.ok(Object.values(storage.session).every(value => value === id), 'persist only the opaque request ID, not form data or credentials');
  const serialized = JSON.stringify(storage);
  for (const value of [...privateValues, ADMIN_TOKEN]) assert.ok(!serialized.includes(value), 'private form values and credentials must not enter browser storage');
}
async function acceptReloadWarning(page) {
  let prompted = false;
  page.once('dialog', async dialog => { prompted = true; assert.equal(dialog.type(), 'beforeunload'); await dialog.accept(); });
  await page.reload();
  assert.equal(prompted, true, 'leaving an uncertain submission must warn before the real browser reload');
}

test('lost custom confirmation survives real reload through owned readback without duplicate submission', {timeout: 60000}, async t => {
  const {origin, db, newPage} = await fixture(t);
  const page = await newPage(); await page.goto(origin + '/custom-order');
  const form = page.locator('#custom-order-form');
  const goal = 'private reload-confirm synthetic brief', contact = 'reload-confirm@example.invalid';
  await fillReloadFixture(form, goal, contact);
  let lost = false;
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    if (!lost && request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/confirm')) {
      const response = await route.fetch(); assert.equal(response.status(), 200);
      lost = true; await route.abort('failed');
    } else await route.continue();
  });
  await form.locator('button').click();
  await page.waitForFunction(() => !document.querySelector('#custom-order-form button').disabled);
  assert.equal(lost, true); assert.match(await form.locator('[role=status]').textContent(), /ไม่สำเร็จ|ลอง/);
  const before = db.prepare('SELECT * FROM ygg_requests').all(); assert.equal(before.length, 1); assert.equal(before[0].status, 'SUBMITTED');
  const id = before[0].request_id;
  await assertOnlyRequestIdsStored(page, id, [goal, contact]);
  await acceptReloadWarning(page);
  // Recovery must authenticate against the original request before declaring success.
  await form.locator('[role=status]').filter({hasText: 'บันทึกคำขอแล้ว รอ Admin ตรวจสอบ'}).waitFor();
  await page.locator('#custom-request-link').waitFor();
  const after = db.prepare('SELECT * FROM ygg_requests').all(); assert.equal(after.length, 1); assert.equal(after[0].request_id, id);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ygg_request_events WHERE request_id=? AND to_value='SUBMITTED'").get(id).n, 1);
  await assertOnlyRequestIdsStored(page, id, [goal, contact]);
  await page.locator('#custom-request-link').click(); await notice(page, 'โหลดคำขอของคุณแล้ว'); await selected(page, id);
  assert.equal(await page.locator('#goal').inputValue(), goal); assert.equal(await page.locator('#status').textContent(), 'ศูนย์รับงาน');
  await page.screenshot({path: 'test-results/request-journey/custom-confirm-reload-mobile.png', fullPage: true});
});

test('lost custom draft-save response restores server fields after reload and submits the same request once', {timeout: 60000}, async t => {
  const {origin, db, newPage} = await fixture(t, 1440);
  const page = await newPage(); await page.goto(origin + '/custom-order');
  const form = page.locator('#custom-order-form');
  const goal = 'private reload-draft synthetic brief', contact = 'reload-draft@example.invalid';
  await fillReloadFixture(form, goal, contact);
  let lost = false;
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    if (!lost && request.method() === 'POST' && /^\/api\/v1\/requests\/BRIEF-[^/]+$/.test(new URL(request.url()).pathname)) {
      const response = await route.fetch(); assert.equal(response.status(), 200);
      lost = true; await route.abort('failed');
    } else await route.continue();
  });
  await form.locator('button').click();
  await page.waitForFunction(() => !document.querySelector('#custom-order-form button').disabled);
  assert.equal(lost, true); assert.match(await form.locator('[role=status]').textContent(), /ไม่สำเร็จ|ลอง/);
  const before = db.prepare('SELECT * FROM ygg_requests').all(); assert.equal(before.length, 1); assert.equal(before[0].status, 'DRAFT');
  const id = before[0].request_id;
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ygg_request_events WHERE request_id=? AND to_value='SUBMITTED'").get(id).n, 0);
  await assertOnlyRequestIdsStored(page, id, [goal, contact]);
  await acceptReloadWarning(page);
  await page.waitForFunction(expected => document.querySelector('#custom-order-form [name=goal]').value === expected && !document.querySelector('#custom-order-form button').disabled, goal);
  assert.equal(await form.locator('[name=service]').inputValue(), 'digital');
  assert.equal(await form.locator('[name=contact]').inputValue(), contact);
  assert.equal(await form.locator('[name=reference]').inputValue(), 'https://reference.invalid/reload-fixture');
  await assertOnlyRequestIdsStored(page, id, [goal, contact]);
  await form.locator('button').click();
  await form.locator('[role=status]').filter({hasText: 'บันทึกคำขอแล้ว รอ Admin ตรวจสอบ'}).waitFor();
  const after = db.prepare('SELECT * FROM ygg_requests').all(); assert.equal(after.length, 1); assert.equal(after[0].request_id, id); assert.equal(after[0].status, 'SUBMITTED');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ygg_request_events WHERE request_id=? AND to_value='SUBMITTED'").get(id).n, 1);
  await page.locator('#custom-request-link').click(); await notice(page, 'โหลดคำขอของคุณแล้ว'); await selected(page, id);
  assert.equal(await page.locator('#goal').inputValue(), goal);
  await page.screenshot({path: 'test-results/request-journey/custom-draft-reload-desktop.png', fullPage: true});
});
