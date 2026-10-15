const test=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const load=()=>import('../src/stripe-checkout.js');
function fixture(){const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('migrations/0001_shop_orders.sql','utf8'));
 const store={prepare:sql=>({bind:(...args)=>({first:async()=>db.prepare(sql).get(...args),run:async()=>db.prepare(sql).run(...args)})})};
 const item={enabled:true,priceId:'price_TEST',amount:900,currency:'usd',deliveryKey:'shop-home.zip'};
 const env={STRIPE_TEST_CHECKOUT_ENABLED:'true',STRIPE_TEST_KEY:'rk_test_fixture',STRIPE_TEST_WEBHOOK_SECRET:'whsec_fixture',STRIPE_TEST_CATALOG:JSON.stringify({'shop-home':item}),SHOP_ORDERS:store,SHOP_DOWNLOADS:{head:async()=>({}),get:async()=>({body:'paid-zip-content'})}};
 const session={id:'cs_test_example',url:'https://checkout.stripe.com/c/test_example',livemode:false,mode:'payment',payment_status:'paid',amount_total:900,currency:'usd',metadata:{slug:'shop-home',surface:'yggmetro-test-store'}};
 let event={id:'evt_1',livemode:false,type:'checkout.session.completed',data:{object:session}},created=0;
 const sdk={prices:{retrieve:async()=>({livemode:false,active:true,type:'one_time',unit_amount:900,currency:'usd'})},checkout:{sessions:{create:async body=>{created++;assert.equal(body.line_items[0].price,'price_TEST');assert.equal(body.payment_method_types,undefined);return session},retrieve:async()=>session,listLineItems:async()=>({data:[{price:{id:'price_TEST'},quantity:1}],has_more:false})}},webhooks:{constructEventAsync:async(raw,sig)=>{if(sig!=='valid')throw Error('bad signature');return event}}};
 return {db,env,session,sdk,get created(){return created},set event(e){event=e}}}
function checkout(extra={},origin='https://shop.yggmetro.com'){return new Request('https://shop.yggmetro.com/api/v1/shop/checkout',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({slug:'shop-home',requestId:'a'.repeat(64),...extra})})}
const webhook=sig=>new Request('https://shop.yggmetro.com/api/v1/stripe/webhook',{method:'POST',headers:{'stripe-signature':sig},body:'{}'});
const catalog=[{slug:'shop-home'}];
test('checkout fails closed for missing configuration, foreign origin and client prices',async()=>{
 const {handleShopCheckout,getTestProduct}=await load();const f=fixture();
 assert.equal((await handleShopCheckout(checkout(),{},catalog)).status,503);
 assert.equal((await handleShopCheckout(checkout({},'https://evil.example'),f.env,catalog)).status,403);
 assert.equal((await handleShopCheckout(checkout({amount:1}),f.env,catalog)).status,400);
 assert.equal(getTestProduct({...f.env,STRIPE_TEST_KEY:'sk_live_no'},'shop-home'),null);
 assert.equal(f.created,0);f.db.close();
});
test('checkout uses server price, persists pending order and issues an HttpOnly owner cookie',async()=>{
 const {handleShopCheckout}=await load();const f=fixture();
 const response=await handleShopCheckout(checkout(),f.env,catalog,()=>f.sdk);assert.equal(response.status,200);
 assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 assert.equal(f.db.prepare('SELECT status FROM shop_orders').get().status,'pending');
 const retry=await handleShopCheckout(checkout(),f.env,catalog,()=>f.sdk);assert.equal(retry.status,409);assert.equal(f.created,1);f.db.close();
});
test('unavailable delivery or mismatched Stripe price cannot create a checkout',async()=>{
 const {handleShopCheckout}=await load();let f=fixture();f.env.SHOP_DOWNLOADS.head=async()=>null;
 assert.equal((await handleShopCheckout(checkout(),f.env,catalog,()=>f.sdk)).status,503);assert.equal(f.created,0);f.db.close();
 f=fixture();f.sdk.prices.retrieve=async()=>({livemode:false,active:true,type:'one_time',unit_amount:1,currency:'usd'});
 assert.equal((await handleShopCheckout(checkout(),f.env,catalog,()=>f.sdk)).status,503);assert.equal(f.created,0);f.db.close();
});
test('download requires owner cookie AND signed paid webhook, webhook retry is idempotent',async()=>{
 const {handleShopCheckout,handleStripeWebhook,handleShopOrder}=await load();const f=fixture();
 const result=await handleShopCheckout(checkout(),f.env,catalog,()=>f.sdk);const cookie=result.headers.get('set-cookie').split(';')[0];
 const order=(path,c=cookie)=>new Request('https://shop.yggmetro.com/api/v1/shop/order'+path+'?session_id=cs_test_example',{headers:{cookie:c}});
 assert.equal((await handleShopOrder(order('/download'),f.env)).status,409);
 assert.equal((await handleStripeWebhook(webhook('invalid'),f.env,()=>f.sdk)).status,400);
 assert.equal((await handleStripeWebhook(webhook('valid'),f.env,()=>f.sdk)).status,200);
 assert.equal((await handleStripeWebhook(webhook('valid'),f.env,()=>f.sdk)).status,200);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM shop_orders').get().n,1);
 assert.equal((await handleShopOrder(order('/download',''),f.env)).status,404);
 const download=await handleShopOrder(order('/download'),f.env);assert.equal(download.status,200);assert.equal(await download.text(),'paid-zip-content');f.db.close();
});
test('unpaid, live, wrong amount and wrong product events never unlock delivery',async()=>{
 const {handleShopCheckout,handleStripeWebhook}=await load();
 for(const patch of [{payment_status:'unpaid'},{amount_total:1},{metadata:{slug:'other'}},{currency:'thb'}]){
  const f=fixture();await handleShopCheckout(checkout(),f.env,catalog,()=>f.sdk);Object.assign(f.session,patch);
  await handleStripeWebhook(webhook('valid'),f.env,()=>f.sdk);assert.equal(f.db.prepare('SELECT status FROM shop_orders').get().status,'pending');f.db.close();
 }
 const f=fixture();f.event={id:'evt_live',livemode:true,type:'checkout.session.completed',data:{object:f.session}};
 assert.equal((await handleStripeWebhook(webhook('valid'),f.env,()=>f.sdk)).status,400);f.db.close();
});
test('async success unlocks payment only after paid event; missing order asks Stripe to retry',async()=>{
 const {handleShopCheckout,handleStripeWebhook}=await load();const f=fixture();
 f.event={id:'evt_async',livemode:false,type:'checkout.session.async_payment_succeeded',data:{object:f.session}};
 assert.equal((await handleStripeWebhook(webhook('valid'),f.env,()=>f.sdk)).status,503);
 await handleShopCheckout(checkout(),f.env,catalog,()=>f.sdk);
 assert.equal((await handleStripeWebhook(webhook('valid'),f.env,()=>f.sdk)).status,200);
 assert.equal(f.db.prepare('SELECT status FROM shop_orders').get().status,'paid');f.db.close();
});
test('real Stripe SDK accepts signed payload and rejects tampering before any order write',async()=>{
 const {handleStripeWebhook}=await load();const {default:Stripe}=await import('stripe');const f=fixture();
 const stripe=new Stripe('rk_test_fixture',{httpClient:Stripe.createFetchHttpClient()});
 const payload=JSON.stringify({id:'evt_signed_fixture',object:'event',livemode:false,type:'product.created',data:{object:{}}});
 const signature=await stripe.webhooks.generateTestHeaderStringAsync({payload,secret:'whsec_fixture',cryptoProvider:Stripe.createSubtleCryptoProvider()});
 const request=text=>new Request('https://shop.yggmetro.com/api/v1/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body:text});
 assert.equal((await handleStripeWebhook(request(payload),f.env,()=>stripe)).status,200);
 assert.equal((await handleStripeWebhook(request(payload+' '),f.env,()=>stripe)).status,400);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM shop_orders').get().n,0);f.db.close();
});
