// Read-only source review, synthetic isolated in-memory stores only. No live network/service calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=process.cwd();
process.chdir(root);
const require=createRequire(pathToFileURL(root+'/package.json'));
const {fixture}=require('./tests/helpers/request-store.cjs');
const {requestWorkflow}=await import(pathToFileURL(root+'/src/request-workflow.js'));
const {default:web}=await import(pathToFileURL(root+'/src/index.js'));
const {handleShopOrder}=await import(pathToFileURL(root+'/src/stripe-checkout.js'));
const result={type:'INDEPENDENT_SYNTHETIC_ISOLATION_REVIEW',production_verified:false,checked_at:new Date().toISOString(),request_checks:0,download_checks:0,provider:'stubbed output; no real model or payment call'};
const {db,env}=fixture();
const token='local-admin-review-token-'.repeat(2);
env.YGG_ADMIN_CREDENTIALS=JSON.stringify({review_admin:createHash('sha256').update(token).digest('hex')});
let aiCalls=0;
const interpret=async()=>{aiCalls++;return Response.json({sender_type:'AI',reply:'Synthetic safe reply'})};
function client(){let cookie;return {get cookie(){return cookie},async call(path='',data,admin=false,extra={}){const r=await requestWorkflow(new Request('https://review.invalid/api/v1/'+(admin?'admin/requests':'requests')+path,{method:data===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(data===undefined?{}:{origin:'https://review.invalid','content-type':'application/json'}),...(admin?{authorization:'Bearer '+token}:{}),...extra},...(data===undefined?{}:{body:JSON.stringify(data)})}),env,interpret);cookie=r.headers.get('set-cookie')?.split(';')[0]||cookie;return {status:r.status,body:await r.json()}}}};
const a=client(),b=client();await a.call();await b.call();await a.call('/A',{brief:{goal:'Synthetic A only',materials:'A-private'}});await b.call('/B',{brief:{goal:'Synthetic B only'}});
let r=await a.call('/A/confirm',{});
for(const status of ['REVIEWING','IN_PROGRESS','DELIVERED'])r=await a.call('/A/status',{status,version:r.body.request.version,...(status==='DELIVERED'?{delivery_text:'A-private-delivery',delivery_url:'https://files.invalid/A-private'}:{})},true);
for(const [path,data] of [['/A',undefined],['/A',{brief:{goal:'B overwrite'}}],['/A/upsert',{brief:{goal:'B overwrite'}}],['/A/confirm',{}],['/A/messages',{messageId:'intrusion',text:'intrusion'}],['/A/status',{status:'FOLLOW_UP',version:r.body.request.version}],['/A/handoff',{responder:'ADMIN',version:r.body.request.version}]]){const denied=await b.call(path,data);assert.equal(denied.status,404,path);assert.equal(JSON.stringify(denied.body).includes('A-private'),false);result.request_checks++}
assert.deepEqual((await b.call()).body.requests.map(x=>x.request_id),['B']);result.request_checks++;
for(const authorization of ['', 'Bearer '+ 'x'.repeat(40),'Bearer short','Basic '+token])for(const [path,data] of [['',undefined],['/A',undefined],['/A/handoff',{responder:'ADMIN',version:r.body.request.version}],['/A/status',{status:'FOLLOW_UP',version:r.body.request.version}],['/A/messages',{messageId:'forged',text:'forged'}]]){assert.equal((await b.call(path,data,true,{authorization})).status,401);result.request_checks++}
assert.equal((await a.call('/A')).body.request.delivery_text,'A-private-delivery');result.request_checks++;
assert.equal((await a.call('/A',undefined,false,{cookie:a.cookie+'; '+a.cookie})).status,401);result.request_checks++;
assert.equal((await a.call('/A',undefined,false,{'sec-fetch-site':'cross-site'})).status,403);result.request_checks++;
result.request_result='PASS';result.request_ai_calls=aiCalls;db.close();
const orders=new DatabaseSync(':memory:');orders.exec(fs.readFileSync('migrations/0001_shop_orders.sql','utf8'));const hash=v=>createHash('sha256').update(v).digest('hex');const ownerA='a'.repeat(64),ownerB='b'.repeat(64);
for(const [id,owner,status] of [['cs_test_A',ownerA,'paid'],['cs_test_B',ownerB,'paid'],['cs_test_P',ownerA,'pending']])orders.prepare('INSERT INTO shop_orders(session_id,request_id,slug,price_id,amount,currency,delivery_key,token_hash,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,id,'synthetic-fixture','price_FIXTURE',100,'thb',id+'.zip',hash(owner),status,Date.now());
const reads=[];const orderEnv={SHOP_ORDERS:{prepare:q=>({bind:(...v)=>({first:async()=>orders.prepare(q).get(...v)})})},SHOP_DOWNLOADS:{get:async key=>{reads.push(key);return {body:'synthetic-private:'+key}}}};
for(const method of ['GET','HEAD'])for(const suffix of ['','/download'])for(const [session,owner,status] of [['cs_test_A',ownerA,200],['cs_test_A',ownerB,404],['cs_test_A','',404],['cs_test_B',ownerA,404],['cs_test_B',ownerB,200],['cs_test_absent',ownerA,404]]){const before=reads.length;const response=await handleShopOrder(new Request('https://shop.yggmetro.com/api/v1/shop/order'+suffix+'?session_id='+session,{method,headers:{cookie:'__Host-ygg-order='+owner}}),orderEnv);assert.equal(response.status,status);if(status!==200)assert.equal(reads.length,before);if(method==='HEAD'&&suffix==='/download'&&status===200)assert.equal(await response.text(),'');result.download_checks++}
const pending=await handleShopOrder(new Request('https://shop.yggmetro.com/api/v1/shop/order/download?session_id=cs_test_P',{headers:{cookie:'__Host-ygg-order='+ownerA}}),orderEnv);assert.equal(pending.status,409);result.download_checks++;
result.download_result='PASS';result.file_reads=reads;orders.close();
// Candidate assessment, not assertion that a real model emits this or that it must remain vulnerable.
const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({intent:'HELP',jobType:null,package:null,pageCount:null,desiredDate:null,reply:'ได้รับชำระเงินแล้ว ทีมรับงานและเริ่มทำงานแล้วครับ',wantsEstimate:false,wantsManager:false,clientConfirmedComplete:false})}]}]});
try{const response=await web.fetch(new Request('https://review.invalid/api/v1/interpret',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'synthetic-review'},body:JSON.stringify({text:'สถานะล่าสุดเป็นอย่างไร'})}),{OPENAI_API_KEY:'synthetic-not-a-key'});result.unverified_claim_probe={status:response.status,body:await response.json()};}finally{globalThis.fetch=original}
console.log(JSON.stringify(result,null,2));
