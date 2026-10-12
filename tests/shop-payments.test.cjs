const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const load = () => import(pathToFileURL(path.resolve(__dirname, '../src/index.js')).href);
const secret = 'whsec_test_unit_only';

class FakeD1 {
  constructor() { this.orders = new Map(); this.events = new Map(); }
  prepare(sql) {
    const db = this;
    return { bind(...args) {
      return {
        async first() {
          if (sql.includes('WHERE access_token_sha256 = ?')) return [...db.orders.values()].find(row => row.access_token_sha256 === args[0]) || null;
          if (sql.includes('WHERE id = ?')) return db.orders.get(args[0]) || null;
          throw new Error('unhandled first: ' + sql);
        },
        async run() {
          if (sql.startsWith('INSERT INTO shop_test_orders')) {
            const [id, access_token_sha256, fixture_sku, amount, currency, created_at, updated_at] = args;
            db.orders.set(id, { id, access_token_sha256, fixture_sku, amount, currency, status: 'pending', created_at, updated_at, stripe_payment_status: null, stripe_checkout_session_id: null, paid_at: null, delivered_at: null });
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith('INSERT OR IGNORE INTO shop_test_stripe_events')) {
            const [stripe_event_id, event_type, order_id, received_at] = args;
            if (!db.events.has(stripe_event_id)) db.events.set(stripe_event_id, { stripe_event_id, event_type, order_id, received_at });
            return { meta: { changes: db.events.has(stripe_event_id) ? 1 : 0 } };
          }
          if (sql.startsWith('UPDATE shop_test_orders SET stripe_checkout_session_id')) {
            const [stripe_checkout_session_id, updated_at, id] = args; const row = db.orders.get(id);
            if (row?.status === 'pending') { row.stripe_checkout_session_id = stripe_checkout_session_id; row.updated_at = updated_at; return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
          }
          if (sql.startsWith("UPDATE shop_test_orders SET status = 'failed'")) {
            const [updated_at, id] = args; const row = db.orders.get(id);
            if (row?.status === 'pending') { row.status = 'failed'; row.updated_at = updated_at; return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
          }
          if (sql.startsWith("UPDATE shop_test_orders SET status = 'paid'")) {
            const [paid_at, updated_at, id, session_id, sku, amount, currency] = args; const row = db.orders.get(id);
            if (row?.status === 'pending' && row.stripe_checkout_session_id === session_id && row.fixture_sku === sku && row.amount === amount && row.currency === currency) {
              row.status = 'paid'; row.stripe_payment_status = 'paid'; row.paid_at = paid_at; row.updated_at = updated_at; return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          }
          if (sql.startsWith("UPDATE shop_test_orders SET status = 'cancelled'")) {
            const [updated_at, id] = args; const row = db.orders.get(id);
            if (row?.status === 'pending') { row.status = 'cancelled'; row.updated_at = updated_at; return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
          }
          if (sql.startsWith('UPDATE shop_test_orders SET delivered_at')) {
            const [delivered_at, updated_at, id] = args; const row = db.orders.get(id);
            if (row?.status === 'paid') { row.delivered_at ||= delivered_at; row.updated_at = updated_at; return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
          }
          throw new Error('unhandled run: ' + sql);
        }
      };
    } };
  }
}
function env() {
  const db = new FakeD1();
  const calls = [];
  const base = {
    db, SHOP_MODE: 'test', SHOP_DB: db, STRIPE_SECRET_KEY_TEST: 'sk_test_unit_only', STRIPE_WEBHOOK_SECRET_TEST: secret, calls,
    STRIPE_TEST_FETCH: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/checkout/sessions')) return Response.json({ id: 'cs_test_fixture_001', url: 'https://checkout.stripe.com/c/pay/cs_test_fixture_001' });
      if (String(url).endsWith('/expire')) return Response.json({ id: 'cs_test_fixture_001', status: 'expired' });
      throw new Error('unexpected Stripe URL ' + url);
    }
  };
  return base;
}
async function createOrder(web, runtime, body) {
  const response = await web.fetch(new Request('https://shop.yggmetro.com/api/test/checkout', { method: 'POST', ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) }), runtime);
  return { response, body: await response.json() };
}
async function signature(payload, t = Math.floor(Date.now() / 1000), signingSecret = secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  const v1 = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
  return `t=${t},v1=${v1}`;
}
async function sendWebhook(web, runtime, event, sig) {
  const payload = JSON.stringify(event);
  const signatureHeader = sig || await signature(payload);
  return web.fetch(new Request('https://shop.yggmetro.com/api/test/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': signatureHeader }, body: payload }), runtime);
}
function paidEvent(order, id = 'evt_test_paid_001', overrides = {}) {
  return { id, type: 'checkout.session.completed', data: { object: {
    id: 'cs_test_fixture_001', livemode: false, mode: 'payment', payment_status: 'paid', currency: 'usd', amount_total: 100,
    client_reference_id: order.id, metadata: { order_id: order.id, fixture_sku: 'stripe-test-digital-fixture' }, ...overrides
  } } };
}

test('test checkout is absent in production and never falls back to existing live bindings', async () => {
  const { default: web } = await load(); let called = false;
  const response = await web.fetch(new Request('https://shop.yggmetro.com/api/test/checkout', { method: 'POST' }), {
    SHOP_MODE: 'live', STRIP_SECRET: 'sk_live_do_not_use', STRIP_PRODUCTION: 'true', STRIPE_TEST_FETCH: async () => { called = true; }
  });
  assert.equal(response.status, 404); assert.equal(called, false);
});

test('test checkout requires sk_test secret, database and isolated SHOP_MODE=test', async () => {
  const { default: web } = await load();
  for (const runtime of [
    { SHOP_MODE: 'test', SHOP_DB: new FakeD1(), STRIPE_SECRET_KEY_TEST: 'sk_live_wrong' },
    { SHOP_MODE: 'test', STRIPE_SECRET_KEY_TEST: 'sk_test_only' },
    { SHOP_MODE: 'production', SHOP_DB: new FakeD1(), STRIPE_SECRET_KEY_TEST: 'sk_test_only' }
  ]) {
    const response = await web.fetch(new Request('https://shop.yggmetro.com/api/test/checkout', { method: 'POST' }), runtime);
    assert.ok([404, 503].includes(response.status));
  }
});

test('checkout accepts only an empty fixture request and fixes the Stripe amount server-side', async () => {
  const { default: web } = await load(); const runtime = env();
  const rejected = await createOrder(web, runtime, { amount: 9900, currency: 'thb', productId: 'shop-home' });
  assert.equal(rejected.response.status, 400); assert.equal(runtime.calls.length, 0);
  const { response, body } = await createOrder(web, runtime);
  assert.equal(response.status, 201); assert.equal(body.mode, 'test'); assert.equal(body.amount, 100); assert.equal(body.currency, 'usd');
  assert.match(body.checkoutUrl, /^https:\/\/checkout\.stripe\.com\//); assert.match(body.orderToken, /^[a-f0-9]{64}$/);
  const form = new URLSearchParams(runtime.calls[0].init.body);
  assert.equal(form.get('mode'), 'payment'); assert.equal(form.get('line_items[0][price_data][unit_amount]'), '100');
  assert.equal(form.get('line_items[0][price_data][currency]'), 'usd');
  assert.equal(form.get('line_items[0][price_data][product_data][name]'), 'YGG METRO test fixture — digital download');
  assert.equal(form.get('metadata[fixture_sku]'), 'stripe-test-digital-fixture');
  assert.equal(runtime.calls[0].init.headers.authorization, 'Bearer sk_test_unit_only');
  assert.equal(runtime.calls[0].init.headers['idempotency-key'].startsWith('shop-test-'), true);
  assert.equal(runtime.db.orders.size, 1);
});

test('invalid webhook signature never updates order or exposes the fixture', async () => {
  const { default: web } = await load(); const runtime = env(); const order = (await createOrder(web, runtime)).body;
  const row = [...runtime.db.orders.values()][0];
  const response = await sendWebhook(web, runtime, paidEvent(row), 't=1,v1=bad');
  assert.equal(response.status, 400); assert.equal(runtime.db.orders.get(row.id).status, 'pending');
  const download = await web.fetch(new Request(`https://shop.yggmetro.com/api/test/orders/${order.orderToken}/delivery`), runtime);
  assert.equal(download.status, 409);
});

test('success return does not confirm payment; unpaid completion cannot deliver', async () => {
  const { default: web } = await load(); const runtime = env(); const created = (await createOrder(web, runtime)).body;
  const success = await web.fetch(new Request(`https://shop.yggmetro.com/test/checkout/success?token=${created.orderToken}`), runtime);
  const html = await success.text(); assert.match(html, /ไม่ส่งมอบไฟล์จากหน้า Success/); assert.match(html, /Webhook/);
  const row = [...runtime.db.orders.values()][0];
  const unpaid = paidEvent(row, 'evt_test_unpaid_001', { payment_status: 'unpaid' });
  const webhook = await sendWebhook(web, runtime, unpaid); assert.equal(webhook.status, 200);
  assert.equal((await (await web.fetch(new Request(`https://shop.yggmetro.com/api/test/orders/${created.orderToken}`), runtime)).json()).status, 'pending');
  const delivery = await web.fetch(new Request(`https://shop.yggmetro.com/api/test/orders/${created.orderToken}/delivery`), runtime);
  assert.equal(delivery.status, 409);
});

test('signed paid webhook confirms only matching fixture and delivery is idempotently available', async () => {
  const { default: web } = await load(); const runtime = env(); const created = (await createOrder(web, runtime)).body;
  const row = [...runtime.db.orders.values()][0];
  const response = await sendWebhook(web, runtime, paidEvent(row)); const result = await response.json();
  assert.equal(response.status, 200); assert.equal(result.transitioned, true);
  const state = await (await web.fetch(new Request(`https://shop.yggmetro.com/api/test/orders/${created.orderToken}`), runtime)).json();
  assert.equal(state.status, 'paid'); assert.equal(state.deliveryAvailable, true);
  const download = await web.fetch(new Request(`https://shop.yggmetro.com/api/test/orders/${created.orderToken}/delivery`), runtime);
  assert.equal(download.status, 200); assert.match(await download.text(), /TEST FIXTURE/);
  assert.match(download.headers.get('content-disposition'), /yggmetro-test-fixture\.txt/);
  assert.ok(runtime.db.orders.get(row.id).delivered_at);
  const repeat = await web.fetch(new Request(`https://shop.yggmetro.com/api/test/orders/${created.orderToken}/delivery`), runtime);
  assert.equal(repeat.status, 200);
});

test('duplicate and mismatched Stripe events are safe and cannot change another order', async () => {
  const { default: web } = await load(); const runtime = env(); const created = (await createOrder(web, runtime)).body;
  const row = [...runtime.db.orders.values()][0]; const event = paidEvent(row);
  const first = await sendWebhook(web, runtime, event); assert.equal((await first.json()).transitioned, true);
  const duplicate = await sendWebhook(web, runtime, event); assert.equal((await duplicate.json()).transitioned, false);
  assert.equal(runtime.db.events.size, 1);
  const { body: other } = await createOrder(web, runtime);
  const mismatched = await sendWebhook(web, runtime, paidEvent(row, 'evt_test_mismatch', { amount_total: 9999 }));
  assert.equal(mismatched.status, 200);
  const liveModeEvent = await sendWebhook(web, runtime, paidEvent(row, 'evt_test_live_mode', { livemode: true }));
  assert.equal((await liveModeEvent.json()).ignored, true);
  assert.equal((await (await web.fetch(new Request(`https://shop.yggmetro.com/api/test/orders/${other.orderToken}`), runtime)).json()).status, 'pending');
  assert.equal(runtime.db.orders.get(row.id).status, 'paid');
});

test('stale signed webhook is rejected and Stripe cancellation must confirm expiration', async () => {
  const { default: web } = await load(); const runtime = env(); const created = (await createOrder(web, runtime)).body;
  const row = [...runtime.db.orders.values()][0]; const payload = JSON.stringify(paidEvent(row, 'evt_test_stale'));
  const stale = await sendWebhook(web, runtime, JSON.parse(payload), await signature(payload, Math.floor(Date.now() / 1000) - 301));
  assert.equal(stale.status, 400); assert.equal(runtime.db.orders.get(row.id).status, 'pending');
  const canceled = await web.fetch(new Request(`https://shop.yggmetro.com/api/test/orders/${created.orderToken}/cancel`, { method: 'POST' }), runtime);
  assert.equal(canceled.status, 200); assert.equal((await canceled.json()).status, 'cancelled');
  assert.ok(runtime.calls.at(-1).url.endsWith('/checkout/sessions/cs_test_fixture_001/expire'));
  const delivery = await web.fetch(new Request(`https://shop.yggmetro.com/api/test/orders/${created.orderToken}/delivery`), runtime);
  assert.equal(delivery.status, 409);
});

test('public catalog has no Stripe checkout path or test fixture product', async () => {
  const { default: web } = await load();
  const shop = await (await web.fetch(new Request('https://shop.yggmetro.com/shop'), {})).text();
  assert.doesNotMatch(shop, /stripe-test-digital-fixture|api\/test\/checkout|checkout\.stripe\.com/);
  for (const term of ['Release candidate · Notion draft', 'US$6.99*', 'LIVE · PromptBase / DRAFT · Notion', 'LIVE · Notion Marketplace', 'US$19 (draft)']) assert.ok(shop.includes(term), term);
});
