// Local-only acceptance harness. Stripe and R2 are synthetic; real handlers, SQLite and SDK signatures run.
import http from 'node:http';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import Stripe from 'stripe';
import web from '../../src/index.js';
import {getShopPublicCatalog} from '../../src/shop.js';
import {handleShopCheckout,handleStripeWebhook} from '../../src/stripe-checkout.js';
export async function startCheckoutPreview({failProviderOnce=false,dropSuccessOnce=false,failStoreOnce=false}={}){
 const db=new DatabaseSync(':memory:');
 for(const file of ['0001_shop_orders.sql','0003_shop_checkout_attempts.sql'])db.exec(await fs.readFile('migrations/'+file,'utf8'));
 const file=Buffer.from('UEsDBBQAAAAAAAAAVl2qUxLeLQAAAC0AAAAKAAAAUkVBRE1FLnR4dFN5bnRoZXRpYyA0MCBUSEIgZG93bmxvYWQuIE5vIGN1c3RvbWVyIGRhdGEuClBLAQIUAxQAAAAAAAAAVl2qUxLeLQAAAC0AAAAKAAAAAAAAAAAAAACAAQAAAABSRUFETUUudHh0UEsFBgAAAAABAAEAOAAAAFUAAAAAAA==','base64');
 const sandbox='https://yggmetro-shop-sandbox.example';let created=0;const requests=[];
 const adminToken='local_office_fixture_'.padEnd(40,'x');
 const env={YGG_ADMIN_CREDENTIALS:JSON.stringify({fixture:createHash('sha256').update(adminToken).digest('hex')}),SHOP_OFFICE_READ_ACTORS:'["fixture"]',SHOP_ENVIRONMENT:'sandbox',SHOP_SANDBOX_ORIGIN:sandbox,STRIPE_CHECKOUT_MODE:'test',STRIPE_TEST_CHECKOUT_ENABLED:'true',STRIPE_TEST_KEY:'rk_test_local_fixture',STRIPE_TEST_WEBHOOK_SECRET:'whsec_local_fixture',STRIPE_TEST_CATALOG:JSON.stringify({'checkout-test':{enabled:true,priceId:'price_LOCAL',amount:4000,currency:'thb',deliveryKey:'private/checkout-test.zip'}}),SHOP_ORDERS:{prepare:sql=>({bind:(...args)=>({first:async()=>db.prepare(sql).get(...args),all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>{if(failStoreOnce&&sql.startsWith('INSERT INTO shop_orders')){failStoreOnce=false;throw Error('synthetic D1 outage')}return db.prepare(sql).run(...args)}})})},SHOP_DOWNLOADS:{head:async()=>({size:file.length}),get:async()=>({body:file})},ASSETS:{fetch:async request=>{try{const base=path.resolve('public'),name=path.resolve(base,'.'+new URL(request.url).pathname);if(!name.startsWith(base+path.sep))return new Response('',{status:404});const ext=path.extname(name),type={'.js':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'}[ext]||'application/octet-stream';return new Response(await fs.readFile(name),{headers:{'content-type':type}})}catch{return new Response('',{status:404})}}}};
 const session={id:'cs_test_local40',url:'https://checkout.stripe.com/c/test_local40',status:'open',livemode:false,mode:'payment',payment_status:'unpaid',amount_total:4000,currency:'thb',metadata:{slug:'checkout-test',surface:'yggmetro-test-store'}};
 const stripe=new Stripe('rk_test_local_fixture',{httpClient:Stripe.createFetchHttpClient()});
 const sdk={prices:{retrieve:async()=>({livemode:false,active:true,type:'one_time',unit_amount:4000,currency:'thb'})},checkout:{sessions:{create:async(body,options)=>{created++;requests.push({body,options});if(failProviderOnce){failProviderOnce=false;throw Error('synthetic unknown response')}return session},retrieve:async()=>session,listLineItems:async()=>({data:[{price:{id:'price_LOCAL'},quantity:1}],has_more:false})}},webhooks:stripe.webhooks};
 let origin;
 const server=http.createServer(async(req,res)=>{try{
  const bytes=[];for await(const chunk of req)bytes.push(chunk);const headers={...req.headers};if(headers.origin===origin)headers.origin=sandbox;
  const request=new Request(sandbox+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(bytes)}:{})});
  let response;if(req.url==='/api/v1/shop/checkout')response=await handleShopCheckout(request,env,getShopPublicCatalog(env),()=>sdk);else response=await web.fetch(request,env);
  if(dropSuccessOnce&&req.url==='/api/v1/shop/checkout'&&response.status===200){dropSuccessOnce=false;res.writeHead(502,{'content-type':'application/json'});res.end('{}');return}
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){res.writeHead(500);res.end('Fixture error: '+e.message)}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 return {origin,db,file,requests,adminToken,get created(){return created},async pay(){session.status='complete';session.payment_status='paid';const body=JSON.stringify({id:'evt_local40',livemode:false,type:'checkout.session.completed',data:{object:session}});const signature=await stripe.webhooks.generateTestHeaderStringAsync({payload:body,secret:env.STRIPE_TEST_WEBHOOK_SECRET,cryptoProvider:Stripe.createSubtleCryptoProvider()});return handleStripeWebhook(new Request(sandbox+'/api/v1/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body}),env,()=>sdk)},async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close()}};
}
