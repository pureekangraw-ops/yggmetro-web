const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/index.js')).href);
const payload={version:'1',briefId:'BRIEF-test',clientId:'CLIENT-test',conversationId:'CONV-test',brief:{goal:'Draft profile'}};
const req=(extra={})=>new Request('https://yggmetro.com/api/v1/brief/upsert',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':crypto.randomUUID(),...extra},body:JSON.stringify(payload)});
test('PANTHEON routing fails closed without session key instead of falling back to GO Hub',async()=>{
 const {default:web}=await load();let calls=0;const r=await web.fetch(req(),{BRIEF_REGISTRY_BACKEND:'pantheon',GO_HUB:{fetch(){calls++;throw Error('must not fallback')}}});
 assert.equal(r.status,503);assert.equal(calls,0);
});
test('trusted session principal reaches only named RPC and never leaks key to customer',async()=>{
 const {default:web}=await load();let seen;const env={BRIEF_REGISTRY_BACKEND:'pantheon',BRIEF_SESSION_KEY:'unit-test-key-'.repeat(4),
 PANTHEON:{async storefrontCall(args){seen=args;return {ok:true,status:200,body:{ok:true,brief:{status:'DRAFT'}}}}}};
 const r=await web.fetch(req(),env);assert.equal(r.status,200);assert.equal(seen.operation,'brief_upsert');assert.match(seen.principal,/^[a-f0-9]{64}$/);
 const cookie=r.headers.get('set-cookie');assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/);assert.doesNotMatch(cookie,new RegExp(env.BRIEF_SESSION_KEY));
 const repeated=await web.fetch(req({cookie:cookie.split(';')[0]}),env);assert.equal(repeated.status,200);assert.equal(repeated.headers.get('set-cookie'),null);
});
test('forged cookies and cross-site origins do not reach receiver',async()=>{
 const {default:web}=await load();let calls=0;const env={BRIEF_REGISTRY_BACKEND:'pantheon',BRIEF_SESSION_KEY:'unit-test-key-'.repeat(4),PANTHEON:{storefrontCall(){calls++}}};
 for(const headers of [{cookie:'__Host-ygg-brief-session=forged'},{origin:'https://evil.invalid'},{'sec-fetch-site':'cross-site'}]){
  const r=await web.fetch(req(headers),env);assert.equal(r.status,403);
 }assert.equal(calls,0);
});
test('write failure never retries against legacy service',async()=>{
 const {default:web}=await load();let legacy=0;const env={BRIEF_REGISTRY_BACKEND:'pantheon',BRIEF_SESSION_KEY:'unit-test-key-'.repeat(4),
  PANTHEON:{storefrontCall(){throw Error('network uncertain')}},GO_HUB:{fetch(){legacy++}}};
 assert.equal((await web.fetch(req(),env)).status,502);assert.equal(legacy,0);
});
test('public homepage and inference configuration remain available without session secret',async()=>{
 const {default:web}=await load();const r=await web.fetch(new Request('https://yggmetro.com/'),{BRIEF_REGISTRY_BACKEND:'pantheon'});
 assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);
});
