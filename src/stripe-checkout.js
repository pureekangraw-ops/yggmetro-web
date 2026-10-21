import Stripe from 'stripe';
import {shopOrigin, isShopRequest} from './shop-origin.js';

const headers = {'cache-control':'no-store','x-content-type-options':'nosniff'};
const respond = (body,status=200,extra={}) => Response.json(body,{status,headers:{...headers,...extra}});
const sessionPattern = /^cs_(test|live)_[A-Za-z0-9_]+$/;
const sessionForMode=(env,id)=>sessionPattern.test(id||'')&&id.startsWith(configuration(env).live?'cs_live_':'cs_test_');
const tokenPattern = /^[a-f0-9]{64}$/;
const cookieName = '__Host-ygg-order';
const maxBytes = 4096;

// Explicit mode keeps test data out of the live storefront. Existing secret names are supported.
function configuration(env){
 const live=env?.STRIPE_CHECKOUT_MODE==='live';
 return {live,key:live?(env.STRIPE_SECRET_KEY||env.STRIP_PRODUCTION):env?.STRIPE_TEST_KEY,
 webhook:live?env.STRIPE_WEBHOOK_SECRET:env?.STRIPE_TEST_WEBHOOK_SECRET,
 enabled:live?env.STRIPE_CHECKOUT_ENABLED==='true':env?.STRIPE_TEST_CHECKOUT_ENABLED==='true',
 catalog:live?env.STRIPE_CATALOG:env?.STRIPE_TEST_CATALOG};
}
export function getShopProduct(env,slug) {
  if (!shopOrigin(env)) return null;
  const config=configuration(env);
  if(!config.enabled || !(config.live?/^(rk|sk)_live_/:/^(rk|sk)_test_/).test(config.key||'') ||
    !env?.SHOP_ORDERS?.prepare || !env?.SHOP_DOWNLOADS?.get || !env?.SHOP_DOWNLOADS?.head || !config.webhook)return null;
  let catalog;try{catalog=JSON.parse(config.catalog||'{}')}catch{return null}
  const item=catalog[slug];
  if(!item || item.enabled!==true || !/^price_[A-Za-z0-9]+$/.test(item.priceId||'') ||
    !Number.isSafeInteger(item.amount)||item.amount<=0||!['usd','thb'].includes(item.currency)||
    !/^[a-zA-Z0-9][a-zA-Z0-9/_ .-]{0,180}$/.test(item.deliveryKey||'')||item.deliveryKey.includes('..'))return null;
  return item;
}
export const getTestProduct=getShopProduct;
const clientFor=env=>new Stripe(configuration(env).key,{httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:1,timeout:10000});
const hash=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('');
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
async function limitedBody(request,max){
  if(Number(request.headers.get('content-length')||0)>max)throw new Error('BODY_TOO_LARGE');
  const reader=request.body?.getReader();if(!reader)return '';
  const chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new Error('BODY_TOO_LARGE')}chunks.push(value)}}finally{reader.releaseLock()}
  const out=new Uint8Array(size);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length}return new TextDecoder().decode(out);
}
export async function handleShopCheckout(request,env,catalog,client=clientFor) {
  if(request.method!=='POST')return respond({ok:false,code:'METHOD_NOT_ALLOWED'},405,{allow:'POST'});
  const origin = shopOrigin(env);
  if(!isShopRequest(request,env)||request.headers.get('origin')!==origin)return respond({ok:false,code:'ORIGIN_DENIED'},403);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))return respond({ok:false,code:'JSON_REQUIRED'},415);
  let body;try{body=JSON.parse(await limitedBody(request,maxBytes))}catch(e){return respond({ok:false,code:e.message==='BODY_TOO_LARGE'?'BODY_TOO_LARGE':'INVALID_JSON'},e.message==='BODY_TOO_LARGE'?413:400)}
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['slug','requestId','email'].includes(k))||
    typeof body.slug!=='string'||!catalog.some(p=>p.slug===body.slug)||!tokenPattern.test(body.requestId||''))return respond({ok:false,code:'INVALID_CHECKOUT'},400);
  if(body.email!==undefined&&(typeof body.email!=='string'||body.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)))return respond({ok:false,code:'EMAIL_INVALID'},400);
  const product=getShopProduct(env,body.slug);const config=configuration(env);if(!product)return respond({ok:false,code:'CHECKOUT_NOT_READY'},503);
  try {
    // Delivery and price are verified before creating any checkout; a browser supplies no amounts or file keys.
    if(!await env.SHOP_DOWNLOADS.head(product.deliveryKey))return respond({ok:false,code:'DELIVERY_NOT_READY'},503);
    const stripe=client(env),price=await stripe.prices.retrieve(product.priceId);
    if(price.livemode!==config.live||!price.active||price.type!=='one_time'||price.unit_amount!==product.amount||price.currency!==product.currency)return respond({ok:false,code:'PRICE_MISMATCH'},503);
    const owner=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-ygg-order=([a-f0-9]{64})(?:;|$)/)?.[1];
    const secret=owner||token(),digest=await hash(secret);
    // Bind a retry to its existing owner cookie, rather than issuing access to an old session.
    const existing=await env.SHOP_ORDERS.prepare('SELECT session_id, token_hash FROM shop_orders WHERE request_id = ?').bind(body.requestId).first();
    if(existing){if(!sessionForMode(env,existing.session_id))return respond({ok:false,code:'CHECKOUT_CONFLICT'},409);if(!owner||await hash(owner)!==existing.token_hash)return respond({ok:false,code:'CHECKOUT_CONFLICT'},409);const previous=await stripe.checkout.sessions.retrieve(existing.session_id);if(previous.status==='complete')return respond({ok:true,orderUrl:'/order?session_id='+encodeURIComponent(existing.session_id),testMode:!config.live});if(previous.status==='expired'||!previous.url)return respond({ok:false,code:'CHECKOUT_EXPIRED'},409);return respond({ok:true,url:previous.url,testMode:!config.live})}
    const checkout=await stripe.checkout.sessions.create({mode:'payment',...(body.email?{customer_email:body.email}:{}),line_items:[{price:product.priceId,quantity:1}],success_url:origin+'/order?session_id={CHECKOUT_SESSION_ID}',cancel_url:origin+'/checkout',client_reference_id:body.slug,metadata:{slug:body.slug,surface:config.live?'yggmetro-store':'yggmetro-test-store'},integration_identifier:'yggmetro_web_'+body.requestId.slice(0,8).replace(/[0-9]/g,n=>String.fromCharCode(103+Number(n)))},{idempotencyKey:'yggmetro-shop-'+body.requestId});
    if(checkout.livemode!==config.live||!sessionForMode(env,checkout.id)||!checkout.url?.startsWith('https://checkout.stripe.com/'))return respond({ok:false,code:'INVALID_PROVIDER_SESSION'},502);
    await env.SHOP_ORDERS.prepare('INSERT INTO shop_orders (session_id, request_id, slug, price_id, amount, currency, delivery_key, token_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(checkout.id,body.requestId,body.slug,product.priceId,product.amount,product.currency,product.deliveryKey,digest,'pending',Date.now()).run();
    return respond({ok:true,url:checkout.url,testMode:!configuration(env).live},200,{'set-cookie':cookieName+'='+secret+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000'});
  }catch{return respond({ok:false,code:'CHECKOUT_UNAVAILABLE'},503)}
}
export async function handleStripeWebhook(request,env,client=clientFor) {
  if(!isShopRequest(request,env))return respond({ok:false,code:'ORIGIN_DENIED'},403);
  if(request.method!=='POST')return respond({ok:false},405,{allow:'POST'});
  const config=configuration(env);
  if(!config.webhook||!env?.SHOP_ORDERS?.prepare||!(config.live?/^(rk|sk)_live_/:/^(rk|sk)_test_/).test(config.key||''))return respond({ok:false,code:'WEBHOOK_NOT_READY'},503);
  let event,stripe;try{stripe=client(env);event=await stripe.webhooks.constructEventAsync(await limitedBody(request,262144),request.headers.get('stripe-signature')||'',config.webhook,300,Stripe.createSubtleCryptoProvider())}catch{return respond({ok:false,code:'INVALID_SIGNATURE'},400)}
  if(event.livemode!==config.live)return respond({ok:false,code:'LIVE_MODE_REJECTED'},400);
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return respond({ok:true,ignored:true});
  const session=event.data?.object;
  if(!session||session.payment_status!=='paid'||!sessionForMode(env,session.id))return respond({ok:true,ignored:true});
  try{
    const order=await env.SHOP_ORDERS.prepare('SELECT * FROM shop_orders WHERE session_id = ?').bind(session.id).first();
    if(!order)return respond({ok:false,code:'ORDER_NOT_FOUND'},503); // retry if checkout insert is still in progress
    if(session.mode!=='payment'||session.amount_total!==order.amount||session.currency!==order.currency||session.metadata?.slug!==order.slug||session.metadata?.surface!==(config.live?'yggmetro-store':'yggmetro-test-store'))return respond({ok:false,code:'ORDER_MISMATCH'},400);
    const lines=await stripe.checkout.sessions.listLineItems(session.id,{limit:2});
    if(lines.has_more||lines.data.length!==1||lines.data[0].price?.id!==order.price_id||lines.data[0].quantity!==1)return respond({ok:false,code:'ITEM_MISMATCH'},400);
    // One SQL update is the durable fulfillment decision. Repeated/different events for a session cannot issue multiple entitlements.
    await env.SHOP_ORDERS.prepare("UPDATE shop_orders SET status = 'paid', event_id = ?, paid_at = ? WHERE session_id = ? AND status = 'pending'").bind(event.id,Date.now(),session.id).run();
    return respond({ok:true});
  }catch{return respond({ok:false,code:'WEBHOOK_RETRY'},503)}
}
export async function handleShopOrder(request,env) {
  if(!isShopRequest(request,env))return respond({ok:false,code:'ORDER_UNAVAILABLE'},404);
  if(!['GET','HEAD'].includes(request.method))return respond({ok:false},405,{allow:'GET, HEAD'});
  const url=new URL(request.url),id=url.searchParams.get('session_id');
  const owner=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-ygg-order=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!sessionForMode(env,id)||!owner||!env?.SHOP_ORDERS?.prepare)return respond({ok:false,code:'ORDER_UNAVAILABLE'},404);
  try {
    const order=await env.SHOP_ORDERS.prepare('SELECT * FROM shop_orders WHERE session_id = ? AND token_hash = ?').bind(id,await hash(owner)).first();
    if(!order)return respond({ok:false,code:'ORDER_UNAVAILABLE'},404);
    if(url.pathname.endsWith('/download')){
      if(order.status!=='paid')return respond({ok:false,code:'PAYMENT_PENDING'},409);
      const file=await env.SHOP_DOWNLOADS.get(order.delivery_key);if(!file)return respond({ok:false,code:'DELIVERY_UNAVAILABLE'},503);
      return new Response(request.method==='HEAD'?null:file.body,{headers:{...headers,'content-type':'application/octet-stream','content-disposition':'attachment; filename="'+order.slug+'.zip"'}});
    }
    return respond({ok:true,status:order.status,testMode:!configuration(env).live});
  }catch{return respond({ok:false,code:'ORDER_UNAVAILABLE'},503)}
}
export const orderPage=`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ติดตามการชำระเงิน · YGG METRO</title><style>body{background:#101019;color:#faf7ff;font:16px/1.7 system-ui;margin:0;padding:40px}main{max-width:650px;margin:10vh auto}a,button{color:#e3cfff;min-height:44px;padding:12px;display:inline-block}button{background:#292033;border:1px solid #6a557f;border-radius:8px}a[hidden]{display:none}</style></head><body><main><p>YGG METRO · รายการสั่งซื้อ</p><h1>ติดตามรายการของคุณ</h1><p id="status" aria-live="polite">กำลังตรวจสถานะ…</p><button id="check" type="button">ตรวจสถานะอีกครั้ง</button><a id="download" hidden>ดาวน์โหลดสินค้า</a><p>ระบบจะเปิดดาวน์โหลดเมื่อได้รับการยืนยันจากผู้ให้บริการชำระเงิน</p><a href="/shop">กลับร้านค้า</a> · <a href="/client">ติดต่อเรา</a></main><script>const id=new URLSearchParams(location.search).get('session_id');const button=document.getElementById('check'),label=document.getElementById('status'),link=document.getElementById('download');async function check(){button.disabled=true;try{const r=await fetch('/api/v1/shop/order?session_id='+encodeURIComponent(id||''));const d=await r.json();if(!r.ok)throw Error();if(d.status==='paid'){try{localStorage.removeItem('yggmetro-cart-v1')}catch{}}label.textContent=d.status==='paid'?'ได้รับการยืนยันแล้ว ดาวน์โหลดสินค้าได้เลย':'กำลังรอการยืนยันการชำระเงิน กรุณาตรวจอีกครั้งในสักครู่';link.hidden=d.status!=='paid';if(d.status==='paid')link.href='/api/v1/shop/order/download?session_id='+encodeURIComponent(id)}catch{label.textContent='ยังตรวจรายการไม่ได้ โปรดใช้เบราว์เซอร์ที่เริ่มชำระเงิน หรือติดต่อเรา'}finally{button.disabled=false}}button.addEventListener('click',check);check();</script></body></html>`;

