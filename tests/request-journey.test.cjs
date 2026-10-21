const test = require('node:test');
const assert = require('node:assert/strict');
const {journey} = require('./helpers/journey-client.cjs');
const textMessages = (db,id) => db.prepare("SELECT text FROM ygg_messages WHERE request_id=? AND sender_type='CUSTOMER' ORDER BY rowid").all(id).map(x=>x.text);
async function twoDrafts(f) {const c=await f.client(), a=c.get('requests').value; c.edit('goal','A');await c.save();await c.click('new');const b=c.get('requests').value;c.edit('goal','B');await c.save();await c.select(a);return {c,a,b};}

test('transport and malformed JSON errors never render internal details to customers',async t=>{
 const f=await journey(t),c=await f.client();
 for(const fail of [()=>{throw Error('internal secret path /private/server.js:42')},()=>new Response('<html>internal upstream stack</html>',{status:502}),()=>Response.json({code:'PRIVATE_BACKEND_EXCEPTION'},{status:503})]){
  c.intercept=async()=>fail();c.edit('goal','retain me');await c.save();
  assert.match(c.get('notice').textContent,/เชื่อมต่อ|ลองใหม่/);
  assert.doesNotMatch(c.get('notice').textContent,/internal|private|server\.js|JSON|Unexpected|PRIVATE_BACKEND/);
  assert.equal(c.get('goal').value,'retain me');
 }
});

test('composer drafts stay with their request on switch and return',async t=>{
 const f=await journey(t),{c,a,b}=await twoDrafts(f);c.edit('text','only for A');await c.select(b);
 assert.equal(c.get('text').value,'','A content must not appear in B composer');c.edit('text','only for B');await c.select(a);
 assert.equal(c.get('text').value,'only for A');await c.send();assert.deepEqual(textMessages(f.db,a),['only for A']);assert.deepEqual(textMessages(f.db,b),[]);
 await c.select(b);assert.equal(c.get('text').value,'only for B');
});

test('uncertain message retries use original id and text without losing newer edits',async t=>{
 const f=await journey(t),c=await f.client(),id=c.get('requests').value;let failed=false;
 c.intercept=async(path,init,next)=>{const response=await next();if(!failed&&path.endsWith('/messages')){failed=true;throw Error('response lost after commit')}return response};
 c.edit('text','original sent once');await c.send();assert.deepEqual(textMessages(f.db,id),['original sent once']);
 c.edit('text','newer composition');await c.send();
 assert.match(c.get('notice').textContent,/บันทึกข้อความแล้ว/);assert.deepEqual(textMessages(f.db,id),['original sent once']);assert.equal(c.get('text').value,'newer composition');
 await c.send();assert.deepEqual(textMessages(f.db,id),['original sent once','newer composition']);assert.equal(c.get('text').value,'');
});

test('late message response cannot erase edits typed while sending or cross requests',async t=>{
 const f=await journey(t),{c,a,b}=await twoDrafts(f);let release,started;const ready=new Promise(r=>started=r);
 c.intercept=async(path,init,next)=>{const response=await next();if(path===`/api/v1/requests/${a}/messages`){started();await new Promise(r=>release=r)}return response};
 c.edit('text','first A');const sending=c.send();await ready;c.edit('text','next A');await c.select(b);assert.equal(c.get('text').value,'');c.edit('text','B only');
 release();await sending;assert.equal(c.get('text').value,'B only');await c.select(a);assert.equal(c.get('text').value,'next A');assert.deepEqual(textMessages(f.db,a),['first A']);
});

test('same-tab refresh restores selected older request rather than newest request',async t=>{
 const f=await journey(t),{c,a,b}=await twoDrafts(f);const reload=await f.client({cookie:c.cookie,storage:c.storage});
 assert.notEqual(a,b);assert.equal(reload.get('requests').value,a);assert.equal(reload.get('goal').value,'A');
});

test('unsaved brief or message warns before refresh/back navigation without storing contents',async t=>{
 const f=await journey(t),c=await f.client();c.edit('goal','private unsaved brief');
 let prevented=false;const event={preventDefault(){prevented=true;}};c.events.beforeunload?.(event);assert.equal(prevented,true);
 await c.save();prevented=false;c.events.beforeunload?.(event);assert.equal(prevented,false);
 c.edit('text','private unsent message');c.events.beforeunload?.(event);assert.equal(prevented,true);
 assert.ok([...c.storage.values()].every(value=>!value.includes('private')));
});

test('Admin delivery composer is isolated per request and failed login clears old privileged data',async t=>{
 const f=await journey(t),{a,b}=await twoDrafts(f),admin=await f.client({admin:true});await admin.login();await admin.select(a);
 admin.edit('delivery-text','delivery only for A');admin.edit('delivery-url','https://example.test/a');admin.get('next-status').value='DELIVERED';await admin.select(b);
 assert.equal(admin.get('delivery-text').value,'');assert.equal(admin.get('delivery-url').value,'');assert.notEqual(admin.get('next-status').value,'DELIVERED');await admin.select(a);assert.equal(admin.get('delivery-text').value,'delivery only for A');
 await admin.login('invalid-token');assert.equal(admin.get('goal').value,'');assert.equal(admin.get('delivery-text').value,'');assert.equal(admin.get('requests').children.length,0);assert.equal(admin.get('messages').children.length,0);
});

test('double-send while pending commits one message and reply only',async t=>{
 const f=await journey(t),c=await f.client(),id=c.get('requests').value;let release,started;const ready=new Promise(r=>started=r);
 c.intercept=async(path,init,next)=>{const response=await next();if(path.endsWith('/messages')){started();await new Promise(r=>release=r)}return response};
 c.edit('text','send once');const sending=c.send();await ready;await c.send();release();await sending;assert.deepEqual(textMessages(f.db,id),['send once']);
});

test('failed Admin relogin removes the previously authenticated customer view',async t=>{
 const f=await journey(t),customer=await f.client();customer.edit('goal','private customer brief');await customer.save();const admin=await f.client({admin:true});await admin.login();assert.equal(admin.get('goal').value,'private customer brief');
 await admin.login('invalid-token');assert.equal(admin.get('goal').value,'');assert.equal(admin.get('request-id').textContent,'');assert.equal(admin.get('requests').children.length,0);assert.equal(admin.get('send').disabled,true);
});

test('foreign remembered request id is not restored across customer cookies',async t=>{
 const f=await journey(t),a=await f.client(),foreignId=a.get('requests').value,b=await f.client({storage:a.storage});
 assert.notEqual(b.get('requests').value,foreignId);assert.equal(b.get('goal').value,'');assert.equal((await b.raw('/api/v1/requests/'+foreignId)).status,404);
});

test('logout while a reply is pending prevents late data from restoring Admin view',async t=>{
 const f=await journey(t);await f.client();const admin=await f.client({admin:true});await admin.login();await admin.click('takeover');let release,started;const ready=new Promise(r=>started=r);
 admin.intercept=async(path,init,next)=>{const response=await next();if(path.endsWith('/messages')){started();await new Promise(r=>release=r)}return response};
 admin.edit('text','pending privileged reply');const sending=admin.send();await ready;await admin.click('logout');release();await sending;
 assert.equal(admin.get('goal').value,'');assert.equal(admin.get('messages').children.length,0);assert.equal(admin.get('text').value,'');assert.equal(admin.get('send').disabled,true);
});
