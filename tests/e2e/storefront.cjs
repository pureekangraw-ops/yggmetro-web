const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{const {startPreview}=await import('../helpers/storefront-preview.mjs');const {server,origin}=await startPreview();let browser;
try{browser=await chromium.launch({headless:true});await fs.mkdir('test-results',{recursive:true});
for(const width of [1440,390]){const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const route of ['/','/shop','/portfolio','/custom-order','/products/finance-simulator','/cart','/checkout']){
 const response=await page.goto(origin+route);assert.equal(response.status(),200,route);
 await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});
 const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.getAttribute('src'))}));
 assert.equal(state.overflow,false,width+' '+route+' horizontal overflow');assert.deepEqual(state.broken,[],width+' '+route+' broken images');
 if(route==='/shop'){assert.equal(await page.locator('[data-name="ROOT CAUSE v3"] .product-actions .btn').getAttribute('href'),'https://promptbase.com/app/root-causes-analysis');assert.equal(await page.locator('[data-name="Adaptive Lens System"] .product-actions .btn').getAttribute('href'),'https://promptbase.com/skill/adaptive-lens-system');assert.equal(await page.locator('[data-name="SHOP HOME"] .product-actions .btn').getAttribute('href'),'https://app.notion.com/templates/shop-home');assert.equal(await page.locator('[data-name="Lost Era"] .product-actions .btn').getAttribute('href'),'https://app.notion.com/templates/lost-era-layered-worldbuilding-kit');await page.locator('#catalog-search').fill('no-such-product-123');await page.locator('.empty-results').waitFor({state:'visible'});await page.locator('#catalog-search').fill('');await page.screenshot({path:'test-results/shop-'+width+'.png',fullPage:true})}
 if(route==='/products/finance-simulator'){
  await page.locator('[data-add-to-cart]').click();await page.waitForURL('**/cart');await page.getByRole('link',{name:'ไปหน้าชำระเงิน'}).click();await page.waitForURL('**/checkout');
  const email=page.getByRole('textbox',{name:'อีเมลสำหรับรายการสั่งซื้อ'});await email.fill('buyer@example.com');
  let submitted=false;await page.route('**/api/v1/shop/checkout',async route=>{const body=route.request().postDataJSON();assert.deepEqual(Object.keys(body).sort(),['email','requestId','slug']);assert.equal(body.email,'buyer@example.com');assert.equal(body.slug,'finance-simulator');submitted=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,code:'CHECKOUT_NOT_READY'})})});
  await page.getByRole('button',{name:'ดำเนินการชำระเงิน'}).click();await page.getByRole('status').filter({hasText:'ยังเปิดหน้าชำระเงินไม่ได้'}).waitFor();assert.ok(submitted);assert.equal(await email.inputValue(),'buyer@example.com');
  await page.screenshot({path:'test-results/checkout-'+width+'.png',fullPage:true});
 }
}
assert.deepEqual(errors,[],width+' browser errors');await page.close();console.log('Desktop/mobile storefront flow passed at '+width+'px');
}
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}})().catch(e=>{console.error(e);process.exitCode=1});
