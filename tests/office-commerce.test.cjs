const test=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite'),fs=require('node:fs'),{createHash}=require('node:crypto');
const token='fixture_admin_'.padEnd(40,'a'),owner='c'.repeat(64),hash=v=>createHash('sha256').update(v).digest('hex');
async function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(fs.readFileSync('migrations/0001_shop_orders.sql','utf8'));
 const store={prepare:q=>({bind:(...args)=>({first:async()=>db.prepare(q).get(...args),all:async()=>({results:db.prepare(q).all(...args)}),run:async()=>db.prepare(q).run(...args)})})};
 const env={SHOP_ORDERS:store,YGG_ADMIN_CREDENTIALS:JSON.stringify({owner:hash(token)}),SHOP_OFFICE_READ_ACTORS:'["owner"]',STRIPE_TEST_KEY:'rk_test_fixture',STRIPE_TEST_WEBHOOK_SECRET:'whsec_fixture',SHOP_DOWNLOADS:{get:async()=>({body:'fixture ZIP'})}};
 function insert(id='cs_test_one',currency='thb',amount=4000,status='pending'){db.prepare('INSERT INTO shop_orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,id,'shop-home','price_fixture',amount,currency,'private.zip',hash(owner),status,null,1,null)}
 const {officeCommerce}=await import('../src/office-commerce.js');
 const read=(extra={},auth=token,url='https://office.yggmetro.com/api/v1/admin/shop/orders')=>officeCommerce(new Request(url,{headers:auth?{authorization:'Bearer '+auth}:{}}),{...env,...extra});
 return {db,env,insert,read,officeCommerce};
}
test('commerce requires existing admin AND explicit grant; customer cookies never grant access',async t=>{
 const f=await fixture(t);f.insert();
 assert.equal((await f.read({},null)).status,401);assert.equal((await f.read({},'x'.repeat(40))).status,401);
 assert.equal((await f.read({SHOP_OFFICE_READ_ACTORS:undefined})).status,403);
 assert.equal((await f.read({SHOP_ORDERS:undefined})).status,503);
 assert.equal((await f.officeCommerce(new Request('https://office.yggmetro.com/api/v1/admin/shop/orders',{headers:{cookie:'__Host-ygg-order='+owner}}),f.env)).status,401);
 for(const host of ['shop.yggmetro.com','evil.example'])assert.equal((await f.read({},token,'https://'+host+'/api/v1/admin/shop/orders')).status,404);
 assert.equal((await f.officeCommerce(new Request('https://office.yggmetro.com/api/v1/admin/shop/orders',{headers:{authorization:'Bearer '+token,origin:'https://evil.example'}}),f.env)).status,403);
});
test('Office projects canonical payment state; duplicate webhook evidence and failed downloads do not invent receipt',async t=>{
 const f=await fixture(t);f.insert();const {handleStripeWebhook,handleShopOrder}=await import('../src/stripe-checkout.js');
 const download=cookie=>handleShopOrder(new Request('https://shop.yggmetro.com/api/v1/shop/order/download?session_id=cs_test_one',{headers:{cookie:'__Host-ygg-order='+cookie}}),f.env);
 assert.equal((await download(owner)).status,409);
 assert.equal((await f.read()).headers.get('cache-control'),'no-store');
 let data=await(await f.read()).json();assert.equal(data.orders[0].download_authorized,false);assert.deepEqual(data.totals,[]);
 const event={id:'evt_fixture',livemode:false,type:'checkout.session.completed',data:{object:{id:'cs_test_one',mode:'payment',payment_status:'paid',amount_total:4000,currency:'thb',metadata:{slug:'shop-home',surface:'yggmetro-test-store'}}}};
 const client=()=>({webhooks:{constructEventAsync:async()=>event},checkout:{sessions:{listLineItems:async()=>({has_more:false,data:[{price:{id:'price_fixture'},quantity:1}]})}}});
 const webhook=()=>handleStripeWebhook(new Request('https://shop.yggmetro.com/api/v1/stripe/webhook',{method:'POST',body:'fixture'}),f.env,client);
 assert.equal((await webhook()).status,200);const first=await(await f.read()).json();assert.equal((await webhook()).status,200);assert.deepEqual(await(await f.read()).json(),first);
 assert.equal((await download('d'.repeat(64))).status,404);assert.equal(await(await download(owner)).text(),'fixture ZIP');
 f.env.SHOP_DOWNLOADS.get=async()=>null;assert.equal((await download(owner)).status,503);
 data=await(await f.read()).json();assert.deepEqual(data,first);assert.equal(data.orders[0].payment_status,'paid');assert.equal(data.orders[0].download_authorized,true);assert.equal(data.orders[0].download_evidence,'not_recorded');assert.equal(data.orders[0].customer_receipt,'unknown');
 assert.deepEqual(data.totals,[{currency:'thb',amount_minor:4000,order_count:1}]);
 assert.equal(JSON.stringify(data).includes('private.zip'),false);assert.equal(JSON.stringify(data).includes(hash(owner)),false);
});
test('totals separate currencies and mode, exclude unpaid, paginate without double-counting',async t=>{
 const f=await fixture(t);f.insert('cs_test_thb','thb',4000,'paid');f.insert('cs_test_usd','usd',900,'paid');f.insert('cs_live_usd','usd',700,'paid');f.insert('cs_test_unpaid','usd',800);
 const d=await(await f.read()).json();assert.deepEqual(d.totals,[{currency:'thb',amount_minor:4000,order_count:1},{currency:'usd',amount_minor:900,order_count:1}]);assert.equal(d.orders.length,3);
 const live=await(await f.read({STRIPE_CHECKOUT_MODE:'live'})).json();assert.equal(live.orders.length,1);assert.equal(live.totals[0].amount_minor,700);
 for(let i=0;i<100;i++)f.insert('cs_test_extra'+i);
 const page=await(await f.read()).json();assert.equal(page.orders.length,100);assert.match(page.next_cursor,/^1:cs_test_/);f.insert('cs_test_new');f.db.prepare('UPDATE shop_orders SET created_at=2 WHERE session_id=?').run('cs_test_new');
 const next=await(await f.read({},token,'https://office.yggmetro.com/api/v1/admin/shop/orders?cursor='+encodeURIComponent(page.next_cursor))).json();assert.equal(next.orders.length,3);assert.deepEqual(next.totals,page.totals);assert.equal(next.orders.some(o=>page.orders.some(p=>p.order_id===o.order_id)),false);
 assert.equal((await f.read({},token,'https://office.yggmetro.com/api/v1/admin/shop/orders?cursor=-1')).status,400);
 assert.equal((await f.read({STRIPE_CHECKOUT_MODE:'invalid'})).status,503);
});
test('Office page contains no order data and unsupported writes are rejected',async t=>{
 const f=await fixture(t);f.insert();const url='https://office.yggmetro.com/admin/shop';const response=await f.officeCommerce(new Request(url),f.env);assert.equal(response.status,200);assert.equal((await response.text()).includes('cs_test_one'),false);
 assert.equal((await f.officeCommerce(new Request(url,{method:'POST'}),f.env)).status,405);
 assert.equal(await f.officeCommerce(new Request('https://office.yggmetro.com/api/v1/admin/requests'),f.env),null);
});
