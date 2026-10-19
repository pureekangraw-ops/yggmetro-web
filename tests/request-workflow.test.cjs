const test=require('node:test'),assert=require('node:assert/strict');const {fixture}=require('./helpers/request-store.cjs');const {createHash}=require('node:crypto');
async function setup(){const {requestWorkflow}=await import('../src/request-workflow.js');const f=fixture();let aiCalls=0;
 const interpret=async()=>{aiCalls++;return Response.json({sender_type:'AI',reply:'มีข้อมูลเพิ่มเติมส่วนไหนไหมครับ?'})};
 f.env.YGG_ADMIN_CREDENTIALS=JSON.stringify({big:createHash('sha256').update('local-admin-token-'.repeat(3)).digest('hex')});
 const client=(token=null)=>{let cookie=token;return {get cookie(){return cookie},async call(path='',body,admin=false,override={}){
 const response=await requestWorkflow(new Request('https://yggmetro.com/api/v1/'+(admin?'admin/requests':'requests')+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json',origin:'https://yggmetro.com'}),...(admin?{authorization:'Bearer '+'local-admin-token-'.repeat(3)}:{}),...override},...(body===undefined?{}:{body:JSON.stringify(body)})}),f.env,interpret);
 if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}}};
 return {...f,client,get aiCalls(){return aiCalls}};
}
async function draft(c,id='BRIEF-1'){await c.call();return c.call('/'+id,{brief:{goal:'ทำเว็บ',materials:'ไฟล์เดิม'}})}
test('draft persists, foreign browser cannot read/claim/confirm, and caller roles cannot spoof identity',async()=>{
 const f=await setup(),a=f.client(),b=f.client();await draft(a);await b.call();assert.equal((await b.call('/BRIEF-1')).status,404);assert.equal((await b.call('/BRIEF-1',{brief:{goal:'steal'}})).status,404);assert.equal((await b.call('/BRIEF-1/confirm',{})).status,404);
 const restored=f.client(a.cookie);assert.equal((await restored.call('/BRIEF-1')).body.request.brief.materials,'ไฟล์เดิม');
 assert.equal((await a.call('/BRIEF-1/messages',{messageId:'m1',text:'x',sender_type:'ADMIN'})).status,400);
 assert.equal((await a.call('/BRIEF-1/messages',{messageId:'m1',text:'x'},false,{origin:'https://evil.test'})).status,403);
 f.db.close();
});
test('confirm replay produces one work identity and one submission event, without any AI or Factory',async()=>{
 const f=await setup(),a=f.client();await draft(a);const first=await a.call('/BRIEF-1/confirm',{}),second=await a.call('/BRIEF-1/confirm',{});
 assert.equal(first.status,200);assert.equal(first.body.workCreated,true);assert.equal(second.body.workCreated,false);assert.equal(first.body.workId,second.body.workId);assert.equal(second.body.events.filter(e=>e.kind==='STATUS').length,1);assert.equal(f.aiCalls,0);
 assert.equal((await a.call('/BRIEF-1/upsert',{brief:{goal:'overwrite'}})).status,409);f.db.close();
});
test('verified Admin takeover/resume, honest sender metadata, timestamps and customer readback',async()=>{
 const f=await setup(),a=f.client();await draft(a);let r=await a.call('/BRIEF-1/messages',{messageId:'m1',text:'สวัสดี'});
 assert.equal(r.body.messages[0].sender_type,'CUSTOMER');assert.equal(r.body.messages[1].sender_label,'AI - GO');assert.equal(r.body.messages[1].sender_id,'go');
 assert.equal((await a.call('/BRIEF-1/messages',{messageId:'m1',text:'สวัสดี'})).body.messages.length,2);assert.equal(f.aiCalls,1);
 assert.equal((await a.call('/BRIEF-1/handoff',{responder:'ADMIN',version:r.body.request.version},true,{authorization:'Bearer '+'x'.repeat(40)})).status,401);
 assert.equal((await a.call('/BRIEF-1/messages',{messageId:'admin1',text:'hello'},true)).status,409);
 r=await a.call('/BRIEF-1/handoff',{responder:'ADMIN',version:r.body.request.version},true);assert.equal(r.status,200);assert.equal(r.body.messages.at(-1).sender_label,'System');
 r=await a.call('/BRIEF-1/messages',{messageId:'admin1',text:'Admin ตรวจรายละเอียดแล้ว'},true);assert.equal(r.body.messages.at(-1).sender_label,'Admin');assert.equal(r.body.messages.at(-1).sender_id,'big');
 await a.call('/BRIEF-1/messages',{messageId:'m2',text:'ขอบคุณ'});assert.equal(f.aiCalls,1);
 r=await a.call('/BRIEF-1');r=await a.call('/BRIEF-1/handoff',{responder:'AI',version:r.body.request.version},true);assert.equal(r.body.events.filter(e=>e.kind==='HANDOFF').length,2);assert.match(r.body.messages.at(-1).text,/AI - GO/);
 assert.ok(r.body.messages.every(m=>m.sender_id&&Date.parse(m.timestamp)));assert.ok(r.body.events.every(e=>e.actor_id&&Date.parse(e.timestamp)));f.db.close();
});
test('AI outage is System and never prevents submission; only Admin can progress with delivery evidence',async()=>{
 const f=await setup(),a=f.client();await draft(a);f.env.REQUESTS_DB;const {requestWorkflow}=await import('../src/request-workflow.js');
 const response=await requestWorkflow(new Request('https://yggmetro.com/api/v1/requests/BRIEF-1/messages',{method:'POST',headers:{cookie:a.cookie,origin:'https://yggmetro.com','content-type':'application/json'},body:JSON.stringify({messageId:'outage',text:'help'})}),f.env,async()=>{throw Error('offline')});
 const result=await response.json();assert.equal(result.messages.at(-1).sender_label,'System');assert.equal((await a.call('/BRIEF-1/confirm',{})).status,200);
 let r=await a.call('/BRIEF-1');assert.equal((await a.call('/BRIEF-1/status',{status:'REVIEWING',version:r.body.request.version})).status,403);
 for(const status of ['REVIEWING','IN_PROGRESS']){r=await a.call('/BRIEF-1/status',{status,version:r.body.request.version},true);assert.equal(r.status,200)}
 assert.equal((await a.call('/BRIEF-1/status',{status:'DELIVERED',version:r.body.request.version},true)).status,400);
 r=await a.call('/BRIEF-1/status',{status:'DELIVERED',version:r.body.request.version,delivery_url:'https://delivery.example.test/file',delivery_text:'ผลงานฉบับส่งมอบจริง'},true);assert.equal(r.status,200);assert.equal(r.body.request.status_label,'ส่งมอบงาน');assert.ok((await a.call('/BRIEF-1')).body.request.delivery_url);
 assert.equal((await a.call('/BRIEF-1/status',{status:'FOLLOW_UP',version:0},true)).status,409);f.db.close();
});
test('Admin takeover while inference is running suppresses stale AI output',async()=>{
 const f=await setup(),a=f.client();await draft(a);const {requestWorkflow}=await import('../src/request-workflow.js');let release,started;const ready=new Promise(r=>started=r);
 const pending=requestWorkflow(new Request('https://yggmetro.com/api/v1/requests/BRIEF-1/messages',{method:'POST',headers:{cookie:a.cookie,origin:'https://yggmetro.com','content-type':'application/json'},body:JSON.stringify({messageId:'race',text:'hello'})}),f.env,async()=>{started();await new Promise(r=>release=r);return Response.json({sender_type:'AI',reply:'stale'})});
 await ready;const current=await a.call('/BRIEF-1');assert.equal((await a.call('/BRIEF-1/handoff',{responder:'ADMIN',version:current.body.request.version},true)).status,200);release();const result=await (await pending).json();assert.equal(result.messages.some(m=>m.text==='stale'),false);assert.equal(result.request.responder_type,'ADMIN');f.db.close();
});

test('server AI request retains trusted CF identity and uses distinct session fallback identities',async()=>{
 const f=await setup(),a=f.client(),b=f.client();await draft(a,'BRIEF-a');await draft(b,'BRIEF-b');const {requestWorkflow}=await import('../src/request-workflow.js');const identities=[];
 for(const [client,requestId,ip] of [[a,'BRIEF-a','192.0.2.1'],[b,'BRIEF-b',null]]){
 const response=await requestWorkflow(new Request('https://yggmetro.com/api/v1/requests/'+requestId+'/messages',{method:'POST',headers:{cookie:client.cookie,origin:'https://yggmetro.com','content-type':'application/json',...(ip?{'cf-connecting-ip':ip}:{})},body:JSON.stringify({messageId:'rate',text:'hello'})}),f.env,async request=>{identities.push(request.headers.get('cf-connecting-ip'));return Response.json({sender_type:'AI',reply:'reply'})});assert.equal(response.status,200);
 }
 assert.equal(identities[0],'192.0.2.1');assert.match(identities[1],/^[a-f0-9]{64}$/);assert.notEqual(...identities);f.db.close();
});

test('full Worker assigns AI output and deterministic policy text to their actual server senders',async()=>{
 const {default:web}=await import('../src/index.js');const original=global.fetch;const result={intent:'HELP',jobType:null,package:null,pageCount:null,desiredDate:null,reply:'ตอบจาก AI',wantsEstimate:false,wantsManager:false,clientConfirmedComplete:false};
 global.fetch=async()=>Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});
 try{for(const [text,sender] of [['สวัสดี','AI'],['human please','SYSTEM']]){
 const response=await web.fetch(new Request('https://yggmetro.com/api/v1/interpret',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'identity-provenance'},body:JSON.stringify({text,sender_type:'ADMIN',sender_id:'forged'})}),{OPENAI_API_KEY:'local-provider-fixture'});
 const data=await response.json();assert.equal(response.status,200);assert.equal(data.sender_type,sender);assert.notEqual(data.sender_id,'forged');assert.ok(Date.parse(data.timestamp));
 }}finally{global.fetch=original}
});
test('list pagination exposes older owned requests without disclosing foreign records',async()=>{
 const f=await setup(),a=f.client(),b=f.client();await draft(a,'OWN-0');await draft(b,'FOREIGN');const owner=f.db.prepare('SELECT owner_hash FROM ygg_requests WHERE request_id=?').get('OWN-0').owner_hash;
 const statement=f.db.prepare('INSERT INTO ygg_requests(request_id,owner_hash,brief_json,created_at,updated_at) VALUES(?,?,?,?,?)');for(let i=1;i<102;i++)statement.run('OWN-'+i,owner,'{}','2026-10-19T00:00:00Z','2026-10-19T00:00:00Z');
 const first=await a.call(),second=await a.call('?cursor='+first.body.next_cursor);assert.equal(first.body.requests.length,100);assert.equal(second.body.requests.length,2);assert.equal(second.body.next_cursor,null);assert.equal([...first.body.requests,...second.body.requests].some(r=>r.request_id==='FOREIGN'),false);f.db.close();
});

test('failed confirmation transaction rolls back and retry emits exactly one submission',async()=>{
 const f=await setup(),a=f.client();await draft(a);f.db.exec("CREATE TRIGGER stop_confirmation BEFORE INSERT ON ygg_request_events WHEN NEW.to_value='SUBMITTED' BEGIN SELECT RAISE(ABORT,'fixture interrupted'); END");
 assert.equal((await a.call('/BRIEF-1/confirm',{})).status,503);let row=f.db.prepare('SELECT * FROM ygg_requests').get();assert.equal(row.status,'DRAFT');assert.equal(row.work_id,null);
 f.db.exec('DROP TRIGGER stop_confirmation');assert.equal((await a.call('/BRIEF-1/confirm',{})).status,200);assert.equal(f.db.prepare("SELECT COUNT(*) n FROM ygg_request_events WHERE to_value='SUBMITTED'").get().n,1);f.db.close();
});
test('cross-site bootstrap cannot replace a customer session cookie',async()=>{
 const f=await setup();const response=await f.client().call('',undefined,false,{'sec-fetch-site':'cross-site'});assert.equal(response.status,403);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM ygg_sessions').get().n,0);f.db.close();
});
