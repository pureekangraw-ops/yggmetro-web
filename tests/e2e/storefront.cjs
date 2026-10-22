const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{const {startPreview}=await import('../helpers/storefront-preview.mjs');const {server,origin}=await startPreview();let browser;
try{browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});await fs.mkdir('test-results',{recursive:true});
for(const width of [1440,708,390]){const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><title>Offline external platform fixture</title>'}));
for(const route of ['/','/shop','/portfolio','/custom-order','/products/finance-simulator','/products/shop-home','/how-to-buy','/cart','/checkout']){
 const response=await page.goto(origin+route);assert.equal(response.status(),200,route);
 await page.evaluate(async()=>{const images=[...document.images];images.forEach(image=>{image.loading='eager'});await Promise.all(images.map(i=>i.decode().catch(()=>{})))});
 const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src'))}));
 assert.equal(state.overflow,false,width+' '+route+' horizontal overflow');assert.deepEqual(state.broken,[],width+' '+route+' broken images');
 if(['/','/shop','/portfolio','/custom-order'].includes(route)){
  assert.equal(await page.locator('nav[aria-label="เมนูหลัก"]').count(),1);
  assert.equal(await page.locator('nav [aria-current="page"]').count(),1,route+' active menu');
  for(const href of ['/shop','/portfolio','/custom-order'])assert.equal(await page.locator('nav a[href="'+href+'"]').count(),1,route+' repeats '+href);
  if(route==='/'&&width===1440){
   await page.getByRole('button',{name:'ให้ GO ช่วยเลือก',exact:true}).click();
   assert.equal(await page.locator('#go-sales-panel').isVisible(),true,route+' GO panel opens');
   assert.equal(await page.locator('#go-sales-launcher').getAttribute('aria-expanded'),'true',route+' GO launcher expanded');
   await page.locator('#go-sales-close').click();
   assert.equal(await page.locator('#go-sales-panel').isVisible(),false,route+' GO panel closes');
  }
  const background=await page.evaluate(async()=>{const bg=getComputedStyle(document.body,'::before').backgroundImage;const urls=[...bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1]);for(const url of urls){const image=new Image();image.src=url;await image.decode()}return bg});
  assert.match(background,/\/assets\/shop\//,route+' missing page backdrop');
  assert.equal(await page.locator('main img[src*="sky-studies"],main img[src*="cloud-stories"],main img[src*="cloud-hero"],main img[src*="products/icons"]').count(),0,route+' displays decorative asset as content');
  if(route==='/'||route==='/portfolio')await page.screenshot({path:'test-results/'+(route==='/'?'home':'portfolio')+'-'+width+'.png',fullPage:true});
 }
 if(route==='/'){
  assert.match(await page.title(),/YGG METRO/);
  await page.locator('nav a[href="/shop"]').click();await page.waitForURL('**/shop');
  await page.locator('.brand').click();await page.waitForURL(origin+'/');
  assert.equal(await page.locator('.hero-home').count(),1);
  await page.locator('#slide-next').click();assert.equal(await page.locator('.slide:not([hidden]) h2').textContent(),'Cloudport Metropolis');
  await page.locator('#slide-prev').click();assert.equal(await page.locator('.slide:not([hidden]) h2').textContent(),'Aurora Cityscape');
 }
 if(route==='/shop'){
  const searchBox=await page.locator('#catalog-search').boundingBox();assert.ok(searchBox.width>=240,width+'px catalog search width');
  assert.equal(await page.locator('.catalog-layout .filters').isVisible(),true);
 }
 if(route==='/shop'){const finance=page.locator('[data-name="Personal Finance Simulator"]');assert.equal(await finance.locator('.price').textContent(),'US$19');assert.equal(await finance.locator('.status').textContent(),'ขายบน Notion Marketplace');assert.equal(await finance.locator('.product-actions .btn').getAttribute('href'),'https://www.notion.com/th/templates/ygg-metro-personal-finance-simulator');assert.equal(await page.locator('[data-name="ROOT CAUSE v3"] .product-actions .btn').getAttribute('href'),'https://promptbase.com/app/root-causes-analysis');assert.equal(await page.locator('[data-name="Adaptive Lens System"] .product-actions .btn').getAttribute('href'),'https://promptbase.com/skill/adaptive-lens-system');assert.equal(await page.locator('[data-name="SHOP HOME"] .product-actions .btn').getAttribute('href'),'https://app.notion.com/templates/shop-home');assert.equal(await page.locator('[data-name="Lost Era"] .product-actions .btn').getAttribute('href'),'https://app.notion.com/templates/lost-era-layered-worldbuilding-kit');await page.locator('#catalog-search').fill('no-such-product-123');await page.locator('.empty-results').waitFor({state:'visible'});await page.locator('#catalog-search').fill('');await page.screenshot({path:'test-results/shop-'+width+'.png',fullPage:width>390})}
 if(route==='/custom-order'){
  await page.locator('#custom-order-form').scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const collision=await page.evaluate(()=>{const launcher=document.querySelector('#go-sales-launcher');if(!launcher||launcher.hidden||getComputedStyle(launcher).visibility==='hidden')return false;const a=launcher.getBoundingClientRect();return [...document.querySelectorAll('a[href],button,input,select,textarea,[role="button"]')].some(node=>{if(node.closest('#go-sales-root')||!node.getClientRects().length)return false;const s=getComputedStyle(node);if(s.visibility==='hidden'||s.display==='none'||Number(s.opacity)===0)return false;const b=node.getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)>6&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>6})});
  assert.equal(collision,false,width+'px floating GO obscures custom-order controls');
 }
 if(route==='/products/finance-simulator'){
  const cta=page.getByRole('link',{name:'ซื้อ Finance Simulator บน Notion ↗',exact:true});
  assert.equal(await cta.getAttribute('href'),'https://www.notion.com/th/templates/ygg-metro-personal-finance-simulator');
  assert.equal(await cta.getAttribute('target'),'_blank');
  assert.match(await cta.getAttribute('rel'),/noopener noreferrer/);
  assert.equal(await page.locator('[data-add-to-cart]').count(),0);
  assert.equal(await page.locator('.detail-panel .price').textContent(),'US$19');
  assert.equal(await page.locator('.detail-panel .status').textContent(),'ขายบน Notion Marketplace');
  assert.doesNotMatch(await page.locator('main').textContent(),/เตรียมเปิดขาย|เตรียมประกาศราคา|สอบถามวันเปิดขาย/);
  await page.locator('#go-sales-launcher').click();
  await page.locator('#go-sales-input').fill('Finance Simulator ซื้อได้ไหม');
  await page.locator('#go-sales-send').click();
  await page.locator('.go-sales-bubble').filter({hasText:'ขายบน Notion Marketplace'}).waitFor();
  assert.match(await page.locator('#go-sales-messages').textContent(),/US\$19/);
  await page.locator('#go-sales-close').click();
  await page.screenshot({path:'test-results/finance-'+width+'.png',fullPage:true});
 }
 if(route==='/how-to-buy'){
  await page.getByText('ซื้อสินค้าจากเว็บนี้ได้เลยไหม?',{exact:true}).click();
  assert.match(await page.locator('.faq details[open]').textContent(),/SHOP HOME, Personal Finance Simulator และ Lost Era ไปหน้าร้าน Notion/);
  assert.doesNotMatch(await page.locator('main').textContent(),/เตรียมเปิดขาย/);
  await page.screenshot({path:'test-results/finance-faq-'+width+'.png',fullPage:true});
 }
}
const {commercePage,commerceScript}=await import('../../src/commerce-pages.js');
const fixture=[{slug:'offline-fixture',name:'Offline fixture',label:'Fixture',amount:900,currency:'usd',testMode:true}];
for(const path of ['/cart','/checkout'])await page.route(origin+path,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"></head><body>'+commercePage(path)+commerceScript(fixture,{})+'</body></html>'}));
await page.evaluate(()=>localStorage.setItem('yggmetro-cart-v1','offline-fixture'));
await page.goto(origin+'/cart');await page.getByRole('link',{name:'ไปหน้าชำระเงิน'}).click();await page.waitForURL('**/checkout');
const email=page.getByRole('textbox',{name:'อีเมลสำหรับรายการสั่งซื้อ'});await email.fill('buyer@example.test');
let submitted=false;await page.route('**/api/v1/shop/checkout',async route=>{const body=route.request().postDataJSON();assert.deepEqual(Object.keys(body).sort(),['email','requestId','slug']);assert.equal(body.email,'buyer@example.test');assert.equal(body.slug,'offline-fixture');submitted=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,code:'CHECKOUT_NOT_READY'})})});
await page.getByRole('button',{name:'ดำเนินการชำระเงิน'}).click();await page.getByRole('status').filter({hasText:'ยังเปิดหน้าชำระเงินไม่ได้'}).waitFor();assert.ok(submitted);assert.equal(await email.inputValue(),'buyer@example.test');
assert.deepEqual(errors,[],width+' browser errors');await page.close();console.log('Desktop/mobile storefront flow passed at '+width+'px');
}
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}})().catch(e=>{console.error(e);process.exitCode=1});
