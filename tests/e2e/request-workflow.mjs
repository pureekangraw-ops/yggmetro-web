import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import https from 'node:https';
import {createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {chromium} from 'playwright';
// Real local workerd + D1 + browser UI; AI provider output/credentials are explicit fixtures.
const token='local-admin-identity-fixture-'.repeat(2);
let modelCalls=0,releaseModel,modelStarted;const modelWaiting=new Promise(resolve=>modelStarted=resolve);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:await fs.readFile('.wrangler/identity-e2e/bundle/index.js','utf8'),compatibilityDate:'2026-10-01',d1Databases:{REQUESTS_DB:'identity-local-db'},bindings:{OPENAI_API_KEY:'local-fixture-not-a-key',YGG_ADMIN_CREDENTIALS:JSON.stringify({big:createHash('sha256').update(token).digest('hex')})},outboundService:async request=>{
 modelCalls++;const input=await request.json();const text=input.input?.filter(v=>v.role==='user').at(-1)?.content;
 if(text==='AI_WAIT'){modelStarted();await new Promise(resolve=>releaseModel=resolve)}
 if(text==='AI_DOWN')return Response.json({error:'fixture outage'},{status:503});
 const result={intent:'HELP',jobType:null,package:null,pageCount:null,desiredDate:null,reply:'ช่วยจัดรายละเอียดคำขอได้ครับ',wantsEstimate:false,wantsManager:false,clientConfirmedComplete:false};
 return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});
}}));
let server,browser;
const errors=[];
try{
 const db=await mf.getD1Database('REQUESTS_DB');await db.exec((await fs.readFile('migrations/0002_request_workflow.sql','utf8')).replace(/^--.*$/gm,'').replace(/\n/g,' '));
 const tls={key:await fs.readFile('.wrangler/identity-e2e/key.pem'),cert:await fs.readFile('.wrangler/identity-e2e/cert.pem')};
 server=https.createServer(tls,async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const headers=new Headers(req.headers);if(headers.get('origin')===origin)headers.set('origin','https://yggmetro.com');
 const response=await mf.dispatchFetch('https://yggmetro.com'+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch(e){res.writeHead(500);res.end('local harness error: '+e.message)}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='https://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
 const customer=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}}),admin=await browser.newContext({ignoreHTTPSErrors:true}),other=await browser.newContext({ignoreHTTPSErrors:true});
 const page=await customer.newPage(),office=await admin.newPage();page.on('pageerror',e=>errors.push(e.message));office.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/client');await page.getByRole('status').filter({hasText:'เริ่มร่างใหม่แล้ว'}).waitFor();
 await page.locator('#goal').fill('ออกแบบเว็บแนะนำบริษัท');await page.locator('#materials').fill('เนื้อหาฉบับลูกค้า A');await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await page.getByRole('status').filter({hasText:'บันทึกร่างแล้ว'}).waitFor();
 const requestId=await page.locator('#requests').inputValue();await page.reload();await page.getByRole('status').filter({hasText:'โหลดคำขอของคุณแล้ว'}).waitFor();assert.equal(await page.locator('#goal').inputValue(),'ออกแบบเว็บแนะนำบริษัท');
 console.log('draft reload passed');
 // Regression: late poll for A cannot switch selection or overwrite dirty B.
 await page.getByRole('button',{name:'เริ่มคำขอใหม่',exact:true}).click();await page.getByRole('status').filter({hasText:'เริ่มร่างใหม่แล้ว'}).waitFor();const secondId=await page.locator('#requests').inputValue();await page.locator('#goal').fill('ร่าง B');await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await page.getByRole('status').filter({hasText:'บันทึกร่างแล้ว'}).waitFor();
 await page.locator('#requests').selectOption(requestId);await page.waitForFunction(id=>document.querySelector('#request-id').textContent.includes(id),requestId);
 let releasePoll,pollReady;const polled=new Promise(resolve=>pollReady=resolve);let delayed=false;
 await page.route('**/api/v1/requests/'+requestId,async route=>{if(delayed||route.request().method()!=='GET')return route.continue();delayed=true;const response=await route.fetch();pollReady();await new Promise(resolve=>releasePoll=resolve);await route.fulfill({response})});
 await page.bringToFront();await Promise.race([polled,new Promise((_,reject)=>setTimeout(()=>reject(Error('poll not started')),12000))]);await page.locator('#requests').selectOption(secondId);await page.waitForFunction(id=>document.querySelector('#request-id').textContent.includes(id),secondId);await page.locator('#goal').fill('แก้เฉพาะร่าง B');releasePoll();await page.waitForTimeout(300);assert.equal(await page.locator('#requests').inputValue(),secondId);await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await page.getByRole('status').filter({hasText:'บันทึกร่างแล้ว'}).waitFor();
 await page.unroute('**/api/v1/requests/'+requestId);await page.locator('#requests').selectOption(requestId);await page.waitForFunction(id=>document.querySelector('#request-id').textContent.includes(id),requestId);assert.equal(await page.locator('#goal').inputValue(),'ออกแบบเว็บแนะนำบริษัท');
 console.log('poll race passed');
 await page.locator('#text').fill('สวัสดี');await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click();await page.locator('#messages strong').filter({hasText:'AI - GO'}).waitFor();
 await page.locator('#text').fill('AI_DOWN');await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click();await page.getByText('AI - GO ไม่พร้อมตอบชั่วคราว คุณยังบันทึกและส่งคำขอได้',{exact:true}).waitFor();
 await page.locator('#text').fill('AI_WAIT');await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click();await Promise.race([modelWaiting,new Promise((_,reject)=>setTimeout(()=>reject(Error('AI fixture not invoked')),12000))]);
 await page.getByRole('button',{name:'ส่งคำขอ',exact:true}).click();await page.locator('#status').filter({hasText:'ศูนย์รับงาน'}).waitFor();
 releaseModel();await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).waitFor();
 console.log('AI pending submit passed');
 const replay=await page.evaluate(async id=>{const r=await fetch('/api/v1/requests/'+id+'/confirm',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});return {status:r.status,body:await r.json()}},requestId);assert.equal(replay.status,200);assert.equal(replay.body.workCreated,false);
 const concurrent=await page.evaluate(async()=>{const id='BRIEF-race-'+crypto.randomUUID();const headers={'content-type':'application/json'};await fetch('/api/v1/requests/'+id,{method:'POST',headers,body:JSON.stringify({brief:{goal:'concurrent confirm'}})});return Promise.all([1,2].map(async()=>{const r=await fetch('/api/v1/requests/'+id+'/confirm',{method:'POST',headers,body:'{}'});return {status:r.status,body:await r.json()}}))});assert.ok(concurrent.every(r=>r.status===200));assert.equal(concurrent.filter(r=>r.body.workCreated).length,1);
 const attacker=await other.newPage();await attacker.goto(origin+'/client');await attacker.getByRole('status').filter({hasText:'เริ่มร่างใหม่แล้ว'}).waitFor();const isolation=await attacker.evaluate(async id=>{const r=await fetch('/api/v1/requests/'+id);return {status:r.status,body:await r.json()}},requestId);assert.equal(isolation.status,404);
 const spoof=await page.evaluate(async id=>{const r=await fetch('/api/v1/requests/'+id+'/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messageId:'spoof',text:'forged',sender_type:'ADMIN'})});return r.status},requestId);assert.equal(spoof,400);
 console.log('isolation passed');
 await office.goto(origin+'/admin/requests');await office.locator('#token').fill(token);await office.getByRole('button',{name:'เข้าสู่ศูนย์รับงาน',exact:true}).click();await office.getByRole('status').filter({hasText:'เข้าสู่ศูนย์รับงานแล้ว'}).waitFor();await office.locator('#requests').selectOption(requestId);await office.locator('#goal').waitFor();await office.waitForFunction(()=>document.querySelector('#materials').value==='เนื้อหาฉบับลูกค้า A');
 await office.getByRole('button',{name:'Admin รับช่วง',exact:true}).click();await office.getByRole('status').filter({hasText:'เปลี่ยนผู้ดูแลแล้ว'}).waitFor();await page.getByText('Admin เข้ามารับช่วงการสนทนาแล้ว',{exact:true}).waitFor({timeout:10000});
 await office.locator('#text').fill('ตรวจรายละเอียดแล้ว จะเริ่มตรวจสอบคำขอนี้ครับ');await office.getByRole('button',{name:'ส่งข้อความ',exact:true}).click();await page.getByText('ตรวจรายละเอียดแล้ว จะเริ่มตรวจสอบคำขอนี้ครับ',{exact:true}).waitFor({timeout:10000});assert.equal(await page.locator('.message').filter({hasText:'ตรวจรายละเอียดแล้ว จะเริ่มตรวจสอบคำขอนี้ครับ'}).locator('strong').textContent(),'Admin');
 const before=modelCalls;await page.locator('#text').fill('ขอบคุณครับ');await page.getByRole('button',{name:'ส่งข้อความ',exact:true}).click();await page.getByRole('status').filter({hasText:'บันทึกข้อความแล้ว'}).waitFor();assert.equal(modelCalls,before);
 // Refresh Admin version after the customer's message before another CAS mutation.
 await office.reload();await office.locator('#token').fill(token);await office.getByRole('button',{name:'เข้าสู่ศูนย์รับงาน',exact:true}).click();await office.getByRole('status').filter({hasText:'เข้าสู่ศูนย์รับงานแล้ว'}).waitFor();await office.locator('#requests').selectOption(requestId);await office.waitForFunction(id=>document.querySelector('#request-id').textContent.includes(id),requestId);
 await office.getByRole('button',{name:'ให้ AI - GO กลับมาดูแล',exact:true}).click();await page.getByText('AI - GO กลับมาดูแลการสนทนาแล้ว',{exact:true}).waitFor({timeout:10000});
 for(const status of ['REVIEWING','IN_PROGRESS']){await office.locator('#next-status').selectOption(status);await office.getByRole('button',{name:'บันทึกสถานะ',exact:true}).click();await office.getByRole('status').filter({hasText:'บันทึกสถานะแล้ว'}).waitFor();await office.waitForFunction(s=>document.querySelector('#status').textContent===s,status==='REVIEWING'?'กำลังตรวจสอบ':'กำลังดำเนินงาน')}
 await office.locator('#next-status').selectOption('DELIVERED');await office.locator('#delivery-text').fill('ผลงานส่งมอบ: โครงหน้าเว็บประกอบด้วยหน้าแรก บริการ และช่องทางติดต่อ');await office.getByRole('button',{name:'บันทึกสถานะ',exact:true}).click();await page.locator('#status').filter({hasText:'ส่งมอบงาน'}).waitFor({timeout:10000});await page.getByText('ผลงานส่งมอบ: โครงหน้าเว็บประกอบด้วยหน้าแรก บริการ และช่องทางติดต่อ',{exact:true}).waitFor();
 console.log('handoff and delivery passed');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 const row=await db.prepare('SELECT * FROM ygg_requests WHERE request_id=?').bind(requestId).first();assert.equal(row.status,'DELIVERED');assert.equal(row.delivery_sha256,createHash('sha256').update(row.delivery_text).digest('hex'));
 const events=await db.prepare('SELECT * FROM ygg_request_events WHERE request_id=?').bind(requestId).all();assert.equal(events.results.filter(e=>e.kind==='STATUS'&&e.to_value==='SUBMITTED').length,1);assert.equal(events.results.filter(e=>e.kind==='HANDOFF').length,2);
 await fs.mkdir('docs/identity-workflow-20261019',{recursive:true});await page.screenshot({path:'.wrangler/identity-e2e/customer.png',fullPage:true});await office.screenshot({path:'.wrangler/identity-e2e/admin.png',fullPage:true});
 const result={type:'LOCAL_WORKERD_D1_BROWSER_E2E',production_verified:false,ai_provider:'explicit output/outage fixture, not actual model inference',checks:['draft save/reload','late poll cannot overwrite another draft','submission while AI inference pending','AI - GO label from server','System outage label','submit despite AI outage','duplicate and concurrent confirm readback','foreign customer 404','sender spoof rejected','Admin authenticated read/takeover/reply','AI suppressed while Admin owns conversation','resume notice and audit','status transitions','actual text artifact/hash customer readback','390px viewport and no JS errors'],request_id:requestId,model_fixture_calls:modelCalls,status_events:events.results.filter(e=>e.kind==='STATUS').length};
 await fs.writeFile('docs/identity-workflow-20261019/browser-workerd-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{releaseModel?.();await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await mf.dispose()}
