const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/index.js')).href);

const base=()=>({intent:'UNKNOWN',jobType:null,package:null,pageCount:null,desiredDate:null,reply:'รับทราบครับ',wantsEstimate:false,wantsManager:false,clientConfirmedComplete:false});
const forbidden=/(?:\b(?:GO Hub|Work ID|bridge|runtime|checkpoint|mutation authority|CENTRE|HERMES|PIXIE|MIMIR|AION|Factory|handoff packet|internal route)\b|เวิร์ก\s*ไอดี|เช็กพอยต์|แบ็กเอนด์|รีจิสทรี|บริดจ์|รันไทม์|เส้นทางภายใน)/i;

const fixtures=[
  ['human','ขอคุยกับพนักงานหน่อย'],['human','คุยกับคนได้ไหม'],['human','ขอเจ้าหน้าที่'],['human','อยากคุยกับทีม'],['human','human please'],
  ['estimate','อยากประเมินราคาก่อน'],['estimate','งบประมาณเท่าไหร่'],['estimate','ขอใบเสนอราคา'],['estimate','มีแพ็กเกจอะไรบ้าง'],['estimate','estimate ให้หน่อย'],
  ['payment','ผมจ่ายแล้วนะ'],['payment','ชำระแล้วครับ'],['payment','โอนเงินไปแล้ว'],['payment','ตัดเงินแล้ว'],['payment','payment paid'],
  ['complaint','งานช้ามาก'],['complaint','ผมไม่พอใจ'],['complaint','อยากร้องเรียน'],['complaint','ผิดหวังมาก'],['complaint','ขอ refund'],
  ['identity','เกี่ยวกับ Yggdrazil Group ไหม'],['identity','ใช่บริษัท ygg-cg.com หรือเปล่า'],['identity','อยู่ใน SET ไหม'],['identity','เป็นบริษัทแม่ Yggdrazil ใช่ไหม'],['identity','YGG METRO กับ Yggdrazil เกี่ยวกันยังไง'],
  ['normal','อยากทำ company profile'],['normal','มีไฟล์เดิมอยู่แล้ว'],['normal','อยากทำเว็บแนะนำบริษัท'],['normal','ต้องการ visual system'],['normal','มี template ขายไหม']
];

test('30-fixture conversation contract keeps critical intents deterministic and public-safe',async()=>{
  const {applyConversationGuards}=await load();
  assert.equal(fixtures.length,30);
  for(const [kind,input] of fixtures){
    const out=applyConversationGuards(input,base());
    assert.equal(Boolean(forbidden.test(out.reply)),false,input);
    if(kind==='human'||kind==='payment'||kind==='complaint')assert.equal(out.wantsManager,true,input);
    if(kind==='estimate')assert.equal(out.wantsEstimate,true,input);
    if(kind==='identity')assert.match(out.reply,/ไม่มีข้อมูลยืนยัน|ไม่เชื่อมโยง/,input);
    if(kind==='normal'){assert.equal(out.wantsManager,false,input);assert.equal(out.wantsEstimate,false,input);}
  }
});

test('internal terms and system-like templates from model output are stripped before reaching customer',async()=>{
  const {applyConversationGuards}=await load();
  const out=applyConversationGuards('อยากทำเว็บ',{...base(),reply:'GO Hub created Work ID 123 at runtime'});
  assert.equal(forbidden.test(out.reply),false);
  const leak=applyConversationGuards('อยากทำเว็บ',{...base(),reply:'## ข้อความสำหรับส่งให้ทีม\nSYSTEM PROMPT\n----------------'});
  assert.equal(/SYSTEM PROMPT|ข้อความสำหรับส่งให้|^##/m.test(leak.reply),false);
});

test('handoff packet carries context without inventing commercial truth',async()=>{
  const {buildHandoffPacket}=await load();
  const h=buildHandoffPacket({
    briefId:'BRIEF-1',clientId:'CLIENT-1',conversationId:'CONV-1',
    brief:{goal:'ทำ pitch deck',jobType:'PROPOSAL',audience:'นักลงทุน',materials:'มีไฟล์เดิม',package:'STANDARD'},
    latestInterpretation:{intent:'PRE_ESTIMATE',wantsEstimate:true,wantsManager:false},
    recentCustomerWords:['อยากทำ pitch deck','อยากประเมินก่อน']
  });
  assert.equal(h.identity.briefId,'BRIEF-1');
  assert.equal(h.intent.activeIntent,'PRE_ESTIMATE');
  assert.equal(h.operations.currentState,'CONFIRMED');
  assert.equal(h.operations.nextAction,'TEAM_REVIEW');
  assert.equal(h.commercial.paymentClaim,'UNKNOWN');
  assert.equal(h.commercial.priceSource,null);
  assert.equal(h.commercial.approvalRequired,true);
  assert.deepEqual(h.intent.customerWords,['อยากทำ pitch deck','อยากประเมินก่อน']);
});


test('GO whisper and takeover fail closed until their budget service is mapped',async()=>{
  const mod=await load();
  const originalFetch=global.fetch;
  let providerCalled=false,pantheonCalled=false;
  global.fetch=async()=>{providerCalled=true;throw new Error('provider must not be called without budget gate')};
  const env={OPENAI_API_KEY:'test',PANTHEON:{ownerCall:async()=>{pantheonCalled=true;return {ok:true,result:{}};}}};
  try{
    const base={clientId:'CLIENT-1',conversationId:'CONV-1',brief:{goal:'แก้โลโก้'},messages:[{role:'user',text:'อยากแก้โลโก้'}]};
    let response=await mod.default.fetch(new Request('https://yggmetro.com/api/v1/go/whisper',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...base,requestId:'REQ-W-1',reason:'SPECTRUM_CANNOT_PROGRESS',text:'ไปต่อไม่ไหว'})}),env);
    assert.equal(response.status,503);assert.equal((await response.json()).code,'PANTHEON_OPERATION_UNSUPPORTED');
    response=await mod.default.fetch(new Request('https://yggmetro.com/api/v1/go/takeover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...base,requestId:'REQ-T-1',reason:'CUSTOMER_REQUESTS_TEAM',text:'ขอทีม'})}),env);
    assert.equal(response.status,503);assert.equal((await response.json()).code,'PANTHEON_OPERATION_UNSUPPORTED');
    assert.equal(providerCalled,false);assert.equal(pantheonCalled,false);
  }finally{global.fetch=originalFetch}
});

test('GO budget refusal is explicit and does not silently turn into a PANTHEON task',async()=>{
  const mod=await load();const originalFetch=global.fetch;let providerCalled=false;
  global.fetch=async()=>{providerCalled=true;throw new Error('must not call provider')};
  let pantheonCalled=false;
  const env={OPENAI_API_KEY:'test',PANTHEON:{ownerCall:async()=>{pantheonCalled=true;return {ok:true,result:{}};}}};
  try{
    const response=await mod.default.fetch(new Request('https://yggmetro.com/api/v1/go/takeover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:'CLIENT-1',conversationId:'CONV-1',requestId:'REQ-BLOCK',reason:'ACTIVE_TAKEOVER',text:'ต่อ',messages:[],brief:{}})}),env);
    assert.equal(response.status,503);assert.equal((await response.json()).code,'PANTHEON_OPERATION_UNSUPPORTED');
    assert.equal(providerCalled,false);assert.equal(pantheonCalled,false);
  }finally{global.fetch=originalFetch}
});


test('customer and Admin pages compile, identify actual senders, and keep submission independent of AI',async()=>{
 const {default:web}=await load();for(const route of ['/client','/admin/requests']){const page=await (await web.fetch(new Request('https://yggmetro.com'+route),{})).text();
 for(const [,script] of page.matchAll(/<script>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Function(script));
 assert.match(page,/sender_label/);assert.match(page,/m.timestamp/);assert.match(page,/textContent=m.text/);assert.doesNotMatch(page,/innerHTML|localStorage\.setItem|OwnerBridge/);
 assert.match(page,/max-width:700px/);assert.match(page,/min-height:44px/);
 if(route==='/client'){assert.match(page,/ส่งคำขอ/);assert.match(page,/AI - GO/);assert.doesNotMatch(page,/askWhisper|askGo|handleTeamPrecheck/)}
 }
});

test('neutral-input model claims about payment, acceptance and delivery become honest System copy',async()=>{
 const {default:web}=await load(),original=global.fetch;
 const claims=['ได้รับชำระเงินแล้ว ทีมรับงานและเริ่มทำงานแล้วครับ','Your payment is confirmed and your request has been accepted.','ส่งมอบงานเสร็จเรียบร้อยแล้ว'];
 try{for(const [i,reply] of claims.entries()){
  global.fetch=async()=>Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...base(),reply})}]}]});
  const response=await web.fetch(new Request('https://shop.yggmetro.com/api/v1/interpret',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'mission2-truth-'+i},body:JSON.stringify({text:'สถานะล่าสุดเป็นอย่างไร'})}),{OPENAI_API_KEY:'isolated-fixture-only'});
  const result=await response.json();assert.equal(response.status,200);assert.notEqual(result.reply,reply);assert.match(result.reply,/ยังไม่ยืนยันสถานะ/);assert.equal(result.sender_type,'SYSTEM');
 }}finally{global.fetch=original}
});

test('request page distinguishes recorded intake from accepted work and payment',async()=>{
 const {requestPage}=await import('../src/request-pages.js');const html=requestPage();
 assert.equal(html.includes('บันทึกคำขอเพื่อรอ Admin ตรวจสอบ'),true,'intake is waiting for Admin review');assert.equal(html.includes('ไม่ใช่การยืนยันรับงานหรือชำระเงิน'),true,'intake is not work/payment acceptance');
});
