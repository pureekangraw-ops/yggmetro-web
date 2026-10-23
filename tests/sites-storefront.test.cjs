const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve('public/assets/shop/studio'),data=JSON.parse(fs.readFileSync(base+'/content.json'));
test('display-sized image derivatives retain verified original assets and reduce bytes',()=>{
 const {createHash}=require('node:crypto');
 const original=JSON.parse(fs.readFileSync('docs/sites19/asset-manifest.json'));
 const optimized=JSON.parse(fs.readFileSync('docs/sites19/optimized-assets.json'));
 for(const item of optimized.outputs){
  const source=fs.readFileSync(item.source),output=fs.readFileSync(item.output);
  assert.equal(createHash('sha256').update(source).digest('hex'),original.find(x=>x.file===item.source).sha256);
  assert.equal(createHash('sha256').update(source).digest('hex'),item.sourceSha256);
  assert.equal(createHash('sha256').update(output).digest('hex'),item.outputSha256);
  assert.ok(output.length<source.length*.2,'derivative must reduce transferred bytes');
  assert.equal(item.outputDimensions[0],item.source.includes('wordmark')?1040:384);
 }
});
test('editable storefront content is complete, safe and references real assets',()=>{
 assert.equal(data.schemaVersion,1);assert.equal(new Set(data.products.map(p=>p.id)).size,6);assert.deepEqual(Object.keys(data.guides).sort(),data.products.map(p=>p.id).sort());
 for(const p of data.products){assert.match(p.id,/^[a-z0-9-]+$/);assert.ok(data.categories[p.category]);assert.ok(p.features.length);for(const k of ['name','label','desc','price','note'])assert.equal(typeof p[k],'string');const u=new URL(p.url);assert.equal(u.protocol,'https:');assert.equal(u.username,'');assert.equal(u.password,'');if(p.image){assert.match(p.image,/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/);assert.ok(fs.statSync(base+'/assets/'+p.image).size>0);}const guide=data.guides[p.id];assert.match(guide.tone,/^[a-z]+$/);assert.equal(guide.steps.length,3);for(const step of guide.steps)assert.equal(step.length,5);}
 for(const p of data.galleryItems){assert.ok(data.galleryCategories[p.category]);assert.ok(fs.existsSync(base+'/assets/'+p.image));}
 for(const k of ['title','accent','description'])assert.ok(typeof data.home[k]==='string'&&data.home[k].length);
 for(const c of [data.categories,data.galleryCategories])for(const [k,v] of Object.entries(c)){assert.match(k,/^[a-z0-9-]+$/);assert.equal(typeof v,'string');assert.doesNotMatch(v,/[<>]/);}
});
test('real shop serves the Sites shell and canonical route without demo work or invoices',async()=>{
 const {default:web}=await import('../src/index.js');const env={ASSETS:{fetch:async()=>new Response(fs.readFileSync(base+'/index.html'))}};
 for(const route of ['/','/shop','/portfolio','/custom-order','/products/shop-home']){const res=await web.fetch(new Request('https://shop.yggmetro.com'+route),env);assert.equal(res.status,200);const html=await res.text();assert.match(html,/studio\/content.js/);assert.match(html,/rel="canonical"/);assert.match(html,/go-sales-handoff/);assert.doesNotMatch(html,/work-ui.js|work-core.js|noindex|พรีวิวส่วนตัว/);}
 assert.equal((await web.fetch(new Request('https://shop.yggmetro.com/products/no-such'),env)).status,404);
 const head=await web.fetch(new Request('https://shop.yggmetro.com/shop',{method:'HEAD'}),env);assert.equal(await head.text(),'');
 const js=await web.fetch(new Request('https://shop.yggmetro.com/assets/shop/studio/content.js'),env);assert.match(js.headers.get('content-type'),/javascript/);assert.match(await js.text(),/StorefrontContent/);
});
test('Office editor publishes nothing and exposes only public configuration',async()=>{
 const {storefrontEditor}=await import('../src/storefront-editor.js');
 assert.equal((await storefrontEditor(new Request('https://shop.yggmetro.com/admin/storefront'))).status,404);
 assert.equal((await storefrontEditor(new Request('https://office.yggmetro.com/admin/storefront',{method:'POST'}))).status,405);
 const res=await storefrontEditor(new Request('https://office.yggmetro.com/admin/storefront/content'));assert.deepEqual(await res.json(),data);
 const html=await(await storefrontEditor(new Request('https://office.yggmetro.com/admin/storefront'))).text();assert.match(html,/github.com\/pureekangraw-ops\/yggmetro-web\/upload\/main/);assert.match(html,/ยังไม่เปลี่ยนเว็บจริง/);
});
