const test=require('node:test'),assert=require('node:assert/strict');
const page=async(path,env={})=>{const {default:web}=await import('../src/index.js');return web.fetch(new Request('https://shop.yggmetro.com'+path),env)};
test('home is an entrance and never renders the full catalog, services or FAQ',async()=>{
 const html=await(await page('/')).text();
 for(const href of ['/shop','/portfolio','/custom-order'])assert.ok(html.includes('href="'+href+'"'));
 assert.match(html,/class="entrances"/);
 assert.match(html,/id="showcase"/);
 assert.doesNotMatch(html,/id="products"|id="services"|id="how"|<iframe|<summary>/);
 assert.doesNotMatch(html,/href="https:\/\/yggmetro.com\/"/);
});
test('store sections have distinct routes and shop does not append unrelated sections',async()=>{
 for(const path of ['/shop','/shop/','/portfolio','/portfolio/cloud-stories','/custom-order','/services','/how-to-buy']){
  const r=await page(path);assert.equal(r.status,200,path);
  const html=await r.text();assert.match(html,/rel="canonical"/);
  for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Function(script[1]));
 }
 const shop=await(await page('/shop')).text();
 assert.doesNotMatch(shop,/id="services"|id="how"|<summary>/);
 assert.equal((await page('/missing')).status,404);
});
test('static images use asset binding and missing assets cannot fall through to homepage',async()=>{
 const r=await page('/assets/shop/brand-hero.jpg',{ASSETS:{fetch:async()=>new Response('image',{headers:{'content-type':'image/jpeg'}})}});
 assert.equal(r.headers.get('content-type'),'image/jpeg');
 assert.equal((await page('/assets/shop/missing.jpg')).status,404);
});
