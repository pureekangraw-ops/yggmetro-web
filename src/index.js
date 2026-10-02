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
<title>YGG METRO · Shop</title><meta name="description" content="YGG METRO — presentation, visual systems และ web experiences ที่พร้อมใช้งานจริง">
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
<section class="hero"><div class="container hero-grid"><div class="hero-copy"><div class="eyebrow">Creative systems · visual work</div><h1>ทำให้งาน<br>ไปต่อได้</h1><p>YGG METRO ช่วยเปลี่ยนโจทย์ที่ยังไม่เป็นรูป ให้กลายเป็น presentation, visual system และ web experience ที่พร้อมนำไปใช้จริง</p><div class="actions"><a class="button primary" href="/client">เริ่มคุยกับ GO Client</a><a class="button ghost" href="#services">ดูบริการ</a></div></div><aside class="hero-note"><strong>เริ่มจากสิ่งที่คุณมี</strong>เล่าโจทย์ ไฟล์ หรือสิ่งที่ยังจัดไม่ลงตัว แล้วให้เราเข้าไปช่วยจัดโครงให้ชัดขึ้น</aside></div></section>
<section id="services" class="section"><div class="container"><div class="section-head"><div><div class="eyebrow">What we make</div><h2>บริการที่พา<br>งานเดินหน้า</h2></div><p>เลือกจากปัญหาที่อยากแก้ แล้วคุยกับ GO Client เพื่อเริ่มต้นจากโจทย์จริงของคุณ</p></div><div class="service-grid">
<a class="card" href="/client"><small>01 · Presentation</small><h3>Company & Pitch</h3><p>จัดโครงเรื่อง ออกแบบสไลด์ และทำงานนำเสนอให้พร้อมใช้จริง</p><div class="go">เริ่มคุยงาน →</div></a>
<a class="card" href="/client"><small>02 · Visual</small><h3>Brand & Visual System</h3><p>วางทิศทางแบรนด์ งานภาพ และ visual language ให้ทั้งระบบไปทางเดียวกัน</p><div class="go">คุยเรื่องทิศทาง →</div></a>
<a class="card" href="/client"><small>03 · Digital</small><h3>Web Experience</h3><p>ออกแบบหน้าเว็บ เดโม และประสบการณ์ดิจิทัลที่เล่าเรื่องผ่านบรรยากาศ</p><div class="go">เริ่มวางหน้าเว็บ →</div></a>
<a class="card" href="/client"><small>04 · YGG Lab</small><h3>Templates & Assets</h3><p>เทมเพลต ธีม และของดาวน์โหลดจากงานทดลองของ YGG METRO</p><div class="go">ดูของที่กำลังทำ →</div></a>
</div></div></section>
<section id="process" class="section"><div class="container process"><div class="process-intro"><div class="eyebrow">How it works</div><h2>ไม่ต้องพร้อม<br>ตั้งแต่แรก</h2><p>ส่งสิ่งที่มีมาได้เลย เราจะช่วยแยกโจทย์และพาไปสู่รูปแบบงานที่คุยต่อได้ง่ายขึ้น</p></div><div class="steps"><div class="step"><div class="step-index">01</div><div><h3>เล่าโจทย์</h3><p>บอกว่าอยากทำอะไร มีข้อมูลหรือไฟล์อะไรอยู่แล้ว และติดตรงไหน</p></div></div><div class="step"><div class="step-index">02</div><div><h3>จัดทิศทาง</h3><p>GO Client ช่วยจับประเภทงาน ขอบเขต และสิ่งที่ต้องตัดสินใจก่อนเริ่ม</p></div></div><div class="step"><div class="step-index">03</div><div><h3>คุยงานที่เหมาะ</h3><p>เมื่อภาพชัดขึ้น เราจึงค่อยเลือกวิธีทำงานและขยับไปสู่รายละเอียด</p></div></div></div></div></section>
<section class="section"><div class="container"><div class="feature"><div><div class="eyebrow">Selected work · YGG METRO</div><h2>มีโจทย์อยู่ในหัว<br>ให้เราช่วยจัดมัน</h2><p>เริ่มจากข้อความสั้น ๆ ก็ได้ ไม่ต้องเตรียม brief ให้สมบูรณ์ก่อน</p></div><a class="button primary" href="/client">คุยกับ GO Client</a></div></div></section>
<footer class="container foot"><span>YGG METRO · Shop</span><span>Presentation · Visual · Digital · YGG Lab</span></footer>
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
