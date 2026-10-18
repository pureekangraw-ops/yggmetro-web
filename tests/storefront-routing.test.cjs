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

test('Home introduces the brand, routes visitors to the three main journeys, and shows featured work only',async()=>{
 const home=await(await page('/')).text();
 assert.match(home,/class="home-intro"/);
 assert.match(home,/class="home-art"[^>]+brand-hero\.jpg/);
 for(const href of ['/shop','/portfolio','/custom-order'])assert.ok(home.includes('href="'+href+'"'));
 const nav=home.match(/<nav[^>]*>([\s\S]*?)<\/nav>/)[1];
 const destinations=home.match(/<section class="destinations"[^>]*>([\s\S]*?)<\/section>/)[1];
 for(const href of ['/shop','/portfolio','/custom-order']){assert.equal([...nav.matchAll(new RegExp('href="'+href+'"','g'))].length,1,'one primary menu link for '+href);assert.equal([...destinations.matchAll(new RegExp('href="'+href+'"','g'))].length,1,'one destination card for '+href)}
 assert.match(home,/id="showcase"[^>]+aria-label="ผลงานเด่น"/);
 assert.match(home,/Featured work/);
 const main=home.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
 assert.doesNotMatch(main,/id="products"|id="services"|id="how"|<summary>|promptbase-frame/);
 assert.match(home,/backgrounds\/blue-smoke\.jpg/);
 assert.match(home,/background:linear-gradient\(180deg/);
});

test('Portfolio shows six replaceable artwork slots and working category controls',async()=>{
 const html=await(await page('/portfolio')).text();
 assert.match(html,/class="portfolio-grid"/);
 assert.equal([...html.matchAll(/class="portfolio-art"/g)].length,6);
 for(const file of ['aurora-cityscape.svg','cloudport-metropolis.svg','digital-planner-series.svg','notion-workspace.svg','creative-illustration.svg','product-design.svg'])assert.ok(html.includes('/assets/shop/portfolio/'+file));
 for(const filter of ['illustration','ui-ux','digital-product','environment','branding'])assert.ok(html.includes('data-portfolio-filter="'+filter+'"'));
 assert.match(html,/button\.addEventListener\('click'/);
 assert.match(html,/href="\/how-to-buy">วิธีซื้อ \/ FAQ/);
});

test('Custom Order contains service descriptions, a clear brief form, and legacy services route aliases it',async()=>{
 const order=await(await page('/custom-order')).text();
 for(const text of ['งานนำเสนอและเอกสาร','แบรนด์และงานภาพ','เว็บไซต์และเครื่องมือ','เทมเพลตและสินค้าดิจิทัล','ส่งรายละเอียดงาน'])assert.ok(order.includes(text));
 const legacy=await(await page('/services')).text();
 assert.match(legacy,/<link rel="canonical" href="https:\/\/shop\.yggmetro\.com\/custom-order">/);
});
