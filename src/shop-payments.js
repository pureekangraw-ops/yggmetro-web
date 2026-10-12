const FIXTURE_SKU = "stripe-test-digital-fixture";
const FIXTURE_NAME = "YGG METRO test fixture — digital download";
const FIXTURE_AMOUNT = 100;
const FIXTURE_CURRENCY = "usd";
const FIXTURE_FILE = "YGG METRO TEST FIXTURE\nThis file proves the test-only paid-delivery path. It is not a real product.\n";
const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
const json = (value, status = 200) => Response.json(value, { status, headers: NO_STORE });
const error = (code, status) => json({ ok: false, code }, status);

function testMode(env) { return env?.SHOP_MODE === "test"; }
function databaseReady(env) { return Boolean(env?.SHOP_DB && typeof env.SHOP_DB.prepare === "function"); }
function testSecret(env) { return typeof env?.STRIPE_SECRET_KEY_TEST === "string" && env.STRIPE_SECRET_KEY_TEST.startsWith("sk_test_"); }
function webhookSecret(env) { return typeof env?.STRIPE_WEBHOOK_SECRET_TEST === "string" && env.STRIPE_WEBHOOK_SECRET_TEST.startsWith("whsec_"); }
function hex(bytes) { return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join(""); }
function equalHex(a, b) { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
async function digest(text) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))); }
async function newAccessToken() { return hex(crypto.getRandomValues(new Uint8Array(32))); }
function d1(env, sql, ...values) { return env.SHOP_DB.prepare(sql).bind(...values); }

async function stripeRequest(env, path, params, idempotencyKey) {
  const send = typeof env.STRIPE_TEST_FETCH === "function" ? env.STRIPE_TEST_FETCH : fetch;
  const headers = { authorization: `Bearer ${env.STRIPE_SECRET_KEY_TEST}`, "content-type": "application/x-www-form-urlencoded" };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  return send(`https://api.stripe.com/v1${path}`, { method: "POST", headers, body: params.toString() });
}

async function createCheckout(request, env) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
  if (!testMode(env)) return error("NOT_FOUND", 404);
  if (!databaseReady(env) || !testSecret(env)) return error("TEST_CHECKOUT_UNAVAILABLE", 503);
  const raw = await request.text();
  if (raw.length > 4096) return error("PAYLOAD_TOO_LARGE", 413);
  if (raw.trim()) {
    let input;
    try { input = JSON.parse(raw); } catch { return error("INVALID_JSON", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 0) return error("TEST_FIXTURE_ONLY", 400);
  }

  const orderId = crypto.randomUUID();
  const accessToken = await newAccessToken();
  const tokenHash = await digest(accessToken);
  const now = new Date().toISOString();
  try {
    await d1(env, `INSERT INTO shop_test_orders (id, access_token_sha256, fixture_sku, amount, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`, orderId, tokenHash, FIXTURE_SKU, FIXTURE_AMOUNT, FIXTURE_CURRENCY, now, now).run();
  } catch {
    return error("ORDER_STORE_UNAVAILABLE", 503);
  }

  const origin = new URL(request.url).origin;
  const success = new URL("/test/checkout/success", origin);
  success.searchParams.set("token", accessToken);
  success.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  const cancel = new URL("/test/checkout/cancel", origin);
  cancel.searchParams.set("token", accessToken);
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("line_items[0][price_data][currency]", FIXTURE_CURRENCY);
  params.set("line_items[0][price_data][unit_amount]", String(FIXTURE_AMOUNT));
  params.set("line_items[0][price_data][product_data][name]", FIXTURE_NAME);
  params.set("line_items[0][quantity]", "1");
  params.set("client_reference_id", orderId);
  params.set("metadata[order_id]", orderId);
  params.set("metadata[fixture_sku]", FIXTURE_SKU);
  params.set("success_url", success.toString());
  params.set("cancel_url", cancel.toString());

  let response, session;
  try {
    response = await stripeRequest(env, "/checkout/sessions", params, `shop-test-${orderId}`);
    session = await response.json();
  } catch {
    await d1(env, `UPDATE shop_test_orders SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'pending'`, new Date().toISOString(), orderId).run().catch(() => {});
    return error("STRIPE_TEST_CHECKOUT_FAILED", 502);
  }
  let checkoutUrl;
  try { checkoutUrl = new URL(session?.url); } catch { checkoutUrl = null; }
  if (!response.ok || !session?.id?.startsWith("cs_test_") || checkoutUrl?.protocol !== "https:" || checkoutUrl?.hostname !== "checkout.stripe.com") {
    await d1(env, `UPDATE shop_test_orders SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'pending'`, new Date().toISOString(), orderId).run().catch(() => {});
    return error("STRIPE_TEST_CHECKOUT_FAILED", 502);
  }
  try {
    await d1(env, `UPDATE shop_test_orders SET stripe_checkout_session_id = ?, updated_at = ? WHERE id = ? AND status = 'pending'`, session.id, new Date().toISOString(), orderId).run();
  } catch {
    return error("ORDER_STORE_UNAVAILABLE", 503);
  }
  return json({ ok: true, mode: "test", fixture: FIXTURE_SKU, amount: FIXTURE_AMOUNT, currency: FIXTURE_CURRENCY, orderToken: accessToken, checkoutUrl: checkoutUrl.toString() }, 201);
}

async function sign(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}
async function validStripeSignature(raw, header, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof header !== "string") return false;
  const parts = header.split(",").map(value => value.trim());
  const timestamp = parts.find(value => value.startsWith("t="))?.slice(2);
  const signatures = parts.filter(value => value.startsWith("v1=")).map(value => value.slice(3).toLowerCase());
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length || Math.abs(nowSeconds - Number(timestamp)) > 300) return false;
  const expected = await sign(secret, `${timestamp}.${raw}`);
  return signatures.some(value => /^[a-f0-9]{64}$/.test(value) && equalHex(value, expected));
}

async function stripeWebhook(request, env) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
  if (!testMode(env)) return error("NOT_FOUND", 404);
  if (!databaseReady(env) || !webhookSecret(env)) return error("TEST_WEBHOOK_UNAVAILABLE", 503);
  const raw = await request.text();
  if (raw.length > 256 * 1024) return error("PAYLOAD_TOO_LARGE", 413);
  if (!await validStripeSignature(raw, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET_TEST)) return error("INVALID_STRIPE_SIGNATURE", 400);
  let event;
  try { event = JSON.parse(raw); } catch { return error("INVALID_JSON", 400); }
  if (!event?.id || !event?.type) return error("INVALID_EVENT", 400);
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return json({ ok: true, ignored: true });
  const session = event.data?.object;
  if (!session || session.mode !== "payment" || session.payment_status !== "paid" || session.currency !== FIXTURE_CURRENCY || session.amount_total !== FIXTURE_AMOUNT || session.metadata?.fixture_sku !== FIXTURE_SKU || !session.id?.startsWith("cs_test_")) return json({ ok: true, ignored: true });
  const orderId = session.client_reference_id || session.metadata?.order_id;
  if (!orderId || orderId !== session.metadata?.order_id) return json({ ok: true, ignored: true });
  try {
    const order = await d1(env, `SELECT id, fixture_sku, amount, currency, status, stripe_checkout_session_id FROM shop_test_orders WHERE id = ? LIMIT 1`, orderId).first();
    if (!order || order.fixture_sku !== FIXTURE_SKU || order.amount !== FIXTURE_AMOUNT || order.currency !== FIXTURE_CURRENCY || order.stripe_checkout_session_id !== session.id) return json({ ok: true, ignored: true });
    await d1(env, `INSERT OR IGNORE INTO shop_test_stripe_events (stripe_event_id, event_type, order_id, received_at) VALUES (?, ?, ?, ?)`, event.id, event.type, orderId, new Date().toISOString()).run();
    const result = await d1(env, `UPDATE shop_test_orders SET status = 'paid', stripe_payment_status = 'paid', paid_at = ?, updated_at = ? WHERE id = ? AND stripe_checkout_session_id = ? AND fixture_sku = ? AND amount = ? AND currency = ? AND status = 'pending'`, new Date().toISOString(), new Date().toISOString(), orderId, session.id, FIXTURE_SKU, FIXTURE_AMOUNT, FIXTURE_CURRENCY).run();
    return json({ ok: true, received: true, transitioned: Number(result?.meta?.changes ?? result?.changes ?? 0) > 0 });
  } catch {
    return error("ORDER_STORE_UNAVAILABLE", 500);
  }
}

async function findOrder(env, token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = await digest(token);
  return d1(env, `SELECT id, fixture_sku, amount, currency, status, stripe_checkout_session_id, created_at, paid_at, delivered_at FROM shop_test_orders WHERE access_token_sha256 = ? LIMIT 1`, tokenHash).first();
}
async function orderStatus(request, env, token, delivery = false) {
  if (!testMode(env)) return error("NOT_FOUND", 404);
  if (!delivery && request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET" } });
  if (!databaseReady(env)) return error("TEST_ORDER_STORE_UNAVAILABLE", 503);
  let order;
  try { order = await findOrder(env, token); } catch { return error("ORDER_STORE_UNAVAILABLE", 503); }
  if (!order) return error("ORDER_NOT_FOUND", 404);
  if (!delivery) return json({ ok: true, fixture: order.fixture_sku, status: order.status, amount: order.amount, currency: order.currency, paidAt: order.paid_at || null, deliveryAvailable: order.status === "paid" });
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET" } });
  if (order.status !== "paid" || order.stripe_checkout_session_id == null) return error("PAYMENT_NOT_CONFIRMED", 409);
  try {
    const now = new Date().toISOString();
    await d1(env, `UPDATE shop_test_orders SET delivered_at = COALESCE(delivered_at, ?), updated_at = ? WHERE id = ? AND status = 'paid'`, now, now, order.id).run();
  } catch { return error("ORDER_STORE_UNAVAILABLE", 503); }
  return new Response(FIXTURE_FILE, { status: 200, headers: { ...NO_STORE, "content-type": "text/plain; charset=utf-8", "content-disposition": 'attachment; filename="yggmetro-test-fixture.txt"' } });
}

async function cancelOrder(request, env, token) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
  if (!testMode(env)) return error("NOT_FOUND", 404);
  if (!databaseReady(env) || !testSecret(env)) return error("TEST_CHECKOUT_UNAVAILABLE", 503);
  const raw = await request.text();
  if (raw.trim()) return error("EMPTY_BODY_REQUIRED", 400);
  let order;
  try { order = await findOrder(env, token); } catch { return error("ORDER_STORE_UNAVAILABLE", 503); }
  if (!order) return error("ORDER_NOT_FOUND", 404);
  if (order.status === "cancelled") return json({ ok: true, status: "cancelled" });
  if (order.status !== "pending" || !order.stripe_checkout_session_id?.startsWith("cs_test_")) return error("ORDER_NOT_CANCELLABLE", 409);
  let response, session;
  try {
    response = await stripeRequest(env, `/checkout/sessions/${encodeURIComponent(order.stripe_checkout_session_id)}/expire`, new URLSearchParams(), `shop-test-expire-${order.id}`);
    session = await response.json();
  } catch { return error("STRIPE_TEST_CANCEL_FAILED", 502); }
  if (!response.ok || session?.status !== "expired") return error("ORDER_NOT_CANCELLABLE", 409);
  try {
    await d1(env, `UPDATE shop_test_orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'pending'`, new Date().toISOString(), order.id).run();
  } catch { return error("ORDER_STORE_UNAVAILABLE", 503); }
  return json({ ok: true, status: "cancelled" });
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
function testPage(title, message, script = "") {
  return new Response(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)} · YGG METRO Test</title><body style="font:16px/1.6 system-ui,sans-serif;max-width:680px;margin:10vh auto;padding:24px;color:#10254b;background:#f7fbff"><main><p style="color:#185bdc;font-weight:700">TEST MODE · ไม่ใช่การซื้อสินค้าจริง</p><h1>${escapeHtml(title)}</h1><p>${message}</p><div id="status" aria-live="polite"></div>${script}</main></body></html>`, { headers: { ...NO_STORE, "content-type": "text/html; charset=utf-8" } });
}
async function successPage(request, env) {
  if (!testMode(env)) return error("NOT_FOUND", 404);
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET" } });
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return testPage("กำลังตรวจสอบคำสั่งทดสอบ", "หน้าสำเร็จเพียงอย่างเดียวไม่ยืนยันการชำระเงิน การส่งมอบจะเปิดเมื่อ Webhook ที่ตรวจลายเซ็นแล้วระบุว่าชำระสำเร็จเท่านั้น");
  const safeToken = JSON.stringify(token);
  const script = `<script>(()=>{const token=${safeToken};let tries=0;async function check(){tries++;try{const r=await fetch('/api/test/orders/'+encodeURIComponent(token),{cache:'no-store'});const order=await r.json();const root=document.querySelector('#status');if(order.status==='paid'&&order.deliveryAvailable){root.innerHTML='<p>ยืนยันการชำระจาก Webhook แล้ว · ไฟล์นี้เป็น Test Fixture เท่านั้น</p><a href="/api/test/orders/'+encodeURIComponent(token)+'/delivery">รับไฟล์ทดสอบ</a>';return}root.textContent='สถานะ: '+(order.status||'กำลังตรวจสอบ')+' — หน้านี้ไม่ใช่หลักฐานการชำระ';if(tries<24)setTimeout(check,2500)}catch{document.querySelector('#status').textContent='ยังอ่านสถานะคำสั่งทดสอบไม่ได้'} }check()})();</script>`;
  return testPage("กำลังตรวจสอบการชำระเงิน", "ไม่ส่งมอบไฟล์จากหน้า Success โดยตรง; รอผล Stripe Webhook ที่ตรวจสอบลายเซ็นแล้ว", script);
}
async function cancelPage(request, env) {
  if (!testMode(env)) return error("NOT_FOUND", 404);
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET" } });
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return testPage("Checkout ถูกยกเลิก", "การกลับมาหน้านี้ไม่ใช่หลักฐานสถานะคำสั่งซื้อ");
  const script = `<form method="post" action="/api/test/orders/${token}/cancel"><button type="submit">ปิด Checkout สำหรับการทดสอบ</button></form><p>การปิด Session จะยืนยันผ่าน Stripe Test API; ถ้าชำระไปแล้ว คำสั่งนี้จะไม่เปลี่ยนสถานะ</p>`;
  return testPage("Checkout ถูกยกเลิก", "ไม่มีการส่งมอบจากการกลับมาหน้านี้; สามารถปิด Session ทดสอบที่ยังเปิดอยู่ได้", script);
}

export async function handleShopPaymentRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/api/test/checkout") return createCheckout(request, env);
  if (url.pathname === "/api/test/stripe/webhook") return stripeWebhook(request, env);
  const order = url.pathname.match(/^\/api\/test\/orders\/([a-f0-9]{64})(\/delivery|\/cancel)?$/);
  if (order) {
    const [, token, action] = order;
    if (action === "/cancel") return cancelOrder(request, env, token);
    return orderStatus(request, env, token, action === "/delivery");
  }
  if (url.pathname === "/test/checkout/success") return successPage(request, env);
  if (url.pathname === "/test/checkout/cancel") return cancelPage(request, env);
  return error("NOT_FOUND", 404);
}

export const shopTestFixture = Object.freeze({ sku: FIXTURE_SKU, amount: FIXTURE_AMOUNT, currency: FIXTURE_CURRENCY, name: FIXTURE_NAME });
