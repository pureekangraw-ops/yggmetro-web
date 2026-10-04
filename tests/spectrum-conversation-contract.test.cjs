const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/index.js')).href);

const base=()=>({intent:'UNKNOWN',jobType:null,package:null,pageCount:null,desiredDate:null,reply:'รับทราบครับ',wantsEstimate:false,wantsManager:false,clientConfirmedComplete:false});
const forbidden=/\b(?:GO Hub|Work ID|bridge|runtime|checkpoint|mutation authority)\b/i;

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

test('internal terms from model output are stripped before reaching customer',async()=>{
  const {applyConversationGuards}=await load();
  const out=applyConversationGuards('อยากทำเว็บ',{...base(),reply:'GO Hub created Work ID 123 at runtime'});
  assert.equal(forbidden.test(out.reply),false);
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
  assert.match(page,/\.messages\{flex:0 1 auto;min-height:96px;max-height:34svh/);
  assert.match(page,/\.composer\{padding-top:10px;align-items:stretch;flex-direction:row/);
  assert.match(page,/function scrollToLatest\(\)\{requestAnimationFrame/);
});
