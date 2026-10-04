const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5.4-mini";
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const buckets = new Map();

const INTENTS = ["SERVICE","PRICE","INCLUDED","MATERIALS","REVISION","SCOPE_CHANGE","TIMELINE","PAGE_COUNT","OLD_FILE","UNORGANIZED_CONTENT","GRAPH_TABLE_DIAGRAM","PORTFOLIO","START","PRE_ESTIMATE","HELP","UNKNOWN"];
const JOB_TYPES = ["PROPOSAL","COMPANY_PROFILE","PORTFOLIO_CASE_STUDY","REPORT_SUMMARY","OTHER"];
const PACKAGES = ["STARTER","STANDARD","BUSINESS"];

const SYSTEM_PROMPT = `คุณเป็น SPECTRUMSALE ฝั่งหน้าร้าน YGG METRO เป็นผู้ช่วยรับโจทย์และจัดทิศทางงาน Presentation แบบสนทนาธรรมชาติ
อ่านข้อความลูกค้าแล้วคืนเฉพาะ JSON ตาม schema โดย reply ต้องตอบข้อความล่าสุดของลูกค้าโดยตรง กระชับ สุภาพ ไม่พูดซ้ำเป็นประโยคเดิมทุกครั้ง
ห้ามคิดราคาใหม่ ห้ามสร้างข้อเท็จจริง ห้ามอ้างว่ามีพนักงานกำลังคุยสดถ้ายังไม่ได้ส่ง Work เข้า GO Hub และห้ามคืน runtime/domain/command/mutation authority
อย่าเดา pageCount, desiredDate หรือ package ถ้าลูกค้าไม่ได้ระบุชัด
wantsEstimate=true เมื่อขอประเมินราคา/แพ็กเกจ/จำนวนหน้า/ระยะเวลา
wantsManager=true เมื่อขอคุยกับพนักงาน คนจริง สำนักงาน ผู้จัดการ หรือประเด็นต้องใช้ดุลยพินิจ
clientConfirmedComplete=true เมื่อบอกชัดว่าข้อมูลที่ส่งมาคือทั้งหมดที่มี
ถ้าลูกค้าขอคุยกับคน ให้ reply ยืนยันความต้องการนั้นตรง ๆ และบอกว่าจะส่งต่อผ่าน Work หลังยืนยัน brief โดยไม่กลับไปถามคำถามแบบฟอร์มเดิม
ถ้ายังไม่พอให้เลือก intent ให้ใช้ UNKNOWN`;

const SCHEMA = {
  type:"object", additionalProperties:false,
  properties:{
    intent:{type:"string",enum:INTENTS},
    jobType:{anyOf:[{type:"string",enum:JOB_TYPES},{type:"null"}]},
    package:{anyOf:[{type:"string",enum:PACKAGES},{type:"null"}]},
    pageCount:{anyOf:[{type:"integer",minimum:1,maximum:500},{type:"null"}]},
    desiredDate:{type:["string","null"]},
    reply:{type:"string",minLength:1,maxLength:700},
    wantsEstimate:{type:"boolean"},
    wantsManager:{type:"boolean"},
    clientConfirmedComplete:{type:"boolean"}
  },
  required:["intent","jobType","package","pageCount","desiredDate","reply","wantsEstimate","wantsManager","clientConfirmedComplete"]
};

function json(data,status=200){return Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}})}
function clientKey(request){return request.headers.get("cf-connecting-ip")||"unknown"}
function rateLimited(request,scope='customer'){
  const key=scope+':'+clientKey(request), now=Date.now();
  const current=buckets.get(key);
  if(!current||now-current.startedAt>=WINDOW_MS){buckets.set(key,{startedAt:now,count:1});return false}
  current.count+=1;
  if(current.count>MAX_REQUESTS)return true;
  return false;
}
function outputText(payload){
  for(const item of payload?.output||[]){
    if(item?.type!=="message")continue;
    for(const part of item.content||[]){
      if(part?.type==="output_text"&&typeof part.text==="string")return part.text;
    }
  }
  return null;
}
function compactContext(context={}){
  const fields=["stage","jobType","package"].map(k=>typeof context?.[k]==="string"?`${k}=${context[k].slice(0,40)}`:null).filter(Boolean);
  if(typeof context?.confirmed==="boolean")fields.push("confirmed="+String(context.confirmed));
  if(typeof context?.workId==="string"&&context.workId)fields.push("workId="+context.workId.slice(0,120));
  return fields.join("; ")||"none";
}
function validResult(x){
  return x&&typeof x==="object"&&!Array.isArray(x)&&INTENTS.includes(x.intent)&&
    (x.jobType===null||JOB_TYPES.includes(x.jobType))&&
    (x.package===null||PACKAGES.includes(x.package))&&
    (x.pageCount===null||(Number.isInteger(x.pageCount)&&x.pageCount>=1&&x.pageCount<=500))&&
    (x.desiredDate===null||typeof x.desiredDate==="string")&&
    typeof x.reply==="string"&&x.reply.trim().length>0&&x.reply.length<=700&&
    typeof x.wantsEstimate==="boolean"&&typeof x.wantsManager==="boolean"&&typeof x.clientConfirmedComplete==="boolean";
}

async function handleGoClientInterpret(request,env){
  if(request.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:{allow:"POST"}});
  if(rateLimited(request))return json({ok:false,code:"RATE_LIMITED"},429);
  if(typeof env?.OPENAI_API_KEY!=="string"||!env.OPENAI_API_KEY.trim())return json({ok:false,code:"INTERPRETER_NOT_CONFIGURED"},503);

  let body;
  try{body=await request.json()}catch{return json({ok:false,code:"INVALID_JSON"},400)}
  const text=typeof body?.text==="string"?body.text.trim():"";
  if(!text||text.length>2000)return json({ok:false,code:"INVALID_INPUT"},400);

  const upstreamBody={
    model:MODEL, store:false, max_output_tokens:260,
    input:[
      {role:"system",content:SYSTEM_PROMPT},
      {role:"system",content:`current_context: ${compactContext(body?.context)}`},
      {role:"user",content:text}
    ],
    text:{format:{type:"json_schema",name:"spectrumsale_intent_v1",strict:true,schema:SCHEMA}}
  };

  let upstream;
  try{
    upstream=await fetch(OPENAI_RESPONSES_URL,{
      method:"POST",
      headers:{"content-type":"application/json",authorization:`Bearer ${env.OPENAI_API_KEY.trim()}`},
      body:JSON.stringify(upstreamBody)
    });
  }catch{return json({ok:false,code:"PROVIDER_UNAVAILABLE"},502)}

  if(!upstream.ok){
    const code=upstream.status===401?"PROVIDER_UNAUTHORIZED":upstream.status===429?"PROVIDER_RATE_LIMITED":"PROVIDER_ERROR";
    return json({ok:false,code},502);
  }

  let payload;
  try{payload=await upstream.json()}catch{return json({ok:false,code:"INVALID_PROVIDER_RESPONSE"},502)}
  const raw=outputText(payload);
  if(!raw)return json({ok:false,code:"INVALID_PROVIDER_RESPONSE"},502);

  let result;
  try{result=JSON.parse(raw)}catch{return json({ok:false,code:"INVALID_PROVIDER_RESPONSE"},502)}
  if(!validResult(result))return json({ok:false,code:"INVALID_PROVIDER_RESPONSE"},502);

  const clientId=typeof body?.clientId==="string"?body.clientId.trim().slice(0,120):"";
  const conversationId=typeof body?.conversationId==="string"?body.conversationId.trim().slice(0,120):"";
  return json({...result,provider:"openai",model:MODEL,clientId:clientId||null,conversationId:conversationId||null});
}


function briefId(value){return String(value||"").trim().slice(0,120)}
function briefText(value,max=2000){return typeof value==="string"?value.trim().slice(0,max):""}
function briefObject(value){
  const input=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  return {
    goal:briefText(input.goal),
    jobType:JOB_TYPES.includes(input.jobType)?input.jobType:null,
    audience:briefText(input.audience),
    materials:briefText(input.materials),
    pageCount:Number.isInteger(input.pageCount)&&input.pageCount>=1&&input.pageCount<=500?input.pageCount:null,
    package:PACKAGES.includes(input.package)?input.package:null,
    desiredDate:briefText(input.desiredDate,120),
    deadlineText:briefText(input.deadlineText,240),
  };
}
async function callBriefRegistry(env,path,payload){
  if(!env?.GO_HUB||typeof env.GO_HUB.fetch!=="function")return {ok:false,status:503,code:"BRIEF_BRIDGE_NOT_CONFIGURED"};
  let response;
  try{
    response=await env.GO_HUB.fetch(new Request("https://go-hub.internal"+path,{method:"POST",headers:{"content-type":"application/json","x-yggmetro-surface":"SPECTRUMSALE"},body:JSON.stringify(payload)}));
  }catch{return {ok:false,status:502,code:"BRIEF_BRIDGE_UNAVAILABLE"}}
  const body=await response.json().catch(()=>({}));
  if(!response.ok)return {ok:false,status:502,code:String(body?.code||"BRIEF_BRIDGE_REJECTED")};
  return {ok:true,body};
}
async function readBriefBody(request){
  let body;
  try{body=await request.json()}catch{return {error:json({ok:false,code:"INVALID_JSON"},400)}}
  const clientId=briefId(body?.clientId),conversationId=briefId(body?.conversationId),id=briefId(body?.briefId);
  if(!clientId||!conversationId||!id)return {error:json({ok:false,code:"BRIEF_IDENTITY_REQUIRED"},400)};
  return {body,clientId,conversationId,briefId:id};
}
async function handleBriefUpsert(request,env){
  if(request.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:{allow:"POST"}});
  if(rateLimited(request))return json({ok:false,code:"RATE_LIMITED"},429);
  const parsed=await readBriefBody(request);if(parsed.error)return parsed.error;
  const {body,clientId,conversationId,briefId:id}=parsed;
  const payload={version:"1",briefId:id,clientId,conversationId,surface:"SPECTRUMSALE",status:"DRAFT",stage:briefText(body?.stage,40),brief:briefObject(body?.brief),latestInterpretation:body?.latestInterpretation&&typeof body.latestInterpretation==="object"?body.latestInterpretation:null,updatedAt:new Date().toISOString()};
  const result=await callBriefRegistry(env,"/internal/brief/upsert",payload);
  if(!result.ok)return json({ok:false,code:result.code,briefId:id,clientId,conversationId},result.status);
  return json({ok:true,status:"DRAFT",briefId:id,clientId,conversationId,registry:result.body||null});
}
async function handleBriefConfirm(request,env){
  if(request.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:{allow:"POST"}});
  if(rateLimited(request))return json({ok:false,code:"RATE_LIMITED"},429);
  const parsed=await readBriefBody(request);if(parsed.error)return parsed.error;
  const {body,clientId,conversationId,briefId:id}=parsed;
  const payload={version:"1",briefId:id,clientId,conversationId,surface:"SPECTRUMSALE",status:"CONFIRMED",stage:"summary",brief:briefObject(body?.brief),confirmedAt:new Date().toISOString()};
  const result=await callBriefRegistry(env,"/internal/brief/confirm",payload);
  if(!result.ok)return json({ok:false,code:result.code,briefId:id,clientId,conversationId},result.status);
  const office=result.body||{};return json({ok:true,status:"CONFIRMED",briefId:id,clientId,conversationId,workId:office.workId||null,work:office.work||null,workCreated:Boolean(office.workCreated),office});
}

async function handleSalesEvent(request,env){
  if(request.method!=="POST")return new Response("Method Not Allowed",{status:405});
  if(rateLimited(request,"observations"))return json({ok:false,code:"RATE_LIMITED"},429);
  const raw=await request.text();if(raw.length>4096)return json({ok:false,code:"PAYLOAD_TOO_LARGE"},413);
  let body;try{body=JSON.parse(raw)}catch{return json({ok:false,code:"INVALID_JSON"},400)}
  if(!["PAGE_VIEW","SERVICE_INTEREST","BRIEF_STARTED","CTA_CLICK"].includes(body?.type)||!briefId(body?.eventId))return json({ok:false,code:"SALES_EVENT_INVALID"},400);
  const result=await callBriefRegistry(env,"/internal/spectrum/event",{eventId:body.eventId,type:body.type,page:briefText(body.page,240).split(/[?#]/)[0],source:briefText(body.source,120)});
  return result.ok?json({ok:true}):json({ok:false,code:result.code},result.status);
}
const salesObserverScript=`<script>
(function(){
 const key='ygg-sales-observations-v1';let sending=false;
 function load(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
 function save(queue){try{localStorage.setItem(key,JSON.stringify(queue));return true}catch{return false}}
 async function flush(){if(sending)return;sending=true;try{let queue=load();while(queue.length){const response=await fetch('/api/v1/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(queue[0])});if(!response.ok)break;const current=load().filter(function(e){return e.eventId!==queue[0].eventId});save(current);queue=current;}}catch{}finally{sending=false}}
 function observe(type){let source='direct';try{if(document.referrer)source=new URL(document.referrer).hostname}catch{}const queue=load();if(queue.length>=200)return;queue.push({eventId:'EV-'+crypto.randomUUID(),type:type,page:location.pathname,source:source});if(save(queue))flush();}
 observe('PAGE_VIEW');document.addEventListener('click',function(event){const link=event.target.closest('a[href]');if(!link)return;let target;try{target=new URL(link.href)}catch{return}if(target.origin===location.origin && target.pathname==='/client')observe('SERVICE_INTEREST');});window.addEventListener('online',flush);setInterval(flush,30000);flush();
})();
</script>`;

function goClientPage(){
return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SPECTRUMSALE · Project Intake · YGG METRO</title><meta name="description" content="SPECTRUMSALE คือจุดรับโจทย์และจัดทิศทางเบื้องต้นของ YGG METRO ช่วยเปลี่ยนไอเดีย ไฟล์ และ brief ที่ยังไม่สมบูรณ์ให้เป็นทิศทางงานที่ชัดขึ้น">
<style>
:root{color-scheme:dark;--bg:#080b10;--panel:rgba(18,24,34,.82);--panel-2:rgba(10,14,21,.78);--line:rgba(255,255,255,.13);--text:#f5f7fa;--muted:rgba(245,247,250,.64);--warm:#f5c78b;--green:#a7f3d0}
*{box-sizing:border-box}html,body{margin:0;min-height:100%}body{min-height:100svh;color:var(--text);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg) url("https://raw.githubusercontent.com/pureekangraw-ops/yggmetro-web/main/home-bg.webp") center/cover fixed no-repeat}
body:before{content:"";position:fixed;inset:0;background:linear-gradient(180deg,rgba(4,8,14,.64),rgba(4,8,14,.9)),radial-gradient(circle at 78% 12%,rgba(245,199,139,.16),transparent 30%);pointer-events:none}.page{position:relative;z-index:1;min-height:100svh;padding:22px 20px 44px}.top{width:min(1180px,100%);margin:0 auto 52px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{color:#fff;text-decoration:none;font-size:.73rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase}.back{color:var(--muted);text-decoration:none;font-size:.84rem}.back:hover,.back:focus-visible{color:#fff}.shell{width:min(1180px,100%);margin:auto}.intro{display:flex;align-items:end;justify-content:space-between;gap:32px;margin-bottom:24px}.eyebrow{font-size:.7rem;letter-spacing:.19em;text-transform:uppercase;color:var(--warm);font-weight:800}.intro h1{margin:10px 0 10px;font-size:clamp(2.8rem,7vw,6.4rem);line-height:1.02;letter-spacing:-.055em}.intro p{max-width:480px;margin:0;color:var(--muted);line-height:1.6}.intro-note{max-width:220px;color:var(--muted);font-size:.84rem;line-height:1.5;text-align:right}.progress{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}.progress-step{padding:10px 12px;border-top:1px solid var(--line);color:rgba(245,247,250,.38);font-size:.72rem;letter-spacing:.06em}.progress-step span{display:block;font-size:.64rem;color:rgba(245,247,250,.38);margin-bottom:4px}.progress-step.active{border-color:var(--warm);color:#fff}.progress-step.active span{color:var(--warm)}.progress-step.done{color:rgba(245,247,250,.7);border-color:rgba(167,243,208,.6)}
.workspace{display:block}.chat{width:min(900px,100%);margin:0 auto}.panel{border:1px solid var(--line);background:var(--panel);backdrop-filter:blur(18px);border-radius:22px;box-shadow:0 18px 60px rgba(0,0,0,.22)}.chat{min-height:600px;display:flex;flex-direction:column;overflow:hidden}.chat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid var(--line)}.chat-head strong{font-size:.94rem}.chat-head small{color:var(--muted)}.reset{border:0;background:transparent;color:var(--muted);font:inherit;font-size:.78rem;cursor:pointer}.reset:hover{color:#fff}.messages{flex:1;min-height:340px;padding:22px 20px;display:flex;flex-direction:column;gap:14px;overflow:auto}.message{max-width:min(82%,620px);padding:14px 16px;border-radius:17px;line-height:1.58;font-size:.95rem;white-space:pre-wrap;animation:message-in .35s cubic-bezier(.22,1,.36,1) both}.message.assistant{align-self:flex-start;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-top-left-radius:6px}.message.user{align-self:flex-end;background:#fff;color:#0b0e13;border-top-right-radius:6px}.message.error{color:#fecaca;border-color:rgba(248,113,113,.35)}.quick{display:flex;flex-wrap:wrap;gap:8px;padding:0 20px 14px}.quick button,.chip{border:1px solid var(--line);border-radius:999px;padding:8px 12px;color:var(--muted);background:rgba(255,255,255,.05);font:inherit;font-size:.78rem;cursor:pointer}.quick button:hover,.quick button:focus-visible{border-color:var(--warm);color:#fff;background:rgba(245,199,139,.1)}.composer{display:flex;gap:10px;padding:14px 20px 20px;border-top:1px solid var(--line)}.composer textarea{flex:1;min-height:52px;max-height:140px;resize:vertical;border:1px solid var(--line);border-radius:14px;padding:14px;background:var(--panel-2);color:#fff;font:inherit;line-height:1.45}.composer textarea::placeholder{color:rgba(245,247,250,.4)}.composer textarea:focus{outline:2px solid var(--warm);outline-offset:1px}.send{align-self:stretch;min-width:76px;border:0;border-radius:14px;background:#fff;color:#0b0e13;font:inherit;font-weight:800;cursor:pointer}.send:hover{background:var(--warm)}.send:disabled{opacity:.5;cursor:wait}
.brief{padding:20px;align-self:start;position:sticky;top:18px}.brief-top{display:flex;align-items:start;justify-content:space-between;gap:12px}.brief h2{margin:6px 0 0;font-size:1.45rem;letter-spacing:-.035em}.status{color:var(--warm);font-size:.72rem;text-align:right;white-space:nowrap}.brief-copy{margin:20px 0 16px;padding-bottom:16px;border-bottom:1px solid var(--line);color:var(--muted);font-size:.84rem;line-height:1.55}.brief-list{display:flex;flex-wrap:wrap;gap:8px;min-height:44px}.chip{color:#fff;background:rgba(245,199,139,.1);border-color:rgba(245,199,139,.28);cursor:default}.missing{margin:22px 0 0;padding:14px;border-radius:14px;background:rgba(255,255,255,.05);color:var(--muted);font-size:.82rem;line-height:1.55}.missing strong{display:block;color:#fff;margin-bottom:6px}.brief-actions{display:flex;gap:8px;margin-top:16px}.brief-action{flex:1;min-height:44px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-weight:750;cursor:pointer}.brief-action.primary{background:#fff;color:#0b0e13;border-color:#fff}.brief-action:hover{border-color:var(--warm)}.privacy{margin:16px 0 0;color:rgba(245,247,250,.4);font-size:.72rem;line-height:1.5}
@keyframes message-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:840px){.intro{display:block}.intro-note{max-width:none;margin-top:14px;text-align:left}.workspace{grid-template-columns:1fr}.brief{position:static}.chat{min-height:560px}}
@media(max-width:560px){.page{padding:18px 14px 28px}.top{margin-bottom:40px}.back{font-size:.78rem}.intro h1{font-size:clamp(2.8rem,15vw,4.8rem)}.progress-step{padding:9px 6px;font-size:.64rem}.progress-step span{font-size:.58rem}.chat-head,.messages,.quick,.composer{padding-left:14px;padding-right:14px}.message{max-width:92%;font-size:.91rem}.composer{align-items:stretch;flex-direction:column}.send{min-height:48px}.brief{padding:16px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.message{animation:none}}
</style></head><body><main class="page">
<header class="top"><a class="brand" href="/">YGG METRO</a><a class="back" href="/">กลับหน้าแรก ↗</a></header>
<section class="shell"><div class="intro"><div><div class="eyebrow">YGG METRO · SPECTRUMSALE</div><h1>เริ่มจาก<br>โจทย์ของคุณ</h1><p>เล่าสิ่งที่อยากทำมาได้เลย ไม่ต้องเตรียม brief ให้สมบูรณ์ก่อน</p></div><div class="intro-note">SPECTRUMSALE คือจุดรับโจทย์และจัดทิศทางเบื้องต้น ช่วยจับประเด็น ถามข้อมูลที่ขาด และสรุป brief ให้ตรวจสอบ</div></div>
<nav class="progress" aria-label="สถานะการรับ brief"><div class="progress-step active" data-stage="discover"><span>01</span>โจทย์</div><div class="progress-step" data-stage="audience"><span>02</span>ขอบเขต</div><div class="progress-step" data-stage="materials"><span>03</span>ข้อมูล</div><div class="progress-step" data-stage="summary"><span>04</span>สรุป</div></nav>
<div class="workspace"><section class="panel chat" aria-label="บทสนทนา SPECTRUMSALE"><div class="chat-head"><div><strong>คุยกับ SPECTRUMSALE</strong><br><small>ช่วยจัดโจทย์ให้พร้อมคุยงาน</small></div><button class="reset" id="reset" type="button">เริ่มใหม่</button></div><div id="messages" class="messages" aria-live="polite"></div><div id="quick" class="quick" aria-label="ตัวเลือกเริ่มต้น"></div><div class="brief-actions" style="padding:0 20px 14px"><button class="brief-action primary" id="confirm" type="button">ส่งรายละเอียดให้ทีม</button></div><form id="composer" class="composer"><textarea id="input" rows="1" maxlength="2000" placeholder="พิมพ์โจทย์ของคุณ เช่น อยากทำ company profile ประมาณ 12 หน้า" aria-label="ข้อความ brief"></textarea><button class="send" id="send" type="submit">ส่ง</button></form></section><div hidden aria-hidden="true"><span id="status"></span><div id="brief-list"></div><div id="missing"></div><button id="copy" type="button"></button></div></div></section></main>
<script>
const STORAGE_KEY='yggmetro-spectrumsale-v1';
const clientKey='yggmetro-spectrumsale-client-id-v1',conversationKey='yggmetro-spectrumsale-conversation-id-v1',briefKey='yggmetro-spectrumsale-brief-id-v1';
function stableId(storage,key,prefix){let id=storage.getItem(key);if(!id){id=prefix+'-'+crypto.randomUUID();storage.setItem(key,id)}return id}
const clientId=stableId(localStorage,clientKey,'CLIENT');
const conversationId=stableId(sessionStorage,conversationKey,'CONV');
const briefId=stableId(localStorage,briefKey,'BRIEF');
const JOB_LABELS={PROPOSAL:'Proposal',COMPANY_PROFILE:'Company Profile',PORTFOLIO_CASE_STUDY:'Portfolio Case Study',REPORT_SUMMARY:'Report Summary',OTHER:'งานเฉพาะทาง'};
const STAGES=['discover','audience','materials','summary'];
const defaultState={stage:'discover',jobType:null,package:null,pageCount:null,desiredDate:null,goal:'',audience:'',materials:'',deadlineText:'',confirmed:false,bridgeStatus:'PENDING',workId:null,workStatus:null,workCreated:false,messages:[]};
function loadState(){try{return {...defaultState,...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}}catch{return {...defaultState}}}
let state=loadState();
const messages=document.getElementById('messages'),quick=document.getElementById('quick'),input=document.getElementById('input'),send=document.getElementById('send'),status=document.getElementById('status'),briefList=document.getElementById('brief-list'),missing=document.getElementById('missing'),confirmButton=document.getElementById('confirm');
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function escapeHtml(value){return String(value||'').replace(/[&<>'"]/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[char]})}
function addMessage(role,text,saveState=true){state.messages.push({role,text});if(saveState)save();renderMessages();messages.scrollTop=messages.scrollHeight}
function renderMessages(){messages.innerHTML=state.messages.map(function(item){return '<div class="message '+escapeHtml(item.role)+'">'+escapeHtml(item.text)+'</div>'}).join('')}
function stageLabel(){return {discover:'กำลังเริ่ม',audience:'ถามขอบเขต',materials:'เก็บข้อมูล',summary:state.confirmed?'ยืนยันแล้ว':'พร้อมตรวจสอบ'}[state.stage]||'กำลังคุย'}
function renderProgress(){const current=STAGES.indexOf(state.stage);document.querySelectorAll('.progress-step').forEach(function(el){const index=STAGES.indexOf(el.dataset.stage);el.classList.toggle('active',index===current);el.classList.toggle('done',index<current||state.confirmed)})}
function getBriefItems(){const items=[];if(state.jobType)items.push(JOB_LABELS[state.jobType]||state.jobType);if(state.pageCount)items.push(state.pageCount+' หน้า');if(state.package)items.push('Package '+state.package);if(state.audience)items.push('ผู้ชม: '+state.audience);if(state.materials)items.push('มีข้อมูล/ไฟล์แล้ว');if(state.deadlineText)items.push('ใช้ภายใน: '+state.deadlineText);return items}
function renderBrief(){let label=state.workId?'WORK '+(state.workStatus||'OPEN'):state.bridgeStatus==='CONFIRMED'?'CONFIRMED':state.bridgeStatus==='DRAFT_SAVED'?'DRAFT SAVED':stageLabel();status.textContent=label;const items=getBriefItems();if(state.workId)items.push('Work ID: '+state.workId);briefList.innerHTML=items.length?items.map(function(item){return '<span class="chip">'+escapeHtml(item)+'</span>'}).join(''):'<span class="chip">ยังไม่มีข้อมูล</span>';let next='';if(!state.jobType)next='เล่าให้ฟังก่อนว่าอยากทำงานอะไร';else if(!state.audience)next='บอกเพิ่มว่างานนี้ทำเพื่อใคร หรืออยากให้คนดูทำอะไรต่อ';else if(!state.materials)next='ตอนนี้มีข้อมูลหรือไฟล์อะไรอยู่แล้วบ้าง';else if(!state.deadlineText)next='มีวันที่อยากใช้งานหรือ deadline ไหม';else if(state.workId)next='ส่งรายละเอียดแล้ว · ทีมจะรับช่วงต่อ';else next=state.confirmed?'ส่งรายละเอียดแล้ว':'ตรวจสอบข้อมูล แล้วส่งรายละเอียดให้ทีม';missing.innerHTML='<strong>'+(state.confirmed?'เรียบร้อย':'ขั้นต่อไป')+'</strong>'+escapeHtml(next);confirmButton.textContent=state.confirmed?'ส่งรายละเอียดแล้ว':'ส่งรายละเอียดให้ทีม';confirmButton.disabled=state.confirmed;renderProgress()}
function renderQuick(){const options=state.stage==='discover'?['Company Profile','Pitch Deck','หน้าเว็บ','มีไฟล์แล้ว แต่อยากจัดโครง']:state.stage==='summary'?['ข้อมูลถูกต้องแล้ว','ขอแก้ข้อมูล']:['อยากประเมินก่อน','ขอคุยกับคน'];quick.innerHTML=options.map(function(text){return '<button type="button" data-quick="'+escapeHtml(text)+'">'+escapeHtml(text)+'</button>'}).join('');quick.querySelectorAll('button').forEach(function(button){button.addEventListener('click',function(){submitText(button.dataset.quick)})})}
function render(){renderMessages();renderBrief();renderQuick();if(!state.messages.length)addMessage('assistant','สวัสดีครับ เล่าโจทย์ที่อยากทำมาได้เลย\\nเช่น อยากทำ Company Profile หรือ Pitch Deck สำหรับโปรเจกต์ใหม่',false)}
function advanceFromText(text,data){
  if(data&&(data.wantsManager||data.wantsEstimate||['PRICE','PRE_ESTIMATE','HELP'].includes(data.intent)))return;
  if(!state.goal)state.goal=text;
  if(data&&data.jobType)state.jobType=data.jobType;
  if(data&&data.package)state.package=data.package;
  if(data&&data.pageCount)state.pageCount=data.pageCount;
  if(data&&data.desiredDate)state.desiredDate=data.desiredDate;
  if(state.stage==='discover'){if(state.jobType)state.stage='audience'}
  else if(state.stage==='audience'){state.audience=text;state.stage='materials'}
  else if(state.stage==='materials'){state.materials=text;state.stage='timing'}
  else if(state.stage==='timing'){state.deadlineText=data&&data.desiredDate?data.desiredDate:text;state.stage='summary'}
}
function replyFor(data){
  if(data&&data.wantsManager){
    if(state.confirmed&&state.workId)return 'ได้ครับ ส่งรายละเอียดให้ทีมแล้ว ผมหยุดถามข้อมูลซ้ำไว้ตรงนี้ และให้ทีมรับช่วงต่อครับ';
    return 'ได้ครับ ถ้าต้องการคุยกับพนักงาน ผมจะไม่วนถามข้อมูลเดิมต่อ กด “ส่งรายละเอียดให้ทีม” แล้วทีมจะรับช่วงจากข้อมูลที่คุยกันไว้ครับ';
  }
  if(data&&data.wantsEstimate)return data.reply||'ได้ครับ ผมรับว่าอยากประเมินก่อน โดยจะไม่เดาราคาเอง เมื่อข้อมูลพอ กด “ส่งรายละเอียดให้ทีม” แล้วทีมจะรับไปประเมินต่อครับ';
  if(data&&typeof data.reply==='string'&&data.reply.trim())return data.reply.trim();
  if(state.stage==='discover')return 'อยากทำงานประเภทไหนครับ? เล่าเป็นประโยคสั้น ๆ ได้เลย';
  if(state.stage==='audience')return 'เข้าใจแล้วครับ งานนี้ทำเพื่อใคร หรืออยากให้คนดูทำอะไรต่อหลังเห็นงานนี้?';
  if(state.stage==='materials')return 'ดีครับ ตอนนี้มีข้อมูล ไฟล์เดิม หรือ reference อะไรอยู่แล้วบ้าง?';
  if(state.stage==='timing')return 'รับทราบครับ มีวันที่อยากใช้งานหรือ deadline ไหม ถ้ายังไม่มีก็บอกว่า “ยังไม่กำหนด” ได้';
  return 'จับโจทย์ได้แล้วครับ ตรวจสอบสรุปด้านขวา แล้วกดยืนยัน brief ได้เลย';
}
function briefBody(latestInterpretation){return {version:'1',briefId:briefId,clientId:clientId,conversationId:conversationId,status:state.confirmed?'CONFIRMED':'DRAFT',stage:state.stage,brief:{goal:state.goal,jobType:state.jobType,audience:state.audience,materials:state.materials,pageCount:state.pageCount,package:state.package,desiredDate:state.desiredDate,deadlineText:state.deadlineText},latestInterpretation:latestInterpretation||null,updatedAt:new Date().toISOString()}}
async function upsertBrief(latestInterpretation){const response=await fetch('/api/v1/brief/upsert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(briefBody(latestInterpretation))});const body=await response.json().catch(function(){return {}});if(!response.ok)throw new Error(body.code||'BRIEF_UPSERT_FAILED');state.bridgeStatus='DRAFT_SAVED';save();return body}
async function confirmBrief(){const response=await fetch('/api/v1/brief/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(briefBody(null))});const body=await response.json().catch(function(){return {}});if(!response.ok)throw new Error(body.code||'BRIEF_CONFIRM_FAILED');state.bridgeStatus='CONFIRMED';state.workId=body.workId||body.office?.workId||null;state.workStatus=body.work?.status||body.office?.work?.status||null;state.workCreated=Boolean(body.workCreated||body.office?.workCreated);save();return body}
async function submitText(text){text=String(text||'').trim();if(!text||send.disabled)return;addMessage('user',text);send.disabled=true;send.textContent='…';try{const response=await fetch('/api/v1/interpret',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({version:'1',clientId:clientId,conversationId:conversationId,text:text,context:{surface:'SPECTRUMSALE',stage:state.stage,jobType:state.jobType,package:state.package,confirmed:state.confirmed,workId:state.workId}})});const data=await response.json();if(!response.ok)throw new Error(data.code||'REQUEST_FAILED');advanceFromText(text,data);try{await upsertBrief(data)}catch(error){state.bridgeStatus='BRIDGE_PENDING';save()}addMessage('assistant',replyFor(data));save();renderBrief();renderQuick()}catch(error){addMessage('assistant','ตอนนี้ตอบข้อความนี้ไม่ได้ชั่วคราวครับ ลองส่งอีกครั้งได้เลย');}finally{send.disabled=false;send.textContent='ส่ง';input.focus()}}
document.getElementById('composer').addEventListener('submit',function(event){event.preventDefault();submitText(input.value);input.value=''})
input.addEventListener('keydown',function(event){if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();document.getElementById('composer').requestSubmit()}})
document.getElementById('reset').addEventListener('click',function(){localStorage.removeItem(STORAGE_KEY);state={...defaultState};render()})
document.getElementById('copy').addEventListener('click',async function(){const brief=['YGG METRO brief','ประเภทงาน: '+(JOB_LABELS[state.jobType]||'ยังไม่ระบุ'),'โจทย์: '+(state.goal||'ยังไม่ระบุ'),'ผู้ชม: '+(state.audience||'ยังไม่ระบุ'),'ข้อมูล/ไฟล์: '+(state.materials||'ยังไม่ระบุ'),'จำนวนหน้า: '+(state.pageCount||'ยังไม่ระบุ'),'กำหนดใช้: '+(state.deadlineText||'ยังไม่ระบุ')].join('\\n');try{await navigator.clipboard.writeText(brief);addMessage('assistant','คัดลอก brief ให้แล้วครับ นำไปส่งต่อให้ทีมได้เลย')}catch{addMessage('assistant',brief)}})
confirmButton.addEventListener('click',async function(){if(state.confirmed||confirmButton.disabled)return;confirmButton.disabled=true;confirmButton.textContent='กำลังส่ง…';try{await confirmBrief();state.confirmed=true;state.stage='summary';save();addMessage('assistant','ส่งรายละเอียดให้ทีมแล้วครับ เดี๋ยวทีมจะรับช่วงต่อจากข้อมูลที่คุยกันไว้');renderBrief();renderQuick()}catch(error){state.bridgeStatus='BRIDGE_PENDING';save();addMessage('assistant','ตอนนี้ยังส่งรายละเอียดไม่ได้ครับ ลองอีกครั้งอีกสักครู่');renderBrief()}finally{confirmButton.disabled=state.confirmed;confirmButton.textContent=state.confirmed?'ส่งรายละเอียดแล้ว':'ส่งรายละเอียดให้ทีม'}})
render();
</script></body></html>`;
}

const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>YGG METRO · Creative Service & Digital Asset Platform</title><meta name="description" content="YGG METRO คือแพลตฟอร์มสร้างสรรค์และหน้าร้านดิจิทัลสำหรับ presentation, visual systems, web experiences และ digital assets ช่วยเปลี่ยนไอเดีย ไฟล์ และ brief ที่ยังไม่เป็นรูปให้พร้อมใช้งานจริง"><link rel="canonical" href="https://yggmetro.com/">
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":"https://yggmetro.com/#organization","name":"YGG METRO","alternateName":"YGG METRO Shop","url":"https://yggmetro.com/","description":"YGG METRO is a standalone creative service and digital asset platform for presentations, visual systems, web experiences, templates and digital assets.","knowsAbout":["Presentation design","Brand and visual systems","Web experience design","Digital templates and assets"]},{"@type":"WebSite","@id":"https://yggmetro.com/#website","url":"https://yggmetro.com/","name":"YGG METRO","alternateName":"YGG METRO Shop","publisher":{"@id":"https://yggmetro.com/#organization"}},{"@type":"Service","@id":"https://yggmetro.com/#spectrum-intake","name":"SPECTRUMSALE project intake","serviceType":"Creative project consultation and intake","provider":{"@id":"https://yggmetro.com/#organization"},"url":"https://yggmetro.com/client","description":"SPECTRUMSALE is YGG METRO's official project-intake surface for turning loose ideas, files and unfinished briefs into a clear project direction."}]}
</script>
<style>
:root{color-scheme:dark;--ink:#f7f8fa;--muted:rgba(247,248,250,.68);--line:rgba(255,255,255,.16);--glass:rgba(10,15,22,.46);--warm:#f5c78b}
*{box-sizing:border-box}html{scroll-behavior:smooth}html,body{margin:0;min-height:100%}
body{min-height:100svh;color:var(--ink);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#090c10 url("https://raw.githubusercontent.com/pureekangraw-ops/yggmetro-web/main/home-bg.webp") center/cover fixed no-repeat}
body:before{content:"";position:fixed;inset:0;background:linear-gradient(180deg,rgba(3,7,12,.22) 0%,rgba(3,7,12,.34) 40%,rgba(3,7,12,.88) 100%);pointer-events:none}
body:after{content:"";position:fixed;inset:0;background:radial-gradient(circle at 78% 12%,rgba(245,199,139,.14),transparent 28%),radial-gradient(circle at 15% 70%,rgba(95,150,210,.12),transparent 32%);pointer-events:none}
.page{position:relative;z-index:1;overflow:hidden}.container{width:calc(100% - 40px);max-width:1180px;margin:0 auto}
.top{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:22px max(20px,calc((100% - 1180px)/2));gap:16px}
.brand{font-size:.72rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase;text-shadow:0 2px 18px #000}.topnav{display:flex;align-items:center;gap:18px}.topnav a{color:var(--muted);text-decoration:none;font-size:.86rem}.topnav a:hover,.topnav a:focus-visible{color:#fff}.shop{padding:9px 14px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(8,12,18,.3);backdrop-filter:blur(12px);font-size:.72rem;letter-spacing:.14em}
.hero{min-height:clamp(660px,92svh,900px);display:flex;align-items:flex-end;padding:120px 0 76px}.hero-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(260px,.55fr);gap:48px;align-items:end;width:100%}
.eyebrow{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--warm);font-weight:750}.hero h1{font-size:clamp(4rem,10vw,8.2rem);line-height:.82;letter-spacing:-.075em;margin:16px 0 22px;font-weight:850;text-wrap:balance}.hero-copy{max-width:560px}.hero-copy p{margin:0 0 26px;max-width:38rem;font-size:clamp(1rem,2.2vw,1.2rem);line-height:1.62;color:var(--muted)}
.actions{display:flex;flex-wrap:wrap;gap:10px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border-radius:14px;text-decoration:none;font-weight:750;border:1px solid transparent;transition:transform .2s ease,background .2s ease,border-color .2s ease}.button:hover{transform:translateY(-2px)}.button:focus-visible,.topnav a:focus-visible,.card:focus-visible{outline:3px solid var(--warm);outline-offset:3px}.primary{background:#fff;color:#0a0d11}.ghost{color:#fff;border-color:rgba(255,255,255,.3);background:rgba(8,12,18,.3);backdrop-filter:blur(10px)}
.hero-note{justify-self:end;max-width:280px;padding:18px 0 6px;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem;line-height:1.55}.hero-note strong{display:block;color:#fff;font-size:1rem;margin-bottom:8px}
.section{padding:82px 0}#services{position:relative;background:linear-gradient(180deg,rgba(5,10,24,.52),rgba(5,10,24,.64)),url("https://raw.githubusercontent.com/pureekangraw-ops/yggmetro-web/main/category-bg.webp") center/cover no-repeat;border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}#services .container{position:relative;z-index:1}.section-head{display:flex;align-items:end;justify-content:space-between;gap:28px;margin-bottom:26px}.section-head h2{margin:8px 0 0;font-size:clamp(2.1rem,5vw,4.1rem);line-height:.95;letter-spacing:-.06em}.section-head p{max-width:390px;margin:0;color:var(--muted);line-height:1.55;font-size:.96rem}
.service-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.card{display:flex;flex-direction:column;min-height:260px;padding:18px;border-radius:20px;border:1px solid var(--line);background:linear-gradient(145deg,rgba(255,255,255,.1),rgba(8,12,18,.62));backdrop-filter:blur(16px);color:#fff;text-decoration:none;position:relative;overflow:hidden}.card:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 90% 0%,rgba(245,199,139,.18),transparent 38%);pointer-events:none}.card>*{position:relative;z-index:1}.card small{letter-spacing:.16em;text-transform:uppercase;color:var(--warm);font-size:.68rem;font-weight:750}.card h3{margin:30px 0 8px;font-size:1.35rem;letter-spacing:-.035em}.card p{margin:0;color:var(--muted);font-size:.9rem;line-height:1.55}.card .go{margin-top:auto;padding-top:24px;font-size:.86rem;font-weight:750;color:#fff}
.process{display:grid;grid-template-columns:.8fr 1.2fr;gap:48px;align-items:start}.process-intro h2{margin:8px 0 16px;font-size:clamp(2.2rem,5vw,4rem);line-height:.96;letter-spacing:-.06em}.process-intro p{margin:0;max-width:360px;color:var(--muted);line-height:1.6}.steps{border-top:1px solid var(--line)}.step{display:grid;grid-template-columns:48px 1fr;gap:18px;padding:20px 0;border-bottom:1px solid var(--line)}.step-index{color:var(--warm);font-size:.76rem;letter-spacing:.12em;font-weight:800;padding-top:3px}.step h3{margin:0 0 6px;font-size:1.05rem}.step p{margin:0;color:var(--muted);font-size:.92rem;line-height:1.55}
.feature{padding:30px;border-radius:24px;border:1px solid var(--line);background:linear-gradient(120deg,rgba(245,199,139,.16),rgba(255,255,255,.05) 45%,rgba(8,12,18,.62));display:flex;align-items:end;justify-content:space-between;gap:30px}.feature h2{margin:8px 0 12px;font-size:clamp(2.1rem,5vw,4rem);line-height:.95;letter-spacing:-.06em}.feature p{margin:0;max-width:540px;color:var(--muted);line-height:1.58}.feature .button{flex:0 0 auto}
.foot{display:flex;justify-content:space-between;gap:20px;padding:34px 0 22px;color:rgba(255,255,255,.46);font-size:.76rem;border-top:1px solid var(--line)}
@media(max-width:900px){.hero-grid{grid-template-columns:1fr;gap:32px}.hero-note{justify-self:start;max-width:420px}.service-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.process{grid-template-columns:1fr;gap:34px}}
@media(max-width:640px){body{background-attachment:scroll;background-position:center}#services{background-position:center top}.container{width:min(100% - 32px,1180px)}.top{padding:18px 16px}.topnav a{display:none}.hero{min-height:720px;padding:112px 0 52px}.hero h1{font-size:clamp(3.2rem,16vw,5.5rem)}.section{padding:58px 0}.section-head{display:block}.section-head p{margin-top:12px}.service-grid{grid-template-columns:1fr}.card{min-height:190px}.process{gap:26px}.feature{display:block;padding:24px}.feature .button{margin-top:24px}.foot{display:block}.foot span{display:block;margin-top:8px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.button{transition:none}.button:hover{transform:none}}
</style></head>
<body><main class="page">
<header class="top"><a class="brand" href="/" aria-label="YGG METRO home">YGG METRO</a><nav class="topnav" aria-label="เมนูหลัก"><a href="#services">บริการ</a><a href="#process">วิธีทำงาน</a><a class="shop" href="/client">เริ่มคุยงาน</a></nav></header>
<section class="hero"><div class="container hero-grid"><div class="hero-copy"><div class="eyebrow">Creative service · digital assets</div><h1>ทำให้งาน<br>ไปต่อได้</h1><p>YGG METRO คือแพลตฟอร์มสร้างสรรค์และหน้าร้านดิจิทัลของเราเอง สำหรับ presentation, visual systems, web experiences และ digital assets — รับโจทย์ตั้งแต่ไอเดีย ไฟล์ หรือ brief ที่ยังไม่เป็นรูป แล้วช่วยทำให้พร้อมใช้งานจริง</p><div class="actions"><a class="button primary" href="/client">เริ่มคุยกับ SPECTRUMSALE</a><a class="button ghost" href="#services">ดูบริการ</a></div></div><aside class="hero-note"><strong>เริ่มจากสิ่งที่คุณมี</strong>เล่าโจทย์ ไฟล์ หรือสิ่งที่ยังจัดไม่ลงตัว แล้วให้เราเข้าไปช่วยจัดโครงให้ชัดขึ้น</aside></div></section>
<section id="services" class="section"><div class="container"><div class="section-head"><div><div class="eyebrow">What we make</div><h2>บริการที่พา<br>งานเดินหน้า</h2></div><p>เลือกจากปัญหาที่อยากแก้ แล้วส่งโจทย์ให้ SPECTRUMSALE ช่วยคัดทิศทางและพาเข้าสู่ workflow ที่เหมาะ</p></div><div class="service-grid">
<a class="card" href="/client"><small>01 · Presentation</small><h3>Company & Pitch</h3><p>จัดโครงเรื่อง ออกแบบสไลด์ และทำงานนำเสนอให้พร้อมใช้จริง</p><div class="go">เริ่มคุยงาน →</div></a>
<a class="card" href="/client"><small>02 · Visual</small><h3>Brand & Visual System</h3><p>วางทิศทางแบรนด์ งานภาพ และ visual language ให้ทั้งระบบไปทางเดียวกัน</p><div class="go">คุยเรื่องทิศทาง →</div></a>
<a class="card" href="/client"><small>03 · Digital</small><h3>Web Experience</h3><p>ออกแบบหน้าเว็บ เดโม และประสบการณ์ดิจิทัลที่เล่าเรื่องผ่านบรรยากาศ</p><div class="go">เริ่มวางหน้าเว็บ →</div></a>
<a class="card" href="/client"><small>04 · YGG Lab</small><h3>Templates & Assets</h3><p>เทมเพลต ธีม และของดาวน์โหลดจากงานทดลองของ YGG METRO</p><div class="go">ดูของที่กำลังทำ →</div></a>
</div></div></section>
<section id="process" class="section"><div class="container process"><div class="process-intro"><div class="eyebrow">How it works</div><h2>ไม่ต้องพร้อม<br>ตั้งแต่แรก</h2><p>ส่งสิ่งที่มีมาได้เลย เราจะช่วยแยกโจทย์และพาไปสู่รูปแบบงานที่คุยต่อได้ง่ายขึ้น</p></div><div class="steps"><div class="step"><div class="step-index">01</div><div><h3>เล่าโจทย์</h3><p>บอกว่าอยากทำอะไร มีข้อมูลหรือไฟล์อะไรอยู่แล้ว และติดตรงไหน</p></div></div><div class="step"><div class="step-index">02</div><div><h3>จัดทิศทาง</h3><p>SPECTRUMSALE คือ consultation และ project-intake layer ของ YGG METRO ช่วยจับประเภทงาน ขอบเขต และสิ่งที่ต้องตัดสินใจก่อนส่งต่อเข้าสู่ workflow ที่เหมาะ</p></div></div><div class="step"><div class="step-index">03</div><div><h3>คุยงานที่เหมาะ</h3><p>เมื่อภาพชัดขึ้น เราจึงค่อยเลือกวิธีทำงานและขยับไปสู่รายละเอียด</p></div></div></div></div></section>
<section class="section"><div class="container"><div class="feature"><div><div class="eyebrow">Selected work · YGG METRO</div><h2>มีโจทย์อยู่ในหัว<br>ให้เราช่วยจัดมัน</h2><p>เริ่มจากข้อความสั้น ๆ ก็ได้ ไม่ต้องเตรียม brief ให้สมบูรณ์ก่อน</p></div><a class="button primary" href="/client">คุยกับ SPECTRUMSALE</a></div></div></section>
<footer class="container foot"><span>YGG METRO · Creative Service & Digital Asset Platform</span><span>Presentation · Visual · Digital · YGG Lab</span></footer>
</main></body></html>`

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ok:true,service:"yggmetro-web",status:"READY",spectrumSaleConfigured:Boolean(env?.OPENAI_API_KEY)}, {headers:{"cache-control":"no-store"}});
    }
    if (url.pathname === "/api/v1/events") return handleSalesEvent(request,env);
    if (url.pathname === "/api/v1/interpret" || url.pathname === "/client/api/v1/interpret") {
      return handleGoClientInterpret(request, env);
    }
    if (url.pathname === "/api/v1/brief/upsert" || url.pathname === "/client/api/v1/brief/upsert") {
      return handleBriefUpsert(request, env);
    }
    if (url.pathname === "/api/v1/brief/confirm" || url.pathname === "/client/api/v1/brief/confirm") {
      return handleBriefConfirm(request, env);
    }
    if (url.pathname === "/client" || url.pathname === "/client/") {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed",{status:405,headers:{allow:"GET, HEAD"}});
      return new Response(request.method==="HEAD"?null:goClientPage().replace('</body>',salesObserverScript+'</body>'),{headers:{"content-type":"text/html; charset=utf-8","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin"}});
    }
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed",{status:405,headers:{allow:"GET, HEAD"}});
    return new Response(request.method==="HEAD"?null:html.replace('</body>',salesObserverScript+'</body>'),{headers:{"content-type":"text/html; charset=utf-8","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin"}});
  }
};
