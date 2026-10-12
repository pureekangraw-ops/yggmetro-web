const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/index.js')).href);

test('customer-facing shop routes render the new light storefront only on shop.yggmetro.com',async()=>{
 const {default:web}=await load();
 const shop=await (await web.fetch(new Request('https://shop.yggmetro.com/'),{})).text();
 const root=await (await web.fetch(new Request('https://yggmetro.com/'),{})).text();
 const office=await (await web.fetch(new Request('https://office.yggmetro.com/'),{})).text();
 assert.match(shop,/<html lang="th">/);
 assert.match(shop,/เลือกดูสินค้า/);
 assert.match(shop,/ภาพหน้าจอจากเครื่องมือจริง/);
 assert.match(shop,/--blue:/);
 assert.doesNotMatch(shop,/promptbase\.com\/embed\/root-causes-analysis/);
 assert.match(root,/SPECTRUMSALE/);
 assert.doesNotMatch(root,/เลือกดูสินค้า/);
 assert.doesNotMatch(office,/เลือกดูสินค้า/);
});

test('shop provides Home, Shop, Portfolio, About, Contact, and product route navigation',async()=>{
 const {default:web}=await load();
 for(const path of ['/','/shop','/portfolio','/about','/contact','/products/land-planner']){
  const response=await web.fetch(new Request('https://shop.yggmetro.com'+path),{});
  assert.equal(response.status,200,path);
  const body=await response.text();
  assert.match(body,/href="\/portfolio"/);
  assert.match(body,/href="\/contact"/);
 }
});

test('method restrictions and not-found routing remain explicit on the shop domain',async()=>{
 const {default:web}=await load();
 const post=await web.fetch(new Request('https://shop.yggmetro.com/shop',{method:'POST'}),{});
 assert.equal(post.status,405);
 assert.equal(post.headers.get('allow'),'GET, HEAD');
 assert.equal((await web.fetch(new Request('https://shop.yggmetro.com/not-a-real-page'),{})).status,404);
});
