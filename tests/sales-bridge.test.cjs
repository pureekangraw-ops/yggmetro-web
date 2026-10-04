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
