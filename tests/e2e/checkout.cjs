const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require('playwright');
let browser;
test.before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});await fs.mkdir('test-results',{recursive:true})});
test.after(async()=>browser?.close());
async function setup(t,options={}){
 const {startCheckoutPreview}=await import('../helpers/checkout-preview.mjs');const fixture=await startCheckoutPreview(options);
 const context=await browser.newContext({viewport:{width:options.width||390,height:844},acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(5000);
 t.after(async()=>{await context.close();await fixture.close()});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));
 await page.route('https://checkout.stripe.com/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Simulated provider checkout</h1>'}));
 async function checkout(){await page.goto(fixture.origin+'/products/checkout-test');await page.locator('[data-add-to-cart]').click();await page.waitForURL('**/cart');await page.getByRole('link',{name:'ไปหน้าชำระเงิน'}).click();await page.waitForURL('**/checkout')}
 return {fixture,context,page,checkout};
}
const requestKey='yggmetro-checkout-checkout-test-test';
const savedId=page=>page.evaluate(key=>sessionStorage.getItem(key),requestKey);
const submit=page=>page.locator('button[form="secure-checkout-form"]').click();

for(const width of [390,1440])test('40 THB storefront → checkout → verified fixture webhook → owner download at '+width+'px',async t=>{
 const {fixture,context,page,checkout}=await setup(t,{width});await checkout();
 assert.match(await page.locator('.order-total').innerText(),/฿40\.00/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('textbox',{name:'อีเมลสำหรับรายการสั่งซื้อ'}).fill('test@example.com');
 await page.screenshot({path:'test-results/checkout-40thb-'+width+'.png',fullPage:true});
 await submit(page);await page.waitForURL('https://checkout.stripe.com/**');assert.equal(fixture.created,1);
 const cookie=(await context.cookies()).find(c=>c.name==='__Host-ygg-order'&&c.domain==='127.0.0.1');assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);
 await page.goto(fixture.origin+'/order?session_id=cs_test_local40');await page.locator('#status').filter({hasText:'กำลังรอการยืนยัน'}).waitFor();assert.equal(await page.locator('#download').isVisible(),false);
 // Use the browser's loopback secure-context cookie rules, rather than APIRequestContext's HTTP URL filter.
 assert.equal(await page.evaluate(async()=> (await fetch('/api/v1/shop/order/download?session_id=cs_test_local40')).status),409);
 assert.equal((await fixture.pay()).status,200);assert.equal((await fixture.pay()).status,200);assert.equal(fixture.db.prepare('SELECT count(*) n FROM shop_orders').get().n,1);await page.locator('#check').click();await page.locator('#download').waitFor();
 const downloading=page.waitForEvent('download');await page.locator('#download').click();const download=await downloading;assert.deepEqual(await fs.readFile(await download.path()),fixture.file);
 const foreign=await browser.newContext();try{assert.equal((await foreign.request.get(fixture.origin+'/api/v1/shop/order/download?session_id=cs_test_local40')).status(),404)}finally{await foreign.close()}
 assert.equal(fixture.db.prepare('SELECT status FROM shop_orders').get().status,'paid');
 await page.screenshot({path:'test-results/order-40thb-paid-'+width+'.png',fullPage:true});
 // Same canonical order is visible to an explicitly granted fixture admin only.
 await page.goto(fixture.origin+'/admin/shop');
 await page.locator('#token').fill('invalid_fixture_'.padEnd(40,'x'));
 await page.getByRole('button',{name:'อ่านคำสั่งซื้อ',exact:true}).click();
 await page.locator('#notice').filter({hasText:'ADMIN_AUTH_REQUIRED'}).waitFor();
 assert.equal(await page.locator('#orders article').count(),0);
 await page.locator('#token').fill(fixture.adminToken);
 await page.getByRole('button',{name:'อ่านคำสั่งซื้อ',exact:true}).click();
 await page.locator('#orders article').filter({hasText:'cs_test_local40'}).waitFor();
 assert.match(await page.locator('#totals').innerText(),/THB: 4000 · 1/);
 assert.equal((await page.locator('#totals').innerText()).includes('\n'),true);
 assert.match(await page.locator('#orders').innerText(),/ชำระยืนยันแล้ว · มีสิทธิ์ดาวน์โหลด/);
 assert.match(await page.locator('#orders').innerText(),/การรับไฟล์: ยังไม่มีหลักฐาน/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await page.locator('#token').inputValue(),'');
 await page.screenshot({path:'test-results/office-commerce-'+width+'.png',fullPage:true});
 await page.locator('#logout').click();assert.equal(await page.locator('#orders article').count(),0);
 let release,arrived;const held=new Promise(resolve=>release=resolve),started=new Promise(resolve=>arrived=resolve);
 await page.route('**/api/v1/admin/shop/orders',async route=>{const response=await route.fetch();arrived();await held;await route.fulfill({response})});
 await page.locator('#token').fill(fixture.adminToken);await page.getByRole('button',{name:'อ่านคำสั่งซื้อ',exact:true}).click();await started;
 await page.locator('#logout').click();const completed=page.waitForResponse('**/api/v1/admin/shop/orders');release();await completed;
 await page.waitForFunction(()=>!document.getElementById('more').disabled);
 assert.equal(await page.locator('#orders article').count(),0);assert.equal(await page.locator('#totals').innerText(),'');


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

for(const width of [390,1440])test('sandbox resource links and images remain local and resolve at '+width+'px',async t=>{
 const {fixture,page}=await setup(t,{width});
 // These routes contain no remote embeds; fail closed if a regression attempts external loading.
 const external=[];await page.route('**/*',route=>{
  if(new URL(route.request().url()).origin!==fixture.origin){external.push(route.request().url());return route.abort()}
  return route.continue();
 });
 for(const route of ['/','/shop','/products/checkout-test','/cart','/checkout','/order']){
  assert.equal((await page.goto(fixture.origin+route)).status(),200);
  await page.evaluate(async()=>{for(const image of document.images)image.loading='eager';await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})))});
  assert.deepEqual(await page.evaluate(()=>[...document.images].filter(image=>!image.naturalWidth).map(image=>image.src)),[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,route);
  const resources=await page.evaluate(()=>[...new Set([...document.querySelectorAll('img[src],script[src],link[rel="stylesheet"][href]')].map(el=>el.src||el.href))]);
  for(const resource of resources)assert.equal((await page.request.get(resource)).status(),200,resource);
 }
 assert.deepEqual(external,[]);assert.equal(fixture.created,0);assert.equal(fixture.db.prepare('SELECT count(*) n FROM shop_orders').get().n,0);
});

for(const width of [320,390,540,708,1440])test('mascot protects checkout notices and retains controls at '+width+'px',async t=>{
 const {fixture,page,checkout}=await setup(t,{width});await checkout();
 await page.emulateMedia({reducedMotion:'reduce'});
 const protectedSelector='.test-mode,.payment-info,.commerce-status,.order-total,.cart-item';
 async function settle(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))}
 async function noOverlap(){await settle();assert.equal(await page.evaluate(selector=>{
  const root=document.querySelector('#go-sales-root');if(getComputedStyle(root).visibility==='hidden')return false;
  const mascot=document.querySelector('#go-mascot-dock').getBoundingClientRect();
  return [...document.querySelectorAll(selector)].some(node=>{const r=node.getBoundingClientRect();return Math.min(mascot.right,r.right)-Math.max(mascot.left,r.left)>6&&Math.min(mascot.bottom,r.bottom)-Math.max(mascot.top,r.top)>6});
 },protectedSelector),false,'mascot overlaps checkout information');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)}
 await page.locator('input[name="email"]').fill('fixture@example.com');await noOverlap();
 await page.screenshot({path:'test-results/checkout-mascot-'+width+'.png',fullPage:true});
 for(const y of [0,200,400,650,900,1200]){await page.evaluate(y=>scrollTo(0,y),y);await noOverlap()}
 // Existing collision behavior can hide the dock where no safe slot remains.
 // Find an unobstructed slot and verify minimize/open/close still work.
 let visible=false;
 for(const y of [0,200,400,650,900,1200,2000]){await page.evaluate(y=>scrollTo(0,y),y);await settle();if(await page.locator('#go-mascot-minimize').isVisible()){visible=true;break}}
 assert.equal(visible,true,'mascot remains available');
 await page.locator('#go-mascot-minimize').click();assert.equal(await page.locator('#go-mascot-image').isVisible(),false);
 await page.locator('#go-sales-launcher').click();assert.equal(await page.locator('#go-sales-panel').isVisible(),true);
 assert.equal(await page.locator('#go-sales-launcher').getAttribute('aria-expanded'),'true');
 await page.locator('#go-sales-close').click();assert.equal(await page.locator('#go-sales-panel').isVisible(),false);
 await noOverlap();assert.equal(fixture.created,0);
});
