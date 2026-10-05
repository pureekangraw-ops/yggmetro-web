const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/office-index.js')).href+'?t='+Date.now());

test('health names the separate Office surface and GO Hub authority',async()=>{
 const {default:office}=await load();
 const response=await office.fetch(new Request('https://office-preview.example/health'),{});
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{ok:true,service:'yggmetro-office',surfaceOwner:'yggmetro-web',authorityOwner:'go-hub'});
});

test('root redirects to the Office route',async()=>{
 const {default:office}=await load();
 const response=await office.fetch(new Request('https://office-preview.example/'),{});
 assert.equal(response.status,303);
 assert.equal(response.headers.get('location'),'https://office-preview.example/office');
});

test('login error query cannot inject markup',async()=>{
 const {default:office}=await load();
 const response=await office.fetch(new Request('https://office-preview.example/office/login?error=%3Cscript%3Ealert(1)%3C/script%3E'),{});
 const html=await response.text();
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
});

test('authenticated page is rendered locally after GO Hub session check',async()=>{
 const {default:office}=await load();let seen;
 const env={GO_HUB:{fetch:async request=>{seen=request;return Response.json({ok:true,subject:'BIG'});}}};
 const response=await office.fetch(new Request('https://office.yggmetro.com/office',{headers:{cookie:'__Host-ygg-office=session-token'}}),env);
 const html=await response.text();
 assert.equal(seen.url,'https://office.yggmetro.com/office/session');
 assert.equal(seen.headers.get('cookie'),'__Host-ygg-office=session-token');
 assert.equal(response.status,200);
 assert.match(html,/DAILY SUMMARY/);
 assert.match(html,/ภาพรวมปัจจุบัน/);
 assert.match(html,/go-hub-office-surface\.js/);
});

test('unauthenticated page redirects without trusting local state',async()=>{
 const {default:office}=await load();
 const env={GO_HUB:{fetch:async()=>Response.json({ok:false},{status:401})}};
 const response=await office.fetch(new Request('https://office.yggmetro.com/office'),env);
 assert.equal(response.status,303);
 assert.equal(response.headers.get('location'),'https://office.yggmetro.com/office/login');
});

test('missing GO Hub returns an explicit authority outage',async()=>{
 const {default:office}=await load();
 const response=await office.fetch(new Request('https://office.yggmetro.com/office'),{});
 assert.equal(response.status,503);
 assert.equal((await response.json()).code,'OFFICE_AUTHORITY_UNAVAILABLE');
});

test('Office assets are served by the Office worker asset binding',async()=>{
 const {default:office}=await load();let seen;
 const env={ASSETS:{fetch:async request=>{seen=request.url;return new Response('asset-owned-by-office');}}};
 const response=await office.fetch(new Request('https://office.yggmetro.com/go-hub-office-surface.css'),env);
 assert.equal(seen,'https://office.yggmetro.com/go-hub-office-surface.css');
 assert.equal(await response.text(),'asset-owned-by-office');
});

test('Office API is proxied unchanged to GO Hub',async()=>{
 const {default:office}=await load();let seen;
 const env={GO_HUB:{fetch:async request=>{seen={url:request.url,method:request.method,cookie:request.headers.get('cookie'),body:await request.text()};return Response.json({ok:true,ownerSource:'CENTRE'});}}};
 const request=new Request('https://office.yggmetro.com/office/api/work',{method:'POST',headers:{cookie:'__Host-ygg-office=session-token','content-type':'application/json'},body:'{"workId":"WORK-1"}'});
 const response=await office.fetch(request,env);
 assert.deepEqual(seen,{url:'https://office.yggmetro.com/office/api/work',method:'POST',cookie:'__Host-ygg-office=session-token',body:'{"workId":"WORK-1"}'});
 assert.equal((await response.json()).ownerSource,'CENTRE');
});

test('login and passkey proxy preserves redirect and session cookie headers',async()=>{
 const {default:office}=await load();
 const env={GO_HUB:{fetch:async()=>new Response(null,{status:303,headers:{location:'https://office.yggmetro.com/office','set-cookie':'__Host-ygg-office=signed; Path=/; HttpOnly; Secure; SameSite=Strict'}})}};
 const response=await office.fetch(new Request('https://office.yggmetro.com/office/login',{method:'POST',body:new URLSearchParams({passcode:'test'})}),env);
 assert.equal(response.status,303);
 assert.equal(response.headers.get('location'),'https://office.yggmetro.com/office');
 assert.match(response.headers.get('set-cookie'),/^__Host-ygg-office=signed;/);
});

test('payment status is relayed without local confirmation or reinterpretation',async()=>{
 const {default:office}=await load();
 const payload={status:'PAYMENT_PENDING',authority:'GO_REVIEW_REQUIRED',providerReference:'REF-1'};
 const env={GO_HUB:{fetch:async()=>Response.json(payload,{status:202})}};
 const response=await office.fetch(new Request('https://office.yggmetro.com/office/api/payments'),env);
 assert.equal(response.status,202);
 assert.deepEqual(await response.json(),payload);
});
