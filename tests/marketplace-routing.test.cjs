const test = require('node:test');
const assert = require('node:assert/strict');

// Contract fixtures are the owner-supplied destinations already present on main.
// These checks do not visit, authenticate to, or buy from the external platforms.
const destinations = {
  'root-cause': 'https://promptbase.com/app/root-causes-analysis',
  'adaptive-lens': 'https://promptbase.com/skill/adaptive-lens-system',
  'shop-home': 'https://app.notion.com/templates/shop-home',
  'lost-era': 'https://app.notion.com/templates/lost-era-layered-worldbuilding-kit',
};
const anchors = html => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, text]) => ({
  href: /\bhref="([^"]*)"/.exec(attributes)?.[1],
  target: /\btarget="([^"]*)"/.exec(attributes)?.[1],
  rel: /\brel="([^"]*)"/.exec(attributes)?.[1]?.split(/\s+/) || [], text,
}));

test('each marketplace product keeps its exact external CTA on both catalog and detail routes', async () => {
  const {default: web} = await import('../src/index.js');
  for (const [slug, href] of Object.entries(destinations)) {
    for (const route of ['/shop', '/products/' + slug]) {
      const response = await web.fetch(new Request('https://shop.yggmetro.com' + route), {});
      assert.equal(response.status, 200, route);
      const html = await response.text();
      const cta = anchors(html).filter(link => link.href === href);
      assert.equal(cta.length, 1, route + ' must have one matching marketplace CTA');
      assert.equal(cta[0].target, '_blank');
      assert.ok(cta[0].rel.includes('noopener') && cta[0].rel.includes('noreferrer'));
      if (route.startsWith('/products/')) assert.doesNotMatch(html, /<button[^>]*data-add-to-cart=/);
    }
  }
});

test('external marketplace products stay excluded from native cart even with fixture mappings', async () => {
  const {renderShop} = await import('../src/shop.js');
  const catalog = Object.fromEntries(Object.keys(destinations).map(slug => [slug, {enabled: true, priceId: 'price_OFFLINE', amount: 900, currency: 'usd', deliveryKey: 'offline/not-a-deliverable'}]));
  const env = {STRIPE_TEST_CHECKOUT_ENABLED: 'true', STRIPE_TEST_KEY: 'rk_test_offline_fixture', STRIPE_TEST_WEBHOOK_SECRET: 'whsec_offline_fixture', STRIPE_TEST_CATALOG: JSON.stringify(catalog), SHOP_ORDERS: {prepare() {}}, SHOP_DOWNLOADS: {get() {}, head() {}}};
  for (const path of ['/cart', '/checkout']) {
    const {html} = renderShop(path, env);
    const data = JSON.parse(html.match(/const \{catalog,images\}=(.*?);const key=/)[1]);
    assert.deepEqual(data.catalog, [], path + ' must not expose marketplace items as native checkout products');
  }
  for (const [slug, href] of Object.entries(destinations)) {
    const {html} = renderShop('/products/' + slug, env);
    assert.ok(anchors(html).some(link => link.href === href));
    assert.doesNotMatch(html, /<button[^>]*data-add-to-cart=|offline\/not-a-deliverable|rk_test_offline_fixture/);
  }
});

test('unconfigured native checkout stays closed and the unavailable product points to inquiry', async () => {
  const {default: web} = await import('../src/index.js');
  const response = await web.fetch(new Request('https://shop.yggmetro.com/products/finance-simulator'), {});
  const html = await response.text();
  assert.ok(anchors(html).some(link => link.href === '/custom-order?service=lab'));
  assert.doesNotMatch(html, /<button[^>]*data-add-to-cart=/);
  const checkout = await web.fetch(new Request('https://shop.yggmetro.com/api/v1/shop/checkout', {method: 'POST', headers: {'content-type': 'application/json', origin: 'https://shop.yggmetro.com'}, body: JSON.stringify({slug: 'finance-simulator', requestId: 'a'.repeat(64), email: 'offline@example.test'})}), {});
  assert.equal(checkout.status, 503);
  assert.equal((await checkout.json()).ok, false);
});
