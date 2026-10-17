const test=require('node:test'),assert=require('node:assert/strict');
const page=async(path,env={})=>{const {default:web}=await import('../src/index.js');return web.fetch(new Request('https://shop.yggmetro.com'+path),env)};
test('home is an entrance and never renders the full catalog, services or FAQ',async()=>{
 const html=await(await page('/')).text();
 for(const href of ['/shop','/portfolio','/custom-order'])assert.ok(html.includes('href="'+href+'"'));
 assert.doesNotMatch(html,/class="entrances"/);
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

test('all four published products link directly to their original storefront',async()=>{
 const links={ 'root-cause':'https://promptbase.com/app/root-causes-analysis', 'adaptive-lens':'https://promptbase.com/skill/adaptive-lens-system', 'shop-home':'https://app.notion.com/templates/shop-home', 'lost-era':'https://app.notion.com/templates/lost-era-layered-worldbuilding-kit' };
 const shop=await(await page('/shop')).text();
 for(const [slug,url] of Object.entries(links)){
  assert.ok(shop.includes('href="'+url+'"'),slug+' shop CTA');
  const detail=await(await page('/products/'+slug)).text();
  assert.ok(detail.includes('href="'+url+'"'),slug+' detail CTA');
  assert.doesNotMatch(detail,/data-add-to-cart/);
 }
});

test('home is the entry with one primary menu and decorative assets never become portfolio items',async()=>{
 const home=await(await page('/')).text();
 assert.match(home,/<body data-page="home">/);
 assert.match(home,/<link rel="canonical" href="https:\/\/shop.yggmetro.com\/">/);
 for(const route of ['/','/shop','/portfolio','/custom-order']){
  const html=await(await page(route)).text();
  const nav=html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/)[1];
  for(const link of ['/shop','/portfolio','/custom-order'])assert.equal([...nav.matchAll(new RegExp('href="'+link+'"','g'))].length,1,route+' repeats '+link);
  const main=html.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
  assert.doesNotMatch(main,/<img[^>]+src="[^" ]*(?:cloud-hero|cloud-stories|sky-studies|products\/icons|products\/landscape)/,route+' presents decoration as content');
 }
 const portfolio=await(await page('/portfolio')).text();
 assert.doesNotMatch(portfolio,/Icon Collection|Sky Stud|Landscape Study|Cloud Stories/);
});

test('home leads with a clear product promise and two useful starting points',async()=>{
 const home=await(await page('/')).text();
 assert.match(home,/<h1>คิดให้ชัด<br><em>วางแผนให้เป็น<\/em><br>แล้วลงมือได้จริง<\/h1>/);
 assert.match(home,/href="\/shop">เลือกเครื่องมือ/);
 assert.match(home,/href="\/products\/land-planner">ลองใช้เครื่องมือฟรี/);
 assert.match(home,/class="wrap home-hero-grid"/);
 assert.match(home,/class="home-proof"/);
});

test('shop filters become open chips and search gets a usable responsive column',async()=>{
 const shop=await(await page('/shop')).text();
 assert.match(shop,/\.catalog-layout\{display:block\}/);
 assert.match(shop,/\.catalog-layout \.filters\{display:flex;flex-direction:row/);
 assert.match(shop,/\.catalog-tools\{display:grid;grid-template-columns:minmax\(0,1fr\) 200px/);
 assert.match(shop,/\.catalog-tools input,.catalog-tools select\{width:100%;min-width:0;min-height:54px\}/);
});

test('floating GO launcher yields to visible controls and custom-order guidance is explicit',async()=>{
 const order=await(await page('/custom-order')).text();
 assert.match(order,/ส่งข้อมูลเพื่อประเมินขอบเขตและราคาเบื้องต้น ก่อนตกลงเริ่มงาน/);
 assert.match(order,/data-obscured='true'/);
 assert.match(order,/syncLauncherCollision/);
});
