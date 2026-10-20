const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/index.js')).href);
test('sales events fail closed while PANTHEON does not provide an event endpoint',async()=>{
 const {default:web}=await load();let called=false;
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({eventId:'EV-1',type:'PAGE_VIEW',page:'/?secret=remove',source:'direct'})}),{PANTHEON:{ownerCall:async()=>{called=true;return {ok:true,result:{}};}}});
 assert.equal(response.status,503);assert.equal((await response.json()).code,'PANTHEON_OPERATION_UNSUPPORTED');assert.equal(called,false);
});
test('unavailable event transport does not claim saved',async()=>{
 const {default:web}=await load();const response=await web.fetch(new Request('https://yggmetro.com/api/v1/events',{method:'POST',body:JSON.stringify({eventId:'EV-2',type:'PAGE_VIEW',page:'/'})}),{});assert.equal(response.status,503);
});
test('public event intake rejects payment claims',async()=>{
 const {default:web}=await load();const response=await web.fetch(new Request('https://yggmetro.com/api/v1/events',{method:'POST',body:JSON.stringify({eventId:'EV-3',type:'PAYMENT_CONFIRMED',page:'/'})}),{});assert.equal(response.status,400);
});

test('payment checkout fails closed instead of sending an unsupported PANTHEON request',async()=>{
 const {default:web}=await load();let called=false;
 const env={PANTHEON:{ownerCall:async()=>{called=true;return {ok:true,result:{}}}}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/payment/checkout',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'payment-forward'},body:JSON.stringify({
   customerId:'CLIENT-1',quoteId:'QUOTE-1',workId:'WORK-1',idempotencyKey:'CHECKOUT-1'
 })}),env);
 assert.equal(response.status,503);assert.equal((await response.json()).code,'PANTHEON_OPERATION_UNSUPPORTED');assert.equal(called,false);
});

test('checkout request rejects customer payment truth and card-like data before transport',async()=>{
 const {default:web}=await load();let called=false;
 const env={PANTHEON:{ownerCall:async()=>{called=true;return {ok:true,result:{}}}}};
 for(const [ip,extra] of [['payment-status',{status:'PAYMENT_CONFIRMED'}],['payment-card',{cardNumber:'4111111111111111'}],['payment-amount',{amount:5000,currency:'THB'}]]){
   const response=await web.fetch(new Request('https://yggmetro.com/api/v1/payment/checkout',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip},body:JSON.stringify({customerId:'CLIENT-1',quoteId:'QUOTE-1',workId:'WORK-1',idempotencyKey:'CHECKOUT-1',...extra})}),env);
   assert.equal(response.status,400,ip);
 }
 assert.equal(called,false);
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


test('legacy brief routes persist authenticated drafts and confirm without owner RPC or Factory',async()=>{
 const {fixture}=require('./helpers/request-store.cjs');const f=fixture();const {default:web}=await load();let ownerCalls=0;f.env.PANTHEON={ownerCall(){ownerCalls++;throw Error('not a customer capability')}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/requests'),f.env);const cookie=response.headers.get('set-cookie').split(';')[0];
 const call=(operation)=>web.fetch(new Request('https://yggmetro.com/api/v1/brief/'+operation,{method:'POST',headers:{cookie,origin:'https://yggmetro.com','content-type':'application/json'},body:JSON.stringify({briefId:'BRIEF-legacy',clientId:'CLIENT-legacy',conversationId:'CONV-legacy',brief:{goal:'ทำเว็บ'}})}),f.env);
 assert.equal((await call('upsert')).status,200);const first=await (await call('confirm')).json();const second=await (await call('confirm')).json();assert.equal(first.workCreated,true);assert.equal(second.workCreated,false);assert.equal(first.workId,second.workId);assert.equal(ownerCalls,0);f.db.close();
});
