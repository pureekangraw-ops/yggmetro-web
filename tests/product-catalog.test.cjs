const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/index.js')).href);

test('all six evidence-backed products have public detail pages without internal source IDs',async()=>{
 const {default:web}=await load();
 const shop=await (await web.fetch(new Request('https://shop.yggmetro.com/shop'),{})).text();
 for(const slug of ['land-planner','finance-simulator','shop-home','root-cause','adaptive-lens','lost-era']){
  assert.ok(shop.includes('/products/'+slug),slug);
  const response=await web.fetch(new Request('https://shop.yggmetro.com/products/'+slug),{});
  assert.equal(response.status,200,slug);
  const body=await response.text();
  assert.match(body,/rel="canonical"/);
  assert.doesNotMatch(body,/notion-file-block:|a10fb367441943da98030360d9de49ba|042bbd2e082a4354a7f7f9bb1f97b8eb|04d2590d36cd4fe8a2e3133aea1951ac|f2576b1dd5954fd8a5e2f87dddaf393d/);
 }
});

test('shop surfaces category filters, sorting, and non-misleading availability labels',async()=>{
 const {default:web}=await load();
 const body=await (await web.fetch(new Request('https://shop.yggmetro.com/shop'),{})).text();
 for(const term of ['data-filter="all"','data-filter="planning"','data-filter="business"','data-filter="analysis"','data-filter="creative"','product-sort','name-asc','name-desc','aria-live="polite"']) assert.ok(body.includes(term),term);
 assert.match(body,/PENDING APPROVAL/);
 assert.match(body,/release candidate/i);
 assert.match(body,/ราคายังไม่ยืนยัน/);
});

test('unknown product returns 404 and release candidates do not expose checkout',async()=>{
 const {default:web}=await load();
 assert.equal((await web.fetch(new Request('https://shop.yggmetro.com/products/missing'),{})).status,404);
 for(const slug of ['finance-simulator','lost-era']){
  const body=await (await web.fetch(new Request('https://shop.yggmetro.com/products/'+slug),{})).text();
  assert.match(body,/ยังไม่เปิดชำระเงินหรือส่งมอบผ่านเว็บไซต์นี้/);
  assert.doesNotMatch(body,/buy\.stripe\.com|checkout\.stripe\.com|<form[^>]+payment|PaymentIntent/);
 }
});

test('store policies disclose that first-party checkout and delivery are not configured',async()=>{
 const {default:web}=await load();
 for(const path of ['/policies','/privacy','/terms','/refunds']){
  const response=await web.fetch(new Request('https://shop.yggmetro.com'+path),{});
  assert.equal(response.status,200,path);
  const body=await response.text();
  assert.match(body,/ยังไม่เปิด Stripe Checkout/);
 }
});
