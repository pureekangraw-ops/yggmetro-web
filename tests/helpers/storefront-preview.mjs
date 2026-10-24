import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import web from '../../src/index.js';
const base=path.resolve('public');
// Local test fixture: no real Stripe credentials or paid download files.
const item={enabled:true,priceId:'price_LOCAL',amount:900,currency:'usd',deliveryKey:'private/shop-home.zip'};
const env={STRIPE_TEST_CHECKOUT_ENABLED:'true',STRIPE_TEST_KEY:'rk_test_local_fixture',STRIPE_TEST_WEBHOOK_SECRET:'whsec_local_fixture',STRIPE_TEST_CATALOG:JSON.stringify({'finance-simulator':item}),SHOP_ORDERS:{prepare(){}},SHOP_DOWNLOADS:{get(){},head(){}},ASSETS:{async fetch(request){
 try{const file=path.resolve(base,'.'+new URL(request.url).pathname);if(!file.startsWith(base+path.sep))return new Response('Not Found',{status:404});const type=file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'image/jpeg';return new Response(await fs.readFile(file),{headers:{'content-type':type}})}catch{return new Response('Not Found',{status:404})}
}}};
export function startPreview(){return new Promise(resolve=>{const server=http.createServer(async(req,res)=>{try{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const request=new Request('https://shop.yggmetro.com'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
 const result=await web.fetch(request,env);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch(error){res.writeHead(500);res.end(String(error))}});server.listen(0,'127.0.0.1',()=>resolve({server,origin:'http://127.0.0.1:'+server.address().port}));})}
