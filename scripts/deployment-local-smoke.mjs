import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:readFileSync(process.env.WORKER_BUNDLE||'.wrangler/deploy-fix/index.js','utf8'),compatibilityDate:'2026-10-01'}));
const origin='https://yggmetro.com';
try {
const checks=[];
for(const path of ['/','/shop','/client','/health']){
 const response=await mf.dispatchFetch(origin+path);
 assert.equal(response.status,200,path);checks.push({path,status:response.status});
}
for(const [path,body] of [
 ['/api/v1/brief/upsert',{briefId:'B-local',clientId:'C-local',conversationId:'V-local',brief:{goal:'test'}}],
 ['/api/v1/brief/confirm',{briefId:'B-local',clientId:'C-local',conversationId:'V-local',brief:{goal:'test'}}],
 ['/api/v1/events',{eventId:'E-local',type:'PAGE_VIEW',page:'/'}],
 ['/api/v1/payment/checkout',{customerId:'C-local',quoteId:'Q-local',workId:'W-local',idempotencyKey:'I-local'}],
 ['/api/v1/shop/checkout',{slug:'finance-simulator',email:'buyer@example.test',requestId:'a'.repeat(64)}],
 ['/api/v1/stripe/webhook',{}],
]){
 const response=await mf.dispatchFetch((path.includes('/shop/')||path.includes('/stripe/')?'https://shop.yggmetro.com':origin)+path,{method:'POST',headers:{'content-type':'application/json',...(path.includes('/shop/')||path.includes('/stripe/')?{host:'shop.yggmetro.com',origin:'https://shop.yggmetro.com'}:{})},body:JSON.stringify(body)});
 assert.equal(response.status,503,path);const result=await response.json();assert.equal(result.ok,false,path);checks.push({path,status:response.status,code:result.code});
}
console.log(JSON.stringify({type:'LOCAL_WORKERD_NO_SECRETS_SMOKE',production_verified:false,checks},null,2));

} finally {await mf.dispose()}
