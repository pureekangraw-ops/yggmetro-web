const test=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../src/index.js');
const page=async(path,env={})=>{const {default:web}=await load();return web.fetch(new Request('https://shop.yggmetro.com'+path),env)};
test('home is a visual entrance with separate catalog, work and service destinations',async()=>{
 const html=await(await page('/')).text();
 for(const href of ['/shop','/portfolio','/services','/how-to-buy','/client'])assert.ok(html.includes('href="'+href+'"'));
 assert.match(html,/id="showcase"/);assert.match(html,/cloud-hero\.jpg/);
 assert.doesNotMatch(html,/id="products"|id="services"|id="how"|<iframe/);
 for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Function(script[1]));
});
test('all subpages and image collection resolve with canonical and unknown pages are 404',async()=>{
 for(const path of ['/shop','/shop/','/portfolio','/portfolio/cloud-stories','/services','/how-to-buy']){
 const response=await page(path);assert.equal(response.status,200,path);assert.match(await response.text(),/rel="canonical"/)}
 assert.equal((await page('/nothing-here')).status,404);
 const portfolio=await(await page('/portfolio/cloud-stories')).text();
 assert.equal((portfolio.match(/class="portfolio-image"/g)||[]).length,5);
 assert.doesNotMatch(portfolio,/4K|ซื้อทันที/);
});
test('HERMES is the customer-facing intake name while original hub surface stays compatible',async()=>{
 const html=await(await page('/client')).text();
 assert.match(html,/<title>HERMES/);assert.match(html,/คุยกับ HERMES/);
 assert.doesNotMatch(html,/คุยกับ SPECTRUMSALE|ผม SPECTRUMSALE/);
 assert.match(html,/surface:'SPECTRUMSALE'/);
});
test('static image routes use asset binding and never return HTML on missing assets',async()=>{
 let called=false;
 const response=await page('/assets/shop/cloud-hero.jpg',{ASSETS:{fetch:async r=>{called=true;assert.match(r.url,/cloud-hero/);return new Response('jpeg',{headers:{'content-type':'image/jpeg'}})}}});
 assert.ok(called);assert.equal(response.headers.get('content-type'),'image/jpeg');
 assert.equal((await page('/assets/shop/missing.jpg')).status,404);
});
