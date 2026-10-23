const test = require('node:test');
const assert = require('node:assert/strict');
const sandbox = {SHOP_ENVIRONMENT:'sandbox', SHOP_SANDBOX_ORIGIN:'https://shop-sandbox.example'};
const page = async (path, env=sandbox, origin=sandbox.SHOP_SANDBOX_ORIGIN) => {
  const {default:web} = await import('../src/index.js');
  return web.fetch(new Request(origin + path), env);
};

test('isolated sandbox serves shop, assets and payment routes on its exact origin', async () => {
  assert.match(await (await page('/cart')).text(), /Shopping cart/);
  const asset = await page('/assets/shop/test.svg', {...sandbox, ASSETS:{fetch:async()=>new Response('isolated asset')}});
  assert.equal(await asset.text(), 'isolated asset');
  const {default:web} = await import('../src/index.js');
  const checkout = await web.fetch(new Request(sandbox.SHOP_SANDBOX_ORIGIN+'/api/v1/shop/checkout', {
    method:'POST', headers:{origin:sandbox.SHOP_SANDBOX_ORIGIN, 'content-type':'application/json'},
    body:JSON.stringify({slug:'shop-home', requestId:'a'.repeat(64)})
  }), sandbox);
  assert.equal(checkout.status, 503);
  assert.equal((await checkout.json()).code, 'CHECKOUT_NOT_READY');
  assert.equal((await page('/order')).status, 200);
});

test('sandbox rejects production, foreign host and HTTP even when forwarded host claims sandbox', async () => {
  for(const origin of ['https://shop.yggmetro.com','https://foreign.example','http://shop-sandbox.example']) {
    assert.equal((await page('/cart', sandbox, origin)).status, 404);
  }
  const {default:web} = await import('../src/index.js');
  const response = await web.fetch(new Request('https://foreign.example/cart', {headers:{'x-forwarded-host':'shop-sandbox.example'}}), sandbox);
  assert.equal(response.status, 404);
});

test('invalid sandbox configuration fails closed without falling back to production', async () => {
  const cases = [
    {...sandbox, SHOP_ENVIRONMENT:'production'},
    {...sandbox, STRIPE_CHECKOUT_MODE:'live'},
    {...sandbox, STRIPE_CHECKOUT_MODE:'typo'},
    {SHOP_ENVIRONMENT:'sandbox'},
    ...['http://shop-sandbox.example','https://shop.yggmetro.com','https://yggmetro.com',
      'https://office.yggmetro.com','https://shop-sandbox.example/path','https://shop-sandbox.example?x=1',
      'https://shop-sandbox.example#x','https://user:password@shop-sandbox.example',
      'https://shop-sandbox.example:8443','https://127.0.0.1','https://localhost','*', ''].map(SHOP_SANDBOX_ORIGIN=>({...sandbox,SHOP_SANDBOX_ORIGIN}))
  ];
  for(const env of cases) {
    for(const origin of [sandbox.SHOP_SANDBOX_ORIGIN, 'https://shop.yggmetro.com'])
      assert.equal((await page('/cart',env,origin)).status,404,JSON.stringify(env));
  }
});

test('sandbox pages are non-indexable and default production rendering is preserved', async () => {
  const response = await page('/cart');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  const production = await page('/cart',{},'https://shop.yggmetro.com');
  assert.equal(production.status,200);
  assert.match(await production.text(), /Shopping cart/);
  assert.equal(production.headers.get('x-robots-tag'), null);
});
