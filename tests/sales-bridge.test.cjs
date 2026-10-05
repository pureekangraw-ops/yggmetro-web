const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/index.js')).href);
test('public event route forwards observations through existing GO_HUB binding',async()=>{
 const {default:web}=await load();let seen;
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({eventId:'EV-1',type:'PAGE_VIEW',page:'/?secret=remove',source:'direct'})}),{GO_HUB:{fetch:async r=>{seen={url:r.url,body:await r.json()};return Response.json({ok:true});}}});
 assert.equal(response.status,200);assert.equal(seen.url,'https://go-hub.internal/internal/spectrum/event');assert.equal(seen.body.page,'/');
});
test('unavailable event transport does not claim saved',async()=>{
 const {default:web}=await load();const response=await web.fetch(new Request('https://yggmetro.com/api/v1/events',{method:'POST',body:JSON.stringify({eventId:'EV-2',type:'PAGE_VIEW',page:'/'})}),{});assert.equal(response.status,503);
});
test('public event intake rejects payment claims',async()=>{
 const {default:web}=await load();const response=await web.fetch(new Request('https://yggmetro.com/api/v1/events',{method:'POST',body:JSON.stringify({eventId:'EV-3',type:'PAYMENT_CONFIRMED',page:'/'})}),{});assert.equal(response.status,400);
});

test('storefront observer emits the missing funnel stages without customer content',async()=>{
 const {default:web}=await load();
 const home=await (await web.fetch(new Request('https://yggmetro.com/'),{})).text();
 const client=await (await web.fetch(new Request('https://yggmetro.com/client'),{})).text();
 const observer=client.slice(client.lastIndexOf('<script>'));
 assert.match(home,/target\.searchParams\.get\('service'\)\?'SERVICE_INTEREST':'CTA_CLICK'/);
 assert.match(client,/let briefStarted=false/);
 assert.match(client,/target\.id==='input'&&target\.value\.trim\(\)/);
 assert.match(client,/(?:clicked|target)\.closest\('\.quick'\)/);
 assert.match(client,/observe\('BRIEF_STARTED'\)/);
 assert.doesNotMatch(observer,/briefId|clientId|conversationId|goal|messages/);
});

test('checkout request forwards identity only and preserves payment authority in GO Hub',async()=>{
 const {default:web}=await load();let seen;
 const env={GO_HUB:{fetch:async r=>{seen={url:r.url,headers:Object.fromEntries(r.headers),body:await r.json()};return Response.json({
   ok:true,paymentId:'PAY-1',quoteId:'QUOTE-1',workId:'WORK-1',status:'PAYMENT_PENDING',checkoutUrl:'https://checkout.example.test/session/1',providerReference:'REF-1'
 });}}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/payment/checkout',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'payment-forward'},body:JSON.stringify({
   customerId:'CLIENT-1',quoteId:'QUOTE-1',workId:'WORK-1',idempotencyKey:'CHECKOUT-1'
 })}),env);
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(seen.url,'https://go-hub.internal/internal/payment/checkout');
 assert.equal(seen.headers['x-yggmetro-surface'],'SPECTRUMSALE');
 assert.deepEqual(Object.keys(seen.body).sort(),['customerId','idempotencyKey','quoteId','requestedAt','surface','version','workId']);
 assert.equal(seen.body.status,undefined);
 assert.equal(seen.body.amount,undefined);
 assert.equal(body.status,'PAYMENT_PENDING');
 assert.equal(body.checkoutUrl,'https://checkout.example.test/session/1');
});

test('checkout request rejects customer payment truth and card-like data before transport',async()=>{
 const {default:web}=await load();let called=false;
 const env={GO_HUB:{fetch:async()=>{called=true;return Response.json({ok:true})}}};
 for(const [ip,extra] of [['payment-status',{status:'PAYMENT_CONFIRMED'}],['payment-card',{cardNumber:'4111111111111111'}],['payment-amount',{amount:5000,currency:'THB'}]]){
   const response=await web.fetch(new Request('https://yggmetro.com/api/v1/payment/checkout',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip},body:JSON.stringify({customerId:'CLIENT-1',quoteId:'QUOTE-1',workId:'WORK-1',idempotencyKey:'CHECKOUT-1',...extra})}),env);
   assert.equal(response.status,400,ip);
 }
 assert.equal(called,false);
});

test('provider-confirmed status requires provider evidence in owner readback',async()=>{
 const {default:web}=await load();
 const request=ip=>new Request('https://yggmetro.com/api/v1/payment/checkout',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip},body:JSON.stringify({customerId:'CLIENT-1',quoteId:'QUOTE-1',workId:'WORK-1',idempotencyKey:'CHECKOUT-1'})});
 let env={GO_HUB:{fetch:async()=>Response.json({ok:true,paymentId:'PAY-1',quoteId:'QUOTE-1',workId:'WORK-1',status:'PAYMENT_CONFIRMED',checkoutUrl:'https://checkout.example.test/session/1'})}};
 let response=await web.fetch(request('payment-unproven'),env);
 assert.equal(response.status,502);
 assert.equal((await response.json()).code,'PAYMENT_EVIDENCE_REQUIRED');
 env={GO_HUB:{fetch:async()=>Response.json({ok:true,paymentId:'PAY-1',quoteId:'QUOTE-1',workId:'WORK-1',status:'PAYMENT_CONFIRMED',checkoutUrl:'https://checkout.example.test/session/1',ownerSource:'PAYMENT_PROVIDER',providerEventId:'EVT-1',providerReference:'REF-1'})}};
 response=await web.fetch(request('payment-proven'),env);
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.status,'PAYMENT_CONFIRMED');
 assert.equal(body.ownerSource,'PAYMENT_PROVIDER');
 assert.equal(body.providerEventId,'EVT-1');
});
test('event backlog cannot exhaust the customer brief budget',async()=>{
 const {default:web}=await load();const env={GO_HUB:{fetch:async()=>Response.json({ok:true})}};
 for(let i=0;i<21;i++)await web.fetch(new Request('https://yggmetro.com/api/v1/events',{method:'POST',headers:{'cf-connecting-ip':'test-backlog'},body:JSON.stringify({eventId:'EV-backlog-'+i,type:'PAGE_VIEW',page:'/'})}),env);
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/upsert',{method:'POST',headers:{'cf-connecting-ip':'test-backlog'},body:JSON.stringify({briefId:'BRIEF-backlog',clientId:'CLIENT-backlog',conversationId:'CONV-backlog',brief:{goal:'brief'}})}),env);assert.equal(response.status,200);
});

test('confirmed brief surfaces the canonical GO Hub Work',async()=>{
 const {default:web}=await load();let seen;
 const env={GO_HUB:{fetch:async r=>{seen={url:r.url,body:await r.json()};return Response.json({ok:true,workId:'WORK-SPECTRUM-BRIEF-4',work:{workId:'WORK-SPECTRUM-BRIEF-4',status:'OPEN'},workCreated:true});}}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({briefId:'BRIEF-4',clientId:'CLIENT-4',conversationId:'CONV-4',brief:{goal:'Company profile'}})}),env);
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(seen.url,'https://go-hub.internal/internal/brief/confirm');assert.equal(seen.body.status,'CONFIRMED');assert.equal(body.workId,'WORK-SPECTRUM-BRIEF-4');assert.equal(body.work.status,'OPEN');assert.equal(body.workCreated,true);
});


test('storefront service cards preserve entry context for SPECTRUM',async()=>{
 const {default:web}=await load();
 const response=await web.fetch(new Request('https://yggmetro.com/'),{});
 const html=await response.text();
 assert.equal(response.status,200);
 assert.match(html,/\/client\?service=presentation/);
 assert.match(html,/\/client\?service=visual/);
 assert.match(html,/\/client\?service=digital/);
 assert.match(html,/\/client\?service=lab/);
});

test('SPECTRUM client supports all storefront service families and timing stage',async()=>{
 const {default:web}=await load();
 const response=await web.fetch(new Request('https://yggmetro.com/client?service=digital'),{});
 const html=await response.text();
 assert.equal(response.status,200);
 assert.match(html,/Web Experience/);
 assert.match(html,/data-stage="timing"/);
 assert.match(html,/BRAND_VISUAL_SYSTEM/);
 assert.match(html,/TEMPLATE_ASSET/);
});

test('brief bridge forwards storefront service context without creating authority',async()=>{
 const {default:web}=await load();let seen;
 const env={GO_HUB:{fetch:async r=>{seen={url:r.url,headers:Object.fromEntries(r.headers),body:await r.json()};return Response.json({ok:true});}}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/upsert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
   briefId:'BRIEF-SVC-1',clientId:'CLIENT-SVC-1',conversationId:'CONV-SVC-1',stage:'discover',
   brief:{goal:'ทำเว็บใหม่',serviceLine:'DIGITAL',entryService:'digital',sourcePage:'/client',jobType:'WEB_EXPERIENCE'}
 })}),env);
 assert.equal(response.status,200);
 assert.equal(seen.url,'https://go-hub.internal/internal/brief/upsert');
 assert.equal(seen.headers['x-yggmetro-surface'],'SPECTRUMSALE');
 assert.equal(seen.body.brief.serviceLine,'DIGITAL');
 assert.equal(seen.body.brief.entryService,'digital');
 assert.equal(seen.body.brief.sourcePage,'/client');
 assert.equal(seen.body.brief.jobType,'WEB_EXPERIENCE');
 assert.equal(seen.body.authority,undefined);
});
