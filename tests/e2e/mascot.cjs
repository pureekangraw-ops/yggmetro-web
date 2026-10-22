const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const {startPreview}=await import('../helpers/storefront-preview.mjs');const {server,origin}=await startPreview();let browser;
try{browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
for(const width of [390,1440]){const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});await page.goto(origin+'/');
const image=page.locator('#go-mascot-image');await image.evaluate(i=>i.decode());assert.equal(await image.evaluate(i=>getComputedStyle(i).animationName),'none');
await page.locator('#go-sales-launcher').waitFor({state:'visible'});
await page.locator('#go-sales-launcher').click();await page.locator('#go-sales-input').fill('ที่ดิน');await page.locator('#go-sales-send').click();await page.locator('#go-sales-messages a[href="/products/land-planner"]').waitFor();
await page.locator('#go-sales-close').click();await page.locator('#go-mascot-minimize').click();assert.equal(await image.isVisible(),false);
await page.reload();assert.equal(await page.locator('#go-sales-root').getAttribute('data-minimized'),'');
await page.evaluate(()=>{sessionStorage.removeItem('go-mascot-minimized')});await page.reload();await page.screenshot({path:'test-results/mascot-'+width+'.png'});await page.close();console.log('Mascot image, chat, minimize persistence, reduced motion PASS '+width)}
}finally{await browser?.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
