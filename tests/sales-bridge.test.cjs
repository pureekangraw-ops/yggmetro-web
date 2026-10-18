const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/index.js')).href);
test('sales events fail closed while PANTHEON does not provide an event endpoint',async()=>{
 const {default:web}=await load();let called=false;
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({eventId:'EV-1',type:'PAGE_VIEW',page:'/?secret=remove',source:'direct'})}),{PANTHEON:{fetch:async()=>{called=true;return Response.json({ok:true});}}});
 assert.equal(response.status,503);assert.equal((await response.json()).code,'PANTHEON_OPERATION_UNSUPPORTED');assert.equal(called,false);
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

test('payment checkout fails closed instead of sending an unsupported PANTHEON request',async()=>{
 const {default:web}=await load();let called=false;
 const env={PANTHEON:{fetch:async()=>{called=true;return Response.json({ok:true})}},PANTHEON_TOKEN:'x'.repeat(40)};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/payment/checkout',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'payment-forward'},body:JSON.stringify({
   customerId:'CLIENT-1',quoteId:'QUOTE-1',workId:'WORK-1',idempotencyKey:'CHECKOUT-1'
 })}),env);
 assert.equal(response.status,503);assert.equal((await response.json()).code,'PANTHEON_OPERATION_UNSUPPORTED');assert.equal(called,false);
});

test('checkout request rejects customer payment truth and card-like data before transport',async()=>{
 const {default:web}=await load();let called=false;
 const env={PANTHEON:{fetch:async()=>{called=true;return Response.json({ok:true})}},PANTHEON_TOKEN:'x'.repeat(40)};
 for(const [ip,extra] of [['payment-status',{status:'PAYMENT_CONFIRMED'}],['payment-card',{cardNumber:'4111111111111111'}],['payment-amount',{amount:5000,currency:'THB'}]]){
   const response=await web.fetch(new Request('https://yggmetro.com/api/v1/payment/checkout',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip},body:JSON.stringify({customerId:'CLIENT-1',quoteId:'QUOTE-1',workId:'WORK-1',idempotencyKey:'CHECKOUT-1',...extra})}),env);
   assert.equal(response.status,400,ip);
 }
 assert.equal(called,false);
});

test('draft briefs stay local and are not falsely reported as saved in PANTHEON',async()=>{
 const {default:web}=await load();let called=false;
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/upsert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({briefId:'BRIEF-DRAFT',clientId:'CLIENT-1',conversationId:'CONV-1',brief:{goal:'ทำเว็บใหม่'}})}),{PANTHEON:{fetch:async()=>{called=true;return Response.json({ok:true})}},PANTHEON_TOKEN:'x'.repeat(40)});
 assert.equal(response.status,503);assert.equal((await response.json()).code,'PANTHEON_OPERATION_UNSUPPORTED');assert.equal(called,false);
});

test('confirmed brief creates a queued PANTHEON task without Factory dispatch',async()=>{
 const {default:web}=await load();let seen;const intents=[];
 const taskId='task_'+'a'.repeat(32);
 const env={PANTHEON_TOKEN:'t'.repeat(40),PANTHEON:{fetch:async r=>{const body=await r.json();intents.push(body.intent);seen={url:r.url,headers:Object.fromEntries(r.headers),body};return body.intent==='LIST_TASKS'?Response.json({tasks:[]}):Response.json({task_id:taskId,status:'QUEUED',executed:false},{status:201});}}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({briefId:'BRIEF-4',clientId:'CLIENT-4',conversationId:'CONV-4',brief:{goal:'Company profile',serviceLine:'PRESENTATION',audience:'Investors'}})}),env);
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(seen.url,'https://phatheon-workhub.internal/v1/intent');
 assert.equal(seen.headers.authorization,'Bearer '+'t'.repeat(40));assert.deepEqual(seen.body.intent,'CREATE_TASK');
 assert.deepEqual(intents,['LIST_TASKS','CREATE_TASK']);
 assert.match(seen.body.request,/Brief ID: BRIEF-4/);assert.match(seen.body.request,/Goal: Company profile/);assert.match(seen.body.request,/Human review is required/);
 assert.equal(body.workId,taskId);assert.equal(body.work.status,'QUEUED');assert.equal(body.workCreated,true);
 assert.equal(body.office.task.executed,false);
});

test('retrying a confirmed brief reuses its existing PANTHEON task',async()=>{
 const {default:web}=await load();let calls=0;
 const taskId='task_'+'c'.repeat(32);
 const env={PANTHEON_TOKEN:'t'.repeat(40),PANTHEON:{fetch:async r=>{calls++;const body=await r.json();assert.equal(body.intent,'LIST_TASKS');return Response.json({tasks:[{task_id:taskId,status:'QUEUED',request_text:'YGG METRO confirmed project intake.\nBrief ID: BRIEF-RETRY\nGoal: Existing job'}]});}}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({briefId:'BRIEF-RETRY',clientId:'CLIENT-6',conversationId:'CONV-6',brief:{goal:'Existing job'}})}),env);
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(calls,1);assert.equal(body.workId,taskId);assert.equal(body.workCreated,false);
});

test('confirmed brief requires PANTHEON auth and never creates a task without it',async()=>{
 const {default:web}=await load();let called=false;
 const env={PANTHEON:{fetch:async()=>{called=true;return Response.json({task_id:'task_'+'b'.repeat(32),status:'QUEUED',executed:false},{status:201});}}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({briefId:'BRIEF-5',clientId:'CLIENT-5',conversationId:'CONV-5',brief:{goal:'Company profile'}})}),env);
 assert.equal(response.status,503);assert.equal((await response.json()).code,'PANTHEON_AUTH_NOT_CONFIGURED');assert.equal(called,false);
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

test('draft brief does not call PANTHEON because it has no draft-upsert contract',async()=>{
 const {default:web}=await load();let called=false;
 const env={PANTHEON_TOKEN:'t'.repeat(40),PANTHEON:{fetch:async()=>{called=true;return Response.json({ok:true});}}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/upsert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
   briefId:'BRIEF-SVC-1',clientId:'CLIENT-SVC-1',conversationId:'CONV-SVC-1',stage:'discover',
   brief:{goal:'ทำเว็บใหม่',serviceLine:'DIGITAL',entryService:'digital',sourcePage:'/client',jobType:'WEB_EXPERIENCE'}
 })}),env);
 assert.equal(response.status,503);assert.equal((await response.json()).code,'PANTHEON_OPERATION_UNSUPPORTED');assert.equal(called,false);
});
