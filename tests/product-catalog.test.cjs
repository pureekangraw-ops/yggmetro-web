const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/index.js')).href);
test('shop gives all six products their own public sales page without exposing paid Notion files',async()=>{
 const {default:web}=await load();
 const home=await (await web.fetch(new Request('https://shop.yggmetro.com/shop'),{})).text();
 for(const slug of ['land-planner','finance-simulator','shop-home','root-cause','adaptive-lens','lost-era']){
  assert.ok(home.includes('/products/'+slug),slug);
  const response=await web.fetch(new Request('https://shop.yggmetro.com/products/'+slug),{});
  assert.equal(response.status,200);
  const body=await response.text();
  assert.match(body,/rel="canonical"/);
  assert.doesNotMatch(body,/notion-file-block:|a10fb367441943da98030360d9de49ba|042bbd2e082a4354a7f7f9bb1f97b8eb|04d2590d36cd4fe8a2e3133aea1951ac/);
 }
});
test('unknown product returns 404 and finance never offers an unconfigured checkout',async()=>{
 const {default:web}=await load();
 assert.equal((await web.fetch(new Request('https://shop.yggmetro.com/products/missing'),{})).status,404);
 const body=await (await web.fetch(new Request('https://shop.yggmetro.com/products/finance-simulator'),{})).text();
 assert.match(body,/ขายบน Notion Marketplace/);
 assert.match(body,/US\$19/);
 assert.doesNotMatch(body,/เตรียมเปิดขาย|เตรียมประกาศราคา|สอบถามวันเปิดขาย|custom-order\?service=lab/);
 assert.doesNotMatch(body,/buy\.stripe\.com|checkout\.stripe\.com|<iframe/);
});
