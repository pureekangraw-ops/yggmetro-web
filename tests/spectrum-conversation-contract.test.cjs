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


test('client page inline scripts compile and mobile chat stays compact',async()=>{
  const mod=await load();
  const response=await mod.default.fetch(new Request('https://yggmetro.com/client'),{});
  const page=await response.text();
  const scripts=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>!s.trim().startsWith('{"@context"'));
  assert.ok(scripts.length>=2);
  for(const script of scripts)assert.doesNotThrow(()=>new Function(script));
  assert.match(page,/\.chat\{height:clamp\(360px,52dvh,480px\);min-height:0;max-height:480px/);
  assert.match(page,/\.messages\{flex:1 1 auto;min-height:0;max-height:none/);
  assert.match(page,/\.composer\{padding-top:10px;align-items:stretch;flex-direction:row/);
  assert.match(page,/function scrollToLatest\(\)\{requestAnimationFrame/);
});


test('GO whisper and takeover use durable budget gate before model calls',async()=>{
  const mod=await load();
  const originalFetch=global.fetch;
  const providerCalls=[];
  global.fetch=async (request,init={})=>{
    const body=JSON.parse(String(init.body||'{}'));providerCalls.push(body);
    const isWhisper=body.model==='gpt-6-luna';
    const result=isWhisper
      ? {decision:'SPECTRUM_RETRY',focus:'logo direction',nextQuestion:'อยากเก็บอะไรจากโลโก้เดิมไว้บ้างครับ?',avoid:['อย่าถาม audience ซ้ำ']}
      : {reply:'ถ้าจะเก็บโลโก้เดิมไว้ จุดที่อยากเปลี่ยนที่สุดคือรูปทรง สี หรือฟอนต์ครับ?',focus:'logo direction',resolved:false};
    return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});
  };
  const gateCalls=[];
  const env={OPENAI_API_KEY:'test',GO_HUB:{fetch:async request=>{gateCalls.push(new URL(request.url).pathname);return Response.json({ok:true,allowed:true,duplicate:false,budget:{conversation:{whisper:1,takeover:0,total:1},global:{total:1}}});}}};
  try{
    const base={clientId:'CLIENT-1',conversationId:'CONV-1',brief:{goal:'แก้โลโก้'},messages:[{role:'user',text:'อยากแก้โลโก้'}]};
    let response=await mod.default.fetch(new Request('https://yggmetro.com/api/v1/go/whisper',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...base,requestId:'REQ-W-1',reason:'SPECTRUM_CANNOT_PROGRESS',text:'ไปต่อไม่ไหว'})}),env);
    assert.equal(response.status,200);let body=await response.json();assert.equal(body.decision,'SPECTRUM_RETRY');assert.equal(body.model,'gpt-6-luna');
    response=await mod.default.fetch(new Request('https://yggmetro.com/api/v1/go/takeover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...base,requestId:'REQ-T-1',reason:'CUSTOMER_REQUESTS_TEAM',text:'ขอทีม'})}),env);
    assert.equal(response.status,200);body=await response.json();assert.equal(body.model,'gpt-6.1-sol');assert.equal(body.resolved,false);
    assert.deepEqual(gateCalls,['/internal/spectrum/go-budget','/internal/spectrum/go-budget']);
    assert.equal(providerCalls[0].max_output_tokens,140);assert.equal(providerCalls[1].max_output_tokens,220);
  }finally{global.fetch=originalFetch}
});

test('GO budget refusal prevents expensive provider call',async()=>{
  const mod=await load();const originalFetch=global.fetch;let providerCalled=false;
  global.fetch=async()=>{providerCalled=true;throw new Error('must not call provider')};
  const env={OPENAI_API_KEY:'test',GO_HUB:{fetch:async()=>Response.json({ok:true,allowed:false,reason:'GO_CONVERSATION_TAKEOVER_LIMIT',budget:{conversation:{takeover:3}}})}};
  try{
    const response=await mod.default.fetch(new Request('https://yggmetro.com/api/v1/go/takeover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId:'CLIENT-1',conversationId:'CONV-1',requestId:'REQ-BLOCK',reason:'ACTIVE_TAKEOVER',text:'ต่อ',messages:[],brief:{}})}),env);
    assert.equal(response.status,429);assert.equal(providerCalled,false);
  }finally{global.fetch=originalFetch}
});

test('client wires whisper-before-takeover and short-lived GO state',async()=>{
  const mod=await load();const response=await mod.default.fetch(new Request('https://yggmetro.com/client'),{});const page=await response.text();
  assert.match(page,/\/api\/v1\/go\/whisper/);assert.match(page,/\/api\/v1\/go\/takeover/);
  assert.match(page,/whisperCount:0,stuckCount:0,goActive:false,goTurns:0/);
  assert.match(page,/CUSTOMER_REQUESTS_TEAM/);assert.match(page,/state\.goTurns<3/);
});


test('team call prechecks with GO before durable handoff and resumes handoff after takeover',async()=>{
  const mod=await load();const response=await mod.default.fetch(new Request('https://yggmetro.com/client'),{});const page=await response.text();
  assert.match(page,/teamRequestPending:false/);
  assert.match(page,/state\.teamRequestPending\?'กำลังเรียกทีม…':'เรียกทีม'/);
  const handler=page.slice(page.indexOf("confirmButton.addEventListener('click'"),page.indexOf("render();",page.indexOf("confirmButton.addEventListener('click'")));
  assert.ok(handler.indexOf("handleTeamPrecheck(last)")>=0);
  assert.equal(handler.indexOf("confirmBrief()"),-1);
  const helper=page.slice(page.indexOf("async function handleTeamPrecheck"),page.indexOf("async function submitText"));
  assert.ok(helper.indexOf("askWhisper('CUSTOMER_REQUESTS_TEAM'")<helper.indexOf("finalizeTeamHandoff()"));
  assert.match(page,/if\(state\.teamRequestPending\)await finalizeTeamHandoff\(\)/);
});


test('mobile client stays within viewport and team CTA is contextual/secondary',async()=>{
  const mod=await load();const response=await mod.default.fetch(new Request('https://yggmetro.com/client'),{});const page=await response.text();
  assert.match(page,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(page,/html,body\{overflow-x:hidden\}/);
  assert.match(page,/\.shell,\.workspace,\.chat,\.panel\{width:100%;max-width:100%;min-width:0\}/);
  assert.match(page,/\.brief-action\.primary\{background:rgba\(255,255,255,.07\);color:var\(--muted\)/);
  assert.match(page,/const showTeam=state\.confirmed\|\|state\.teamRequestPending\|\|state\.stage==='summary'/);
  assert.match(page,/confirmButton\.closest\('\.brief-actions'\)\.hidden=!showTeam/);
  assert.match(page,/confirmButton\.textContent=state\.confirmed\?'ส่งแล้ว':state\.teamRequestPending\?'กำลังเรียกทีม…':'คุยกับทีม'/);
});
