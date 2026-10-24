const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{const {startPreview}=await import('../helpers/storefront-preview.mjs');const {server,origin}=await startPreview();let browser;
try{browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});await fs.mkdir('test-results',{recursive:true});
for(const width of [1440,768,390]){const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const route of ['/','/shop','/portfolio','/custom-order','/products/finance-simulator','/products/shop-home','/cart','/checkout']){
 const response=await page.goto(origin+route);assert.equal(response.status(),200,route);
 await page.locator('main').waitFor();await page.evaluate(async()=>{const images=[...document.images];images.forEach(i=>i.loading='eager');await Promise.all(images.map(i=>i.decode().catch(()=>{})))});
 const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src)}));assert.equal(state.overflow,false,width+' '+route);assert.deepEqual(state.broken,[],route+' broken image');
 if(route==='/'){
  assert.equal(await page.locator('.showroom-hero').count(),1);assert.equal(await page.locator('.destination-card').count(),3);assert.equal(await page.locator('.preview-bar').count(),0);
  await page.locator('[data-action=home-stage][data-id=finance-simulator]').click();assert.match(await page.locator('#home-product-stage').textContent(),/Personal Finance/);
  await page.locator('[data-action=home-preview]').click();await page.locator('#modal').waitFor({state:'visible'});await page.locator('[data-action=close]').click();await page.locator('[data-action=home-stage][data-id=land-planner]').click();
 }
 if(route==='/shop'){await page.locator('#product-search').fill('SHOP HOME');assert.equal(await page.locator('.product-card').count(),1);await page.locator('#product-search').fill('no-such-product');assert.equal(await page.locator('.empty').count(),1);await page.locator('#product-search').fill('');}
 if(route==='/products/finance-simulator'){assert.match(await page.locator('main').textContent(),/US\$19/);assert.ok(await page.locator('a[href="https://www.notion.com/th/templates/ygg-metro-personal-finance-simulator"]').count());}
 if(route==='/products/shop-home'){await page.locator('[data-action=usage-step]').nth(1).click();assert.match(await page.locator('#usage-panel').textContent(),/02/);await page.locator('[data-action=assistant-open]').first().click();await page.locator('#go-sales-panel').waitFor({state:'visible'});await page.locator('#go-sales-close').click();}
 if(['/','/shop','/portfolio','/custom-order','/products/shop-home'].includes(route))await page.screenshot({path:'test-results/sites19-'+(route==='/'?'home':route.replaceAll('/','-'))+'-'+width+'.png',fullPage:true});
}
assert.deepEqual(errors,[],width+' browser errors');await page.close();console.log('Sites 19 storefront passed at '+width+'px');}
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}})().catch(e=>{console.error(e);process.exitCode=1});
