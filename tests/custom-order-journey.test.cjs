const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {fixture}=require('./helpers/request-store.cjs');
async function setup(t){
 const {customOrderScript}=await import('../src/storefront-layout.js'),{requestWorkflow}=await import('../src/request-workflow.js'),f=fixture();t.after(()=>f.db.close());
 const status={textContent:''},button={disabled:false},link={hidden:true},storage=new Map(),fields={service:'digital',contact:'synthetic@example.test',goal:'Synthetic web brief',reference:'https://example.test/ref'};
 const controls=Object.fromEntries(Object.keys(fields).map(name=>[name,{disabled:false,get value(){return fields[name]},set value(v){fields[name]=v}}]));
 const form={listeners:{},reportValidity:()=>true,querySelector:s=>s==='button'?button:status,addEventListener:(k,fn)=>form.listeners[k]=fn,elements:{namedItem:name=>controls[name]},reset:()=>Object.keys(fields).forEach(k=>fields[k]='')};
 let cookie='';const events={};const c={...f,events,fields,status,button,link,storage,intercept:null,async submit(){await form.listeners.submit({preventDefault(){}})}};
 async function actual(path,init={}){const response=await requestWorkflow(new Request('https://shop.yggmetro.com'+path,{...init,headers:{...init.headers,origin:'https://shop.yggmetro.com',...(cookie?{cookie}:{})}}),f.env,async()=>{throw Error('No AI')});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return response}
 const run=()=>vm.runInNewContext(customOrderScript.match(/<script>([\s\S]*?)<\/script>/)[1],{document:{getElementById:id=>id==='custom-order-form'?form:link},FormData:class{constructor(){this.snapshot=Object.fromEntries(Object.entries(fields).filter(([name])=>!controls[name].disabled))}get(key){return this.snapshot[key]??null}},location:{pathname:'/custom-order'},crypto,addEventListener:(name,fn)=>events[name]=fn,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:(path,init)=>c.intercept?c.intercept(path,init,()=>actual(path,init)):actual(path,init)});
 c.reload=async()=>{form.reset();link.hidden=true;status.textContent='';run();for(let i=0;i<100&&button.disabled;i++)await new Promise(r=>setTimeout(r,2));assert.equal(button.disabled,false)};run();return c;
}
test('actual Custom Order entry bootstraps owner, saves draft, confirms, and offers owned readback',async t=>{
 const c=await setup(t);await c.submit();assert.match(c.status.textContent,/บันทึกคำขอแล้ว รอ Admin ตรวจสอบ/);
 const rows=c.db.prepare('SELECT * FROM ygg_requests').all();assert.equal(rows.length,1);assert.equal(rows[0].status,'SUBMITTED');assert.equal(JSON.parse(rows[0].brief_json).serviceLine,'DIGITAL');assert.equal(JSON.parse(rows[0].brief_json).audience,'ติดต่อกลับ: synthetic@example.test');
 assert.equal(c.link.hidden,false);assert.equal(c.link.href,'/client');assert.equal(c.storage.get('yggmetro-request-selection'),rows[0].request_id);assert.equal(c.fields.goal,'');
});
test('lost Custom Order confirmation response retries original request without duplicate or losing newer edits',async t=>{
 const c=await setup(t);let failed=false;c.intercept=async(path,init,next)=>{const response=await next();if(!failed&&path.endsWith('/confirm')){failed=true;throw Error('private transport detail')}return response};
 await c.submit();assert.match(c.status.textContent,/ยังส่งไม่สำเร็จ/);assert.equal(c.fields.goal,'Synthetic web brief');assert.equal(c.db.prepare('SELECT status FROM ygg_requests').get()?.status,'SUBMITTED');
 c.fields.goal='newer unsent idea';await c.submit();assert.match(c.status.textContent,/บันทึกคำขอแล้ว รอ Admin ตรวจสอบ/);assert.equal(c.fields.goal,'newer unsent idea');assert.equal(c.db.prepare('SELECT COUNT(*) n FROM ygg_requests').get().n,1);assert.equal(c.db.prepare("SELECT COUNT(*) n FROM ygg_request_events WHERE to_value='SUBMITTED'").get().n,1);assert.equal(JSON.parse(c.db.prepare('SELECT brief_json FROM ygg_requests').get().brief_json).goal,'Synthetic web brief');
});
test('Custom Order network failure and repeated submit preserve form and one immutable pending request',async t=>{
 const c=await setup(t);let release,started;const ready=new Promise(r=>started=r);let blocked=true;
 c.intercept=async(path,init,next)=>{if(blocked){started();await new Promise(r=>release=r);throw Error('private failure')}return next()};
 const first=c.submit();await ready;await c.submit();release();await first;assert.equal(c.fields.goal,'Synthetic web brief');assert.equal(c.db.prepare('SELECT COUNT(*) n FROM ygg_requests').get().n,0);assert.doesNotMatch(c.status.textContent,/private/);blocked=false;await c.submit();assert.equal(c.db.prepare('SELECT COUNT(*) n FROM ygg_requests').get().n,1);
});

test('Custom Order retries a lost draft-save response and retains owner isolation when session expires',async t=>{
 const c=await setup(t);let lose=true;c.intercept=async(path,init,next)=>{const response=await next();if(lose&&init?.method==='POST'&&!path.endsWith('/confirm')){lose=false;throw Error('lost save')}return response};
 await c.submit();assert.equal(c.db.prepare('SELECT status FROM ygg_requests').get().status,'DRAFT');
 c.db.exec('UPDATE ygg_sessions SET expires_at=0');await c.submit();assert.match(c.status.textContent,/ยังส่งไม่สำเร็จ/);assert.equal(c.db.prepare('SELECT COUNT(*) n FROM ygg_requests').get().n,1);assert.equal(c.db.prepare('SELECT status FROM ygg_requests').get().status,'DRAFT');
 c.db.exec('UPDATE ygg_sessions SET expires_at=9999999999999');await c.submit();assert.equal(c.db.prepare('SELECT status FROM ygg_requests').get().status,'SUBMITTED');assert.equal(c.db.prepare('SELECT COUNT(*) n FROM ygg_requests').get().n,1);
});
test('Custom Order warns before leaving edited or uncertain form, then clears warning after success',async t=>{
 const c=await setup(t);let warned=false;const event={preventDefault(){warned=true;}};
 // The fixture starts with form values; subsequent edits must be protected.
 c.fields.goal='edited unsaved form';c.events.beforeunload?.(event);assert.equal(warned,true);
 await c.submit();warned=false;c.events.beforeunload?.(event);assert.equal(warned,false);
});

test('Custom Order lost-confirm response then refresh resolves the existing submission without another write',async t=>{
 const c=await setup(t);let lost=false;c.intercept=async(path,init,next)=>{const response=await next();if(!lost&&path.endsWith('/confirm')){lost=true;throw Error('response lost')}return response};
 await c.submit();const row=c.db.prepare('SELECT * FROM ygg_requests').get();assert.equal(row.status,'SUBMITTED');await c.reload();
 assert.match(c.status.textContent,/บันทึกคำขอแล้ว รอ Admin ตรวจสอบ/);assert.equal(c.link.hidden,false);assert.equal(c.storage.get('yggmetro-request-selection'),row.request_id);
 assert.equal(c.db.prepare('SELECT COUNT(*) n FROM ygg_requests').get().n,1);assert.equal(c.db.prepare('SELECT version FROM ygg_requests').get().version,row.version);assert.equal(c.db.prepare("SELECT COUNT(*) n FROM ygg_request_events WHERE to_value='SUBMITTED'").get().n,1);
 assert.ok([...c.storage.values()].every(value=>/^BRIEF-[A-Za-z0-9-]+$/.test(value)),'browser stores IDs only, never contact/brief/session data');
});
test('Custom Order lost-save response then refresh restores only the server-owned draft before retry',async t=>{
 const c=await setup(t);let lost=false;c.intercept=async(path,init,next)=>{const response=await next();if(!lost&&init?.method==='POST'){lost=true;throw Error('save response lost')}return response};
 await c.submit();const id=c.db.prepare('SELECT request_id FROM ygg_requests').get().request_id;await c.reload();assert.equal(c.fields.goal,'Synthetic web brief');assert.equal(c.fields.contact,'synthetic@example.test');
 await c.submit();assert.equal(c.db.prepare('SELECT COUNT(*) n FROM ygg_requests').get().n,1);assert.equal(c.db.prepare('SELECT request_id,status FROM ygg_requests').get().request_id,id);assert.equal(c.db.prepare('SELECT status FROM ygg_requests').get().status,'SUBMITTED');
});
test('editing a recovered unsubmitted Custom Order draft submits the visible updated fields',async t=>{
 const c=await setup(t);let lost=false;c.intercept=async(path,init,next)=>{const response=await next();if(!lost&&init?.method==='POST'){lost=true;throw Error('save lost')}return response};
 await c.submit();await c.reload();c.fields.goal='recovered draft updated before confirm';await c.submit();assert.equal(JSON.parse(c.db.prepare('SELECT brief_json FROM ygg_requests').get().brief_json).goal,'recovered draft updated before confirm');assert.equal(c.fields.goal,'');
});
test('recovering an already progressed request shows its authoritative status instead of awaiting review',async t=>{
 const c=await setup(t);let lost=false;c.intercept=async(path,init,next)=>{const response=await next();if(!lost&&path.endsWith('/confirm')){lost=true;throw Error('response lost')}return response};
 await c.submit();c.db.exec("UPDATE ygg_requests SET status='DELIVERED'");await c.reload();assert.match(c.status.textContent,/ส่งมอบงาน/);assert.doesNotMatch(c.status.textContent,/รอ Admin ตรวจสอบ/);
});

test('successful Custom Order reload recovery leaves no false dirty warning when controls are re-enabled',async t=>{
 const c=await setup(t);let lost=false;c.intercept=async(path,init,next)=>{const response=await next();if(!lost&&path.endsWith('/confirm')){lost=true;throw Error('confirm lost')}return response};
 await c.submit();await c.reload();let warned=false;c.events.beforeunload({preventDefault(){warned=true;}});assert.equal(warned,false);
});
