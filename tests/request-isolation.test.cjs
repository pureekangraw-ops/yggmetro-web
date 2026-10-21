const test=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {journey}=require('./helpers/journey-client.cjs');

test('independent customer/Admin/request and owned-download isolation matrix (56 checks)',()=>{
 const result=spawnSync(process.execPath,['tests/helpers/isolation-matrix.mjs'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);const data=JSON.parse(result.stdout);
 assert.equal(data.request_checks,31);assert.equal(data.download_checks,25);assert.equal(data.request_result,'PASS');assert.equal(data.download_result,'PASS');
 assert.equal(data.unverified_claim_probe.body.sender_type,'SYSTEM');assert.match(data.unverified_claim_probe.body.reply,/ยังไม่ยืนยันสถานะ/);
});

test('two authenticated Admins cannot reply as the other conversation owner',async t=>{
 const f=await journey(t),customer=await f.client(),id=customer.get('requests').value,admin=await f.client({admin:true});
 const secondToken='second-admin-isolation-token-'.repeat(2);f.env.YGG_ADMIN_CREDENTIALS=JSON.stringify({...JSON.parse(f.env.YGG_ADMIN_CREDENTIALS),second:createHash('sha256').update(secondToken).digest('hex')});
 await admin.login();await admin.click('takeover');const other=await f.client({admin:true});await other.login(secondToken);other.edit('text','cannot impersonate first Admin');await other.send();
 assert.match(other.get('notice').textContent,/รับช่วง/);assert.equal(f.db.prepare("SELECT COUNT(*) n FROM ygg_messages WHERE sender_type='ADMIN'").get().n,0);
 await other.click('takeover');await other.send();assert.equal(f.db.prepare("SELECT sender_id FROM ygg_messages WHERE sender_type='ADMIN'").get().sender_id,'second');
 admin.edit('text','first no longer owns conversation');await admin.send();assert.match(admin.get('notice').textContent,/รับช่วง/);assert.equal(f.db.prepare("SELECT COUNT(*) n FROM ygg_messages WHERE sender_type='ADMIN'").get().n,1);
 assert.equal((await (await customer.raw('/api/v1/requests/'+id)).json()).request.responder_id,'second');
});
