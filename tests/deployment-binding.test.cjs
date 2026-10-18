const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
test('deploy config has no retired GO Hub or unverified owner capability binding',()=>{
 assert.equal(config.name,'yggmetro-web');
 assert.equal(config.main,'src/index.js');
 assert.deepEqual(config.services,[]);
 assert.equal(config.assets.binding,'ASSETS');
 assert.equal(config.assets.run_worker_first,true);
});
test('missing retired registry fails closed for every dependent operation without owner calls',async()=>{
 const {default:web}=await import('../src/index.js');let calls=0;
 const env={PANTHEON:{ownerCall:async()=>{calls++;throw Error('must not grant customer owner capability')}},ASSETS:{fetch:async()=>new Response('asset')}};
 const requests=[
 ['/api/v1/brief/upsert',{briefId:'BRIEF-deploy',clientId:'CLIENT-deploy',conversationId:'CONV-deploy',brief:{goal:'test'}}],
 ['/api/v1/brief/confirm',{briefId:'BRIEF-deploy',clientId:'CLIENT-deploy',conversationId:'CONV-deploy',brief:{goal:'test'}}],
 ['/api/v1/events',{eventId:'EV-deploy',type:'PAGE_VIEW',page:'/'}],
 ['/api/v1/payment/checkout',{customerId:'CLIENT-deploy',quoteId:'QUOTE-deploy',workId:'WORK-deploy',idempotencyKey:'KEY-deploy'}],
 ];
 for(const [route,body] of requests){const response=await web.fetch(new Request('https://yggmetro.com'+route,{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':route},body:JSON.stringify(body)}),env);assert.equal(response.status,503,route);assert.equal((await response.json()).code,'BRIEF_BRIDGE_NOT_CONFIGURED',route)}
 assert.equal(calls,0);
 assert.equal((await web.fetch(new Request('https://yggmetro.com/'),env)).status,200);
});
