const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare'),{build}=require('esbuild');
test('real local Worker RPC binding reads only sandbox projection; HTTP and forged labels cannot enter',async t=>{
 const result=await build({entryPoints:['src/sandbox/index.js'],bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers']});
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[
  {name:'caller',compatibilityDate:'2026-10-01',modules:true,script:'export default {async fetch(r,e){if(new URL(r.url).pathname==="/named")return e.SHOP.fetch(r);return Response.json(await e.SHOP.shopOrdersRead({}));}}',serviceBindings:{SHOP:{name:'shop',entrypoint:'ShopCommerceRead'}}},
  {name:'shop',compatibilityDate:'2026-10-01',modules:true,script:result.outputFiles[0].text,d1Databases:['SHOP_ORDERS'],bindings:{SHOP_ENVIRONMENT:'sandbox',SHOP_SANDBOX_ORIGIN:'https://sandbox.example',STRIPE_CHECKOUT_MODE:'test'}}
 ]}));t.after(()=>mf.dispose());
 const db=await mf.getD1Database('SHOP_ORDERS','shop');
 await db.exec(fs.readFileSync('migrations/0001_shop_orders.sql','utf8').replace(/\n/g,' '));
 await db.prepare('INSERT INTO shop_orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind('cs_test_fixture','fixture','shop-home','price_fixture',4000,'thb','private.zip','private-owner-hash','paid','evt_fixture',1,2).run();
 const data=await(await mf.dispatchFetch('https://caller.example')).json();assert.equal(data.ok,true);assert.equal(data.orders[0].amount_minor,4000);assert.equal(data.orders[0].customer_receipt,'unknown');assert.equal(JSON.stringify(data).includes('private'),false);
 const shop=await mf.getWorker('shop');
 const publicRead=await shop.fetch('https://sandbox.example/api/v1/admin/shop/orders',{headers:{'x-platform':'GO','authorization':'Bearer '+'x'.repeat(40)}});assert.equal(publicRead.status,401);
 assert.equal((await mf.dispatchFetch('https://caller.example/named')).status,404);
});
