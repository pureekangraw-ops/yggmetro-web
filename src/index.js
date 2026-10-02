const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5.4-mini";
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const buckets = new Map();

const INTENTS = ["SERVICE","PRICE","INCLUDED","MATERIALS","REVISION","SCOPE_CHANGE","TIMELINE","PAGE_COUNT","OLD_FILE","UNORGANIZED_CONTENT","GRAPH_TABLE_DIAGRAM","PORTFOLIO","START","PRE_ESTIMATE","HELP","UNKNOWN"];
const JOB_TYPES = ["PROPOSAL","COMPANY_PROFILE","PORTFOLIO_CASE_STUDY","REPORT_SUMMARY","OTHER"];
const PACKAGES = ["STARTER","STANDARD","BUSINESS"];

const SYSTEM_PROMPT = `คุณเป็นตัวจำแนก intent สำหรับ GO Client ฝั่งรับงาน Presentation เท่านั้น
อ่านข้อความลูกค้าแล้วคืนเฉพาะ JSON ตาม schema ห้ามคิดราคาใหม่ ห้ามสร้างข้อเท็จจริง ห้ามคืน runtime/domain/command/mutation authority
อย่าเดา pageCount, desiredDate หรือ package ถ้าลูกค้าไม่ได้ระบุชัด
wantsEstimate=true เมื่อขอประเมินราคา/แพ็กเกจ/จำนวนหน้า/ระยะเวลา
wantsManager=true เมื่อขอคนช่วยโดยตรงหรือประเด็นต้องใช้ดุลยพินิจ
clientConfirmedComplete=true เมื่อบอกชัดว่าข้อมูลที่ส่งมาคือทั้งหมดที่มี
ถ้ายังไม่พอให้เลือก intent ให้ใช้ UNKNOWN`;

const SCHEMA = {
  type:"object", additionalProperties:false,
  properties:{
    intent:{type:"string",enum:INTENTS},
    jobType:{anyOf:[{type:"string",enum:JOB_TYPES},{type:"null"}]},
    package:{anyOf:[{type:"string",enum:PACKAGES},{type:"null"}]},
    pageCount:{anyOf:[{type:"integer",minimum:1,maximum:500},{type:"null"}]},
    desiredDate:{type:["string","null"]},
    wantsEstimate:{type:"boolean"},
    wantsManager:{type:"boolean"},
    clientConfirmedComplete:{type:"boolean"}
  },
  required:["intent","jobType","package","pageCount","desiredDate","wantsEstimate","wantsManager","clientConfirmedComplete"]
};

function json(data,status=200){return Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}})}
function clientKey(request){return request.headers.get("cf-connecting-ip")||"unknown"}
function rateLimited(request){
  const key=clientKey(request), now=Date.now();
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
  return ["stage","jobType","package"].map(k=>typeof context?.[k]==="string"?`${k}=${context[k].slice(0,40)}`:null).filter(Boolean).join("; ")||"none";
}
function validResult(x){
  return x&&typeof x==="object"&&!Array.isArray(x)&&INTENTS.includes(x.intent)&&
    (x.jobType===null||JOB_TYPES.includes(x.jobType))&&
    (x.package===null||PACKAGES.includes(x.package))&&
    (x.pageCount===null||(Number.isInteger(x.pageCount)&&x.pageCount>=1&&x.pageCount<=500))&&
    (x.desiredDate===null||typeof x.desiredDate==="string")&&
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
    text:{format:{type:"json_schema",name:"go_client_intent_v1",strict:true,schema:SCHEMA}}
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

  return json({...result,provider:"openai",model:MODEL});
}

function goClientPage(){
return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GO Client · YGG METRO</title><style>
body{margin:0;background:#0b0d10 url("https://raw.githubusercontent.com/pureekangraw-ops/yggmetro-web/main/home-bg.webp") center/cover fixed no-repeat;color:#f5f7fa;font-family:system-ui,-apple-system,sans-serif}.wrap{max-width:760px;margin:auto;padding:48px 20px}
.card{background:#151922;border:1px solid #2a313d;border-radius:18px;padding:22px}.tag{font-size:12px;letter-spacing:.16em;color:#93a0b5}
h1{font-size:clamp(2rem,8vw,4rem);margin:.35em 0}.log{min-height:180px;white-space:pre-wrap;background:#0f1218;border-radius:14px;padding:16px;margin:18px 0;color:#c8d0dc}
form{display:flex;gap:10px}input{flex:1;border:1px solid #343c49;background:#0f1218;color:white;border-radius:12px;padding:14px}button{border:0;border-radius:12px;padding:14px 18px;font-weight:700}
small{color:#8d98aa}.ok{color:#a7f3d0}.err{color:#fca5a5}</style></head>
<body><main class="wrap"><div class="card"><div class="tag">YGG METRO · GO CLIENT</div><h1>คุยกับ GO Client</h1>
<small>ข้อความถูกส่งไป YGG METRO Worker แล้วเรียก OpenAI จากฝั่งเซิร์ฟเวอร์เท่านั้น</small>
<div id="log" class="log">พร้อมรับข้อความ</div>
<form id="f"><input id="q" maxlength="2000" placeholder="เช่น อยากทำ company profile ประมาณ 12 หน้า"><button>ส่ง</button></form></div></main>
<script>
const f=document.getElementById("f"),q=document.getElementById("q"),log=document.getElementById("log");
f.addEventListener("submit",async e=>{e.preventDefault();const text=q.value.trim();if(!text)return;log.textContent="กำลังประมวลผล…";
try{const r=await fetch("/api/v1/interpret",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({version:"1",text,context:{surface:"GO_CLIENT"}})});
const data=await r.json();log.className="log "+(r.ok?"ok":"err");log.textContent=JSON.stringify(data,null,2)}
catch{log.className="log err";log.textContent="เชื่อมต่อไม่ได้"}})</script></body></html>`;
}


const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>YGG METRO · Shop</title><meta name="description" content="YGG METRO Shop">
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{min-height:100svh;color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#090c10 url("https://raw.githubusercontent.com/pureekangraw-ops/yggmetro-web/main/home-bg.webp") center/cover fixed no-repeat}
body:before{content:"";position:fixed;inset:0;background:linear-gradient(180deg,rgba(3,7,12,.16) 0%,rgba(3,7,12,.24) 45%,rgba(3,7,12,.72) 100%);pointer-events:none}
.page{position:relative;z-index:1;min-height:100svh;display:flex;flex-direction:column;padding:22px clamp(18px,4vw,56px)}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{font-size:.76rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;text-shadow:0 2px 18px #000}
.shop{padding:8px 12px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(8,12,18,.28);backdrop-filter:blur(10px);font-size:.72rem;letter-spacing:.14em}
.hero{margin-top:auto;padding:0 0 clamp(34px,8vh,84px);max-width:720px;text-shadow:0 2px 24px rgba(0,0,0,.7)}
.eyebrow{font-size:.78rem;letter-spacing:.18em;text-transform:uppercase;opacity:.78}
h1{font-size:clamp(3.2rem,14vw,8.6rem);line-height:.82;letter-spacing:-.065em;margin:.15em 0 .18em;font-weight:800}
p{margin:0 0 24px;max-width:34rem;font-size:clamp(.98rem,2.4vw,1.18rem);line-height:1.55;color:rgba(255,255,255,.82)}
.actions{display:flex;flex-wrap:wrap;gap:10px}
a{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border-radius:14px;text-decoration:none;font-weight:700}
.primary{background:#fff;color:#0a0d11}.ghost{color:#fff;border:1px solid rgba(255,255,255,.3);background:rgba(8,12,18,.28);backdrop-filter:blur(10px)}
@media(max-width:640px){body{background-attachment:scroll;background-position:center}.page{padding-top:18px}.hero{padding-bottom:34px}h1{font-size:clamp(3rem,18vw,5rem)}}
</style></head>
<body><main class="page">
<header class="top"><div class="brand">YGG METRO</div><div class="shop">SHOP</div></header>
<section class="hero"><div class="eyebrow">Creative systems · visual work</div><h1>YGG<br>METRO</h1>
<p>พื้นที่รวมงานและสิ่งที่เราสร้าง — ดูงานก่อน แล้วค่อยเข้ามาคุยกับ GO Client เมื่อต้องการเริ่มงาน</p>
<div class="actions"><a class="primary" href="/client">คุยกับ GO Client</a><a class="ghost" href="#work">ดูงาน</a></div>
</section>
<div id="work" aria-hidden="true"></div>
</main></body></html>`

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ok:true,service:"yggmetro-web",status:"READY",goClientConfigured:Boolean(env?.OPENAI_API_KEY)}, {headers:{"cache-control":"no-store"}});
    }
    if (url.pathname === "/api/v1/interpret" || url.pathname === "/client/api/v1/interpret") {
      return handleGoClientInterpret(request, env);
    }
    if (url.pathname === "/client" || url.pathname === "/client/") {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed",{status:405,headers:{allow:"GET, HEAD"}});
      return new Response(request.method==="HEAD"?null:goClientPage(),{headers:{"content-type":"text/html; charset=utf-8","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin"}});
    }
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed",{status:405,headers:{allow:"GET, HEAD"}});
    return new Response(request.method==="HEAD"?null:html,{headers:{"content-type":"text/html; charset=utf-8","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin"}});
  }
};
