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

test('draft briefs stay local and are not falsely reported as saved in PANTHEON',async()=>{
 const {default:web}=await load();let called=false;
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/upsert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({briefId:'BRIEF-DRAFT',clientId:'CLIENT-1',conversationId:'CONV-1',brief:{goal:'ทำเว็บใหม่'}})}),{PANTHEON:{ownerCall:async()=>{called=true;return {ok:true,result:{}}}}});
 assert.equal(response.status,503);assert.equal((await response.json()).code,'PANTHEON_OPERATION_UNSUPPORTED');assert.equal(called,false);
});

test('confirmed brief creates a queued PANTHEON task without Factory dispatch',async()=>{
 const {default:web}=await load();let seen;const calls=[];
 const taskId='task_'+'a'.repeat(32);
 const env={PANTHEON:{ownerCall:async args=>{calls.push(args);seen=args;return args.payload.intent==='LIST_TASKS'?{ok:true,upstream_status:200,result:{tasks:[]}}:{ok:true,upstream_status:201,result:{task_id:taskId,status:'QUEUED',executed:false}};}}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({briefId:'BRIEF-4',clientId:'CLIENT-4',conversationId:'CONV-4',brief:{goal:'Company profile',serviceLine:'PRESENTATION',audience:'Investors'}})}),env);
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(seen.operation,'intent');
 assert.deepEqual(seen.payload.intent,'CREATE_TASK');assert.deepEqual(calls.map(call=>call.payload.intent),['LIST_TASKS','CREATE_TASK']);
 assert.match(seen.payload.request,/Brief ID: BRIEF-4/);assert.match(seen.payload.request,/Goal: Company profile/);assert.match(seen.payload.request,/Human review is required/);
 assert.equal(body.workId,taskId);assert.equal(body.work.status,'QUEUED');assert.equal(body.workCreated,true);
 assert.equal(body.office.task.executed,false);
 assert.equal(env.PANTHEON_TOKEN,undefined);
});

test('retrying a confirmed brief reuses its existing PANTHEON task',async()=>{
 const {default:web}=await load();let calls=0;
 const taskId='task_'+'c'.repeat(32);
 const env={PANTHEON:{ownerCall:async args=>{calls++;assert.equal(args.operation,'intent');assert.equal(args.payload.intent,'LIST_TASKS');return {ok:true,upstream_status:200,result:{tasks:[{task_id:taskId,status:'QUEUED',request_text:'YGG METRO confirmed project intake.\nBrief ID: BRIEF-RETRY\nGoal: Existing job'}]}};}}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({briefId:'BRIEF-RETRY',clientId:'CLIENT-6',conversationId:'CONV-6',brief:{goal:'Existing job'}})}),env);
 const body=await response.json();
 assert.equal(response.status,200);assert.equal(calls,1);assert.equal(body.workId,taskId);assert.equal(body.workCreated,false);
});

test('confirmed brief fails closed when PANTHEON OwnerBridge RPC is unavailable',async()=>{
 const {default:web}=await load();let called=false;
 const env={PANTHEON:{ownerCall:async()=>{called=true;throw new Error('RPC unavailable')}}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({briefId:'BRIEF-5',clientId:'CLIENT-5',conversationId:'CONV-5',brief:{goal:'Company profile'}})}),env);
 assert.equal(response.status,502);assert.equal((await response.json()).code,'PANTHEON_LOOKUP_REJECTED');assert.equal(called,true);
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
 const env={PANTHEON:{ownerCall:async()=>{called=true;return {ok:true,result:{}};}}};
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/brief/upsert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
   briefId:'BRIEF-SVC-1',clientId:'CLIENT-SVC-1',conversationId:'CONV-SVC-1',stage:'discover',
   brief:{goal:'ทำเว็บใหม่',serviceLine:'DIGITAL',entryService:'digital',sourcePage:'/client',jobType:'WEB_EXPERIENCE'}
 })}),env);
 assert.equal(response.status,503);assert.equal((await response.json()).code,'PANTHEON_OPERATION_UNSUPPORTED');assert.equal(called,false);
});
