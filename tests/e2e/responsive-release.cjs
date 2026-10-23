const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const content=require('../../public/assets/shop/studio/content.json');

for(const width of [390,768,1440]) test(`responsive purchase guidance and assistant at ${width}px`,async t=>{
  const {startPreview}=await import('../helpers/storefront-preview.mjs');
  const {server,origin}=await startPreview();
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
  const context=await browser.newContext({viewport:{width,height:width===390?844:1024},isMobile:width<1000,hasTouch:width<1000,deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>route.request().method()==='GET'&&new URL(route.request().url()).origin===origin?route.continue():route.abort());
  t.after(async()=>{await browser.close();await new Promise(r=>server.close(r));assert.deepEqual(errors,[])});
  await page.goto(origin+'/');
  await page.evaluate(async()=>{await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));});
  assert.deepEqual(await page.evaluate(()=>[...document.images].filter(image=>!image.naturalWidth).map(image=>image.getAttribute('src'))),[],'baseline image transfer must be complete before visual acceptance');
  const before=await page.evaluate(()=>({heroTop:document.querySelector('#home-product-stage').getBoundingClientRect().top,viewport:innerHeight,launcherPosition:getComputedStyle(document.querySelector('#go-sales-root')).position}));
  assert.notEqual(before.launcherPosition,'fixed','closed mascot must not float over page content');
  assert.equal(await page.locator('.assistant-launcher').count(),0,'one persistent launcher, no duplicate');
  if(width<=768)assert.ok(before.heroTop<before.viewport-100,JSON.stringify(before));
  assert.equal(await page.locator('.cart-nav[href="/cart"]').count(),0,'external product navigation must not lead to an empty native cart');
  if(width<1000){await page.locator('[data-action=menu]').click();assert.equal(await page.locator('[data-action=menu]').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('[data-action=menu]').getAttribute('aria-expanded'),'false');}
  await fs.mkdir('test-results/responsive-release',{recursive:true});
  await page.screenshot({path:`test-results/responsive-release/home-${width}.png`,fullPage:true});
  for(const product of content.products){
    await page.goto(origin+'/products/'+product.id);
    const cta=page.locator('.opening-actions a.product-buy');
    assert.equal(await cta.getAttribute('href'),product.url);
    assert.equal(await cta.getAttribute('rel'),'noopener noreferrer');
    assert.match(await page.locator('.product-format').innerText(),new RegExp(content.guides[product.id].format));
    if(product.id==='adaptive-lens')assert.doesNotMatch(await page.locator('.product-format').innerText(),/เทมเพลต Notion|เว็บแอป/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.locator('[data-go-sales-open][data-id]').first().click();
    await page.locator('#go-sales-panel').waitFor({state:'visible'});
    const bounds=await page.locator('#go-sales-panel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);
    await page.keyboard.press('Escape');await page.locator('#go-sales-panel').waitFor({state:'hidden'});
    if(product.id==='adaptive-lens')await page.screenshot({path:`test-results/responsive-release/adaptive-${width}.png`,fullPage:true});
  }
  await page.goto(origin+'/how-to-buy');
  for(const product of content.products)assert.equal(await page.locator(`.buying-guide a[href="${product.url}"]`).count(),1);
  assert.match(await page.locator('main').innerText(),/Notion Marketplace/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:`test-results/responsive-release/buying-${width}.png`,fullPage:true});
});
