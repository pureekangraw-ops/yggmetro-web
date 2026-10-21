const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require('playwright');
let browser;
test.before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});await fs.mkdir('test-results',{recursive:true})});
test.after(async()=>browser?.close());
async function setup(t,options={}){
 const {startCheckoutPreview}=await import('../helpers/checkout-preview.mjs');const fixture=await startCheckoutPreview(options);
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(5000);
 t.after(async()=>{await context.close();await fixture.close()});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));
 await page.route('https://checkout.stripe.com/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Simulated provider checkout</h1>'}));
 async function checkout(){await page.goto(fixture.origin+'/products/checkout-test');await page.locator('[data-add-to-cart]').click();await page.waitForURL('**/cart');await page.getByRole('link',{name:'ไปหน้าชำระเงิน'}).click();await page.waitForURL('**/checkout')}
 return {fixture,context,page,checkout};
}
const requestKey='yggmetro-checkout-checkout-test-test';
const savedId=page=>page.evaluate(key=>sessionStorage.getItem(key),requestKey);
const submit=page=>page.locator('button[form="secure-checkout-form"]').click();

test('40 THB mobile storefront → checkout → verified fixture webhook → owner download',async t=>{
 const {fixture,context,page,checkout}=await setup(t);await checkout();
 assert.match(await page.locator('.order-total').innerText(),/฿40\.00/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('textbox',{name:'อีเมลสำหรับรายการสั่งซื้อ'}).fill('test@example.com');
 await page.screenshot({path:'test-results/checkout-40thb-mobile.png',fullPage:true});
 await submit(page);await page.waitForURL('https://checkout.stripe.com/**');assert.equal(fixture.created,1);
 const cookie=(await context.cookies()).find(c=>c.name==='__Host-ygg-order'&&c.domain==='127.0.0.1');assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);
 await page.goto(fixture.origin+'/order?session_id=cs_test_local40');await page.locator('#status').filter({hasText:'กำลังรอการยืนยัน'}).waitFor();assert.equal(await page.locator('#download').isVisible(),false);
 // Use the browser's loopback secure-context cookie rules, rather than APIRequestContext's HTTP URL filter.
 assert.equal(await page.evaluate(async()=> (await fetch('/api/v1/shop/order/download?session_id=cs_test_local40')).status),409);
 assert.equal((await fixture.pay()).status,200);await page.locator('#check').click();await page.locator('#download').waitFor();
 const downloading=page.waitForEvent('download');await page.locator('#download').click();const download=await downloading;assert.deepEqual(await fs.readFile(await download.path()),fixture.file);
 const foreign=await browser.newContext();try{assert.equal((await foreign.request.get(fixture.origin+'/api/v1/shop/order/download?session_id=cs_test_local40')).status(),404)}finally{await foreign.close()}
 assert.equal(fixture.db.prepare('SELECT status FROM shop_orders').get().status,'paid');
 await page.screenshot({path:'test-results/order-40thb-paid.png',fullPage:true});
});

for(const [label,options,expectedCalls] of [['provider timeout',{failProviderOnce:true},2],['success response lost behind a gateway failure',{dropSuccessOnce:true},1],['D1 insert failure',{failStoreOnce:true},2]]){
 test(label+' preserves request and contact across reload and resumes the original checkout',async t=>{
  const {fixture,page,checkout}=await setup(t,options);await checkout();const email=page.getByRole('textbox',{name:'อีเมลสำหรับรายการสั่งซื้อ'});await email.fill('test@example.com');const id=await savedId(page);
  await submit(page);await page.getByRole('status').filter({hasText:'ยังยืนยันผลรายการไม่ได้'}).waitFor();assert.equal(await savedId(page),id);
  await page.reload();assert.equal(await email.inputValue(),'test@example.com');assert.equal(await email.getAttribute('readonly'),'');assert.equal(await savedId(page),id);
  await submit(page);await page.waitForURL('https://checkout.stripe.com/**');assert.equal(fixture.created,expectedCalls);assert.equal(fixture.db.prepare('SELECT count(*) n FROM shop_orders').get().n,1);
  if(expectedCalls===2)assert.deepEqual(fixture.requests[0],fixture.requests[1]);
 });
}

for(const code of ['CHECKOUT_CONFLICT','CHECKOUT_EXPIRED','CHECKOUT_RECONCILIATION_REQUIRED']){
 test(code+' stops automatic new purchases and preserves the attempt after returning to the product',async t=>{
  const {fixture,page,checkout}=await setup(t);await checkout();await page.getByRole('textbox',{name:'อีเมลสำหรับรายการสั่งซื้อ'}).fill('test@example.com');const id=await savedId(page);
  await page.route('**/api/v1/shop/checkout',r=>r.fulfill({status:409,contentType:'application/json',body:JSON.stringify({ok:false,code})}));
  await submit(page);await page.getByRole('status').filter({hasText:'รายการเดิมต้องตรวจสอบ'}).waitFor();assert.equal(await savedId(page),id);assert.equal(await page.locator('button[form]').isDisabled(),true);assert.equal(fixture.created,0);
  await checkout();assert.equal(await savedId(page),id);assert.equal(await page.getByRole('textbox',{name:'อีเมลสำหรับรายการสั่งซื้อ'}).inputValue(),'test@example.com');
 });
}

test('repeated cookie-bootstrap responses stop after one retry without a provider Session',async t=>{
 const {fixture,page,checkout}=await setup(t);await checkout();let calls=0;
 await page.route('**/api/v1/shop/checkout',async route=>{calls++;await route.fulfill({status:428,contentType:'application/json',body:JSON.stringify({ok:false,code:'CHECKOUT_SESSION_REQUIRED'})})});
 await page.getByRole('textbox',{name:'อีเมลสำหรับรายการสั่งซื้อ'}).fill('test@example.com');await submit(page);await page.getByRole('status').filter({hasText:'กรุณาอนุญาตคุกกี้'}).waitFor();assert.equal(calls,2);assert.equal(fixture.created,0);
});

test('unavailable recovery storage prevents an untrackable purchase',async t=>{
 const {fixture,page,checkout}=await setup(t);await checkout();await page.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{value:{getItem(){return null},setItem(){throw Error('blocked')}}}));await page.reload();
 await page.getByRole('status').filter({hasText:'ยังเก็บข้อมูลสำหรับกู้รายการไม่ได้'}).waitFor();assert.equal(await page.locator('button[form]').isDisabled(),true);assert.equal(fixture.created,0);
});

test('a damaged started request is not replaced with a new purchase after reload',async t=>{
 const {fixture,page,checkout}=await setup(t);await checkout();
 await page.evaluate(key=>{sessionStorage.setItem(key,'damaged');sessionStorage.setItem(key+'-started','true');sessionStorage.setItem(key+'-email','test@example.com')},requestKey);
 for(let i=0;i<2;i++){await page.reload();assert.equal(await page.locator('button[form]').isDisabled(),true);assert.equal(await savedId(page),'damaged')}
 assert.equal(fixture.created,0);
});
