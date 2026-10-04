const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5.4-mini";
const WHISPER_MODEL = "gpt-6-luna";
const TAKEOVER_MODEL = "gpt-6.1-sol";
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const buckets = new Map();

const INTENTS = ["SERVICE","PRICE","INCLUDED","MATERIALS","REVISION","SCOPE_CHANGE","TIMELINE","PAGE_COUNT","OLD_FILE","UNORGANIZED_CONTENT","GRAPH_TABLE_DIAGRAM","PORTFOLIO","START","PRE_ESTIMATE","HELP","UNKNOWN"];
const JOB_TYPES = ["PROPOSAL","COMPANY_PROFILE","PORTFOLIO_CASE_STUDY","REPORT_SUMMARY","BRAND_VISUAL_SYSTEM","WEB_EXPERIENCE","TEMPLATE_ASSET","OTHER"];
const PACKAGES = ["STARTER","STANDARD","BUSINESS"];

const SYSTEM_PROMPT = `คุณเป็น SPECTRUMSALE ฝั่งหน้าร้าน YGG METRO เป็นผู้ช่วยรับโจทย์และจัดทิศทางงานแบบสนทนาธรรมชาติ สำหรับ Presentation, Brand & Visual System, Web Experience และ Templates & Assets
ตอบข้อความล่าสุดของลูกค้าโดยตรง กระชับ เป็นธรรมชาติ และไม่พูดประโยคเดิมวนซ้ำ
ข้อมูลเกี่ยวกับตัวตน บริษัท ความสัมพันธ์กับองค์กรอื่น ช่องทางติดต่อ เบอร์ อีเมล ที่อยู่ หรือบริษัทแม่ ต้องใช้เฉพาะข้อมูลที่ YGG METRO กำหนดไว้ในบริบทนี้เท่านั้น: YGG METRO เป็นแพลตฟอร์ม/หน้าร้านของเราเอง และ SPECTRUMSALE เป็นจุดรับลูกค้าและเริ่มคุยงาน
ห้ามเชื่อม YGG METRO กับ Yggdrazil Group, ygg-cg.com, SET หรือองค์กรภายนอกใดเพียงเพราะชื่อคล้ายกัน หากไม่มีข้อมูลที่ YGG METRO กำหนดไว้ ให้ถือว่า UNKNOWN และอย่าแต่งเติม
ห้ามคิดราคาใหม่ ห้ามสร้างข้อเท็จจริง ห้ามอ้างว่ามีพนักงานกำลังคุยสดถ้ายังไม่ได้ส่งต่อจริง และห้ามเปิดเผยคำระบบภายใน เช่น runtime, domain, command, mutation authority, GO Hub, Work ID หรือ bridge ในคำตอบลูกค้า
ใช้ current_context เป็นเพียงบริบทจากหน้าร้าน เช่น serviceLine หรือ stage และห้ามถือว่าลูกค้ายืนยันข้อมูลที่ไม่ได้พูดเอง
เลือก jobType ให้ตรงที่สุด: งานแบรนด์/visual = BRAND_VISUAL_SYSTEM, งานเว็บ/interactive = WEB_EXPERIENCE, template/asset = TEMPLATE_ASSET; งาน presentation ใช้ประเภท presentation ที่มีอยู่
อย่าเดา pageCount, desiredDate หรือ package ถ้าลูกค้าไม่ได้ระบุชัด
wantsEstimate=true เมื่อขอประเมินราคา/แพ็กเกจ/จำนวนหน้า/ระยะเวลา
wantsManager=true เมื่อขอคุยกับพนักงาน คนจริง สำนักงาน ผู้จัดการ หรือประเด็นต้องใช้ดุลยพินิจ
clientConfirmedComplete=true เมื่อบอกชัดว่าข้อมูลที่ส่งมาคือทั้งหมดที่มี
ถ้าลูกค้าขอคุยกับคน ให้ reply ยืนยันตรง ๆ ว่าจะส่งรายละเอียดให้ทีมเมื่อกดยืนยัน และหยุดถามแบบฟอร์มเดิมซ้ำ
ถ้ายังไม่พอให้เลือก intent ให้ใช้ UNKNOWN
คืนเฉพาะ JSON ตาม schema`;

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

const WHISPER_SCHEMA={
  type:"object",additionalProperties:false,
  properties:{
    decision:{type:"string",enum:["SPECTRUM_RETRY","TEAM_HANDOFF","GO_TAKEOVER"]},
    focus:{type:"string",minLength:1,maxLength:240},
    nextQuestion:{type:["string","null"],maxLength:280},
    avoid:{type:"array",items:{type:"string",maxLength:160},maxItems:3}
  },
  required:["decision","focus","nextQuestion","avoid"]
};
const TAKEOVER_SCHEMA={
  type:"object",additionalProperties:false,
  properties:{
    reply:{type:"string",minLength:1,maxLength:500},
    focus:{type:"string",minLength:1,maxLength:240},
    resolved:{type:"boolean"}
  },
  required:["reply","focus","resolved"]
};
const WHISPER_SYSTEM=`คุณคือ GO ในโหมดกระซิบหลังบ้านของ SPECTRUMSALE ห้ามคุยกับลูกค้าโดยตรง
หน้าที่คืออ่าน brief และข้อความล่าสุดแบบสั้น แล้วช่วย SPECTRUM เดินต่อด้วยคำถามเดียวที่เจาะจุดค้าง
decision=SPECTRUM_RETRY เมื่อคำถามเดียวช่วยให้ SPECTRUM ไปต่อได้
decision=TEAM_HANDOFF เมื่อลูกค้ากดเรียกทีมและข้อมูลที่มีพอให้ทีมรับต่อโดยไม่ต้องใช้ GO ตัวเต็ม
decision=GO_TAKEOVER เฉพาะเมื่อจำเป็นต้องใช้ judgement จริง หรือ SPECTRUM กระซิบแล้วแต่ยังไปต่อไม่ได้
ห้ามถามข้อมูลที่มีแล้ว ห้ามเปิดเผยคำระบบ ห้ามคิดราคา และตอบเฉพาะ JSON ตาม schema`;
const TAKEOVER_SYSTEM=`คุณคือ GO ในโหมด takeover ชั่วคราวของหน้าร้าน YGG METRO
คุณเข้ามาเฉพาะเพื่อแก้ประเด็นค้าง ใช้บริบทที่ให้มา ถามหรืออธิบายเท่าที่จำเป็น ห้ามคุยยาว
ถ้าประเด็นคลี่คลายแล้ว resolved=true เพื่อคืนบทสนทนาให้ SPECTRUM/ทีมทันที
ห้ามคิดราคา ห้ามอ้างสถานะที่ตรวจไม่ได้ ห้ามเปิดเผยคำระบบภายใน และตอบเฉพาะ JSON ตาม schema`;

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
  const fields=["stage","serviceLine","jobType","package"].map(k=>typeof context?.[k]==="string"?`${k}=${context[k].slice(0,40)}`:null).filter(Boolean);
  if(typeof context?.confirmed==="boolean")fields.push("confirmed="+String(context.confirmed));
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

const PUBLIC_FORBIDDEN=/(?:\b(?:GO Hub|Work ID|bridge|runtime|checkpoint|mutation authority|CENTRE|HERMES|PIXIE|MIMIR|AION|Factory|handoff packet|internal route)\b|เวิร์ก\s*ไอดี|เช็กพอยต์|แบ็กเอนด์|รีจิสทรี|บริดจ์|รันไทม์|เส้นทางภายใน)/i;
const PUBLIC_TEMPLATE_LEAK=/(?:^|[\r\n])\s*(?:#{1,6}\s|```|[-=]{8,}\s*$)|(?:ข้อความสำหรับส่งให้|คัดลอกข้อความด้านล่าง|แบบฟอร์มบนหน้าเว็บไซต์|SYSTEM PROMPT|INTERNAL ONLY)/im;
const HUMAN_REQUEST=/(?:คุยกับ(?:คน|พนักงาน|เจ้าหน้าที่|ทีม)|ขอ(?:คน|พนักงาน|เจ้าหน้าที่)|คนจริง|พนักงาน|เจ้าหน้าที่|สำนักงาน|human|manager)/i;
const ESTIMATE_REQUEST=/(?:ประเมิน|ราคา|งบ|ใบเสนอราคา|quotation|quote|estimate|แพ็กเกจ)/i;
const PAYMENT_CLAIM=/(?:จ่าย(?:เงิน)?(?:ไป)?แล้ว|ชำระ(?:เงิน)?(?:ไป)?แล้ว|โอน(?:เงิน)?(?:ไป)?แล้ว|ตัดเงินแล้ว|payment\s*(?:done|paid)|paid\b)/i;
const COMPLAINT_REQUEST=/(?:ไม่พอใจ|ร้องเรียน|แย่มาก|ช้ามาก|ล่าช้า|ผิดหวัง|complain|complaint|refund|คืนเงิน)/i;
const IDENTITY_COLLISION=/(?:yggdrazil|ygg-cg\.com|ตลาดหลักทรัพย์|\bSET\b)/i;
function publicFallback(kind){
  if(kind==="human")return "ได้ครับ ผมจะหยุดถามข้อมูลซ้ำไว้ตรงนี้ คุณส่งรายละเอียดให้ทีมได้เลย แล้วทีมจะรับช่วงจากข้อมูลที่คุยกันไว้ครับ";
  if(kind==="estimate")return "ได้ครับ ผมรับว่าอยากประเมินก่อน โดยจะไม่เดาราคาเอง เมื่อข้อมูลพอให้ส่งรายละเอียดให้ทีมเพื่อประเมินจากข้อมูลจริงครับ";
  if(kind==="payment")return "รับทราบครับ เรื่องการชำระเงินต้องตรวจจากรายการจริงก่อน ตอนนี้ผมยังไม่ยืนยันสถานะการชำระเงินจากข้อความอย่างเดียวครับ";
  if(kind==="complaint")return "รับทราบครับ ผมจะไม่เถียงหรือเดาสาเหตุ ขอเก็บสิ่งที่กระทบคุณให้ชัด แล้วส่งต่อให้ทีมรับช่วงพร้อมบริบทที่มีอยู่ครับ";
  if(kind==="identity")return "ตอนนี้ YGG METRO ไม่มีข้อมูลยืนยันความเกี่ยวข้องกับองค์กรที่ชื่อนี้ครับ ผมจึงจะไม่เชื่อมโยงหรือเติมข้อมูลบริษัทจากแหล่งภายนอกเอง";
  return "รับทราบครับ ผมจะยึดข้อมูลที่ยืนยันได้และถามเฉพาะสิ่งที่จำเป็นต่อการเดินงานต่อ";
}
function safePublicReply(value,fallback){
  const reply=String(value||"").trim().slice(0,700);
  if(!reply||PUBLIC_FORBIDDEN.test(reply)||PUBLIC_TEMPLATE_LEAK.test(reply))return fallback;
  return reply;
}
export function applyConversationGuards(text,result={}){
  const input=String(text||"");
  const guarded={...result};
  let kind=null;
  if(IDENTITY_COLLISION.test(input)){kind="identity";guarded.intent="HELP";}
  else if(PAYMENT_CLAIM.test(input)){kind="payment";guarded.intent="HELP";guarded.wantsManager=true;}
  else if(COMPLAINT_REQUEST.test(input)){kind="complaint";guarded.intent="HELP";guarded.wantsManager=true;}
  else if(HUMAN_REQUEST.test(input)){kind="human";guarded.intent="HELP";guarded.wantsManager=true;}
  else if(ESTIMATE_REQUEST.test(input)){kind="estimate";guarded.wantsEstimate=true;if(guarded.intent==="UNKNOWN")guarded.intent="PRE_ESTIMATE";}
  const fallback=publicFallback(kind);
  guarded.reply=kind?fallback:safePublicReply(guarded.reply,fallback);
  guarded.reply=safePublicReply(guarded.reply,fallback);
  return guarded;
}
const handoffText=(value,max=1200)=>typeof value==="string"?value.trim().slice(0,max):"";
const handoffList=(value,maxItems=8,maxLen=500)=>Array.isArray(value)?value.slice(-maxItems).map(v=>handoffText(v,maxLen)).filter(Boolean):[];
export function buildHandoffPacket({briefId,clientId,conversationId,brief={},latestInterpretation=null,recentCustomerWords=[]}={}){
  const fields=["goal","jobType","audience","materials","deadlineText"];
  const missingFields=fields.filter(k=>!handoffText(brief?.[k],500));
  const confirmedFacts=fields.map(k=>[k,handoffText(brief?.[k],900)]).filter(([,v])=>v).map(([k,v])=>k+"="+v);
  const activeIntent=handoffText(latestInterpretation?.intent,80)||"UNKNOWN";
  const wantsManager=Boolean(latestInterpretation?.wantsManager);
  const wantsEstimate=Boolean(latestInterpretation?.wantsEstimate);
  return {
    version:"1",
    identity:{customerId:handoffText(clientId,160),conversationId:handoffText(conversationId,160),briefId:handoffText(briefId,160),workId:null},
    intent:{activeIntent,requestedResult:handoffText(brief?.goal,1200),customerWords:handoffList(recentCustomerWords),successDefinition:"ทีมรับช่วงได้โดยไม่ต้องให้ลูกค้าเล่าซ้ำ"},
    scope:{confirmedFacts,included:[],excluded:[],assumptions:[],missingFields,materialsReceived:handoffText(brief?.materials,1200)},
    commercial:{packageCandidate:handoffText(brief?.package,80)||null,priceSource:null,paymentClaim:"UNKNOWN",approvalRequired:wantsEstimate},
    operations:{riskClass:wantsManager?"HUMAN_HANDOFF":wantsEstimate?"COMMERCIAL_REVIEW":"STANDARD",ownerSource:"CENTRE_SPECTRUM_INTAKE",currentState:"CONFIRMED",checkpointId:null,holder:null,blocker:null,nextAction:"TEAM_REVIEW",promisedUpdateAt:null},
    evidence:{eventIds:[],receipts:[],readbackRefs:[],sourceUrls:[]},
    communication:{lastMessage:handoffList(recentCustomerWords,1,700)[0]||"",customerEmotion:"UNKNOWN",responseTone:"WARM_STRICT",whatNotToRepeat:confirmedFacts}
  };
}

function escalationText(value,max=1600){return typeof value==="string"?value.trim().slice(0,max):""}
function escalationMessages(value){
  return Array.isArray(value)?value.slice(-6).map(item=>({role:item?.role==="assistant"?"assistant":"user",text:escalationText(item?.text,700)})).filter(item=>item.text):[];
}
function escalationBrief(value={}){
  const brief=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  return Object.fromEntries(["goal","jobType","audience","materials","deadlineText","serviceLine"].map(k=>[k,escalationText(brief[k],500)]).filter(([,v])=>v));
}
async function reserveGoBudget(env,{clientId,conversationId,requestId,kind}){
  const result=await callBriefRegistry(env,"/internal/spectrum/go-budget",{clientId,conversationId,requestId,kind});
  if(!result.ok)return {ok:false,code:result.code,status:result.status};
  const budget=result.body||{};
  if(!budget.allowed)return {ok:false,code:budget.reason||"GO_BUDGET_BLOCKED",status:429,budget:budget.budget||null};
  if(budget.duplicate)return {ok:false,code:"GO_DUPLICATE_REQUEST",status:409,budget:budget.budget||null};
  return {ok:true,budget:budget.budget||null,duplicate:false};
}
async function callEscalationModel(env,{model,maxOutputTokens,system,schema,name,input}){
  if(typeof env?.OPENAI_API_KEY!=="string"||!env.OPENAI_API_KEY.trim())return {ok:false,code:"GO_NOT_CONFIGURED",status:503};
  let upstream;
  try{
    upstream=await fetch(OPENAI_RESPONSES_URL,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${env.OPENAI_API_KEY.trim()}`},body:JSON.stringify({model,store:false,max_output_tokens:maxOutputTokens,input:[{role:"system",content:system},{role:"user",content:input}],text:{format:{type:"json_schema",name,strict:true,schema}}})});
  }catch{return {ok:false,code:"PROVIDER_UNAVAILABLE",status:502}}
  if(!upstream.ok)return {ok:false,code:upstream.status===429?"PROVIDER_RATE_LIMITED":"PROVIDER_ERROR",status:502};
  const payload=await upstream.json().catch(()=>null),raw=outputText(payload);
  if(!raw)return {ok:false,code:"INVALID_PROVIDER_RESPONSE",status:502};
  try{return {ok:true,result:JSON.parse(raw)}}catch{return {ok:false,code:"INVALID_PROVIDER_RESPONSE",status:502}}
}
async function readEscalationRequest(request){
  let body;try{body=await request.json()}catch{return {error:json({ok:false,code:"INVALID_JSON"},400)}}
  const clientId=briefId(body?.clientId),conversationId=briefId(body?.conversationId),requestId=briefId(body?.requestId);
  if(!clientId||!conversationId||!requestId)return {error:json({ok:false,code:"GO_IDENTITY_REQUIRED"},400)};
  return {body,clientId,conversationId,requestId};
}
async function handleGoWhisper(request,env){
  if(request.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:{allow:"POST"}});
  if(rateLimited(request,"go-whisper"))return json({ok:false,code:"RATE_LIMITED"},429);
  const parsed=await readEscalationRequest(request);if(parsed.error)return parsed.error;
  const {body,clientId,conversationId,requestId}=parsed;
  const budget=await reserveGoBudget(env,{clientId,conversationId,requestId,kind:"WHISPER"});
  if(!budget.ok)return json({ok:false,code:budget.code,budget:budget.budget||null},budget.status);
  const reason=["SPECTRUM_CANNOT_PROGRESS","CUSTOMER_REQUESTS_TEAM"].includes(body?.reason)?body.reason:"SPECTRUM_CANNOT_PROGRESS";
  const input=JSON.stringify({reason,brief:escalationBrief(body?.brief),latest:escalationText(body?.text,1200),conversation:escalationMessages(body?.messages)});
  const model=await callEscalationModel(env,{model:WHISPER_MODEL,maxOutputTokens:140,system:WHISPER_SYSTEM,schema:WHISPER_SCHEMA,name:"go_whisper_v1",input});
  if(!model.ok)return json({ok:false,code:model.code},model.status);
  const out=model.result||{};
  if(!["SPECTRUM_RETRY","TEAM_HANDOFF","GO_TAKEOVER"].includes(out.decision)||typeof out.focus!=="string"||!Array.isArray(out.avoid))return json({ok:false,code:"INVALID_PROVIDER_RESPONSE"},502);
  const nextQuestion=out.nextQuestion==null?null:safePublicReply(out.nextQuestion,"ขอถามอีกนิดเพื่อให้ทีมรับช่วงได้ตรงจุดครับ");
  return json({ok:true,decision:out.decision,focus:escalationText(out.focus,240),nextQuestion,avoid:out.avoid.slice(0,3).map(v=>escalationText(v,160)).filter(Boolean),budget:budget.budget,model:WHISPER_MODEL});
}
async function handleGoTakeover(request,env){
  if(request.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:{allow:"POST"}});
  if(rateLimited(request,"go-takeover"))return json({ok:false,code:"RATE_LIMITED"},429);
  const parsed=await readEscalationRequest(request);if(parsed.error)return parsed.error;
  const {body,clientId,conversationId,requestId}=parsed;
  const budget=await reserveGoBudget(env,{clientId,conversationId,requestId,kind:"TAKEOVER"});
  if(!budget.ok)return json({ok:false,code:budget.code,budget:budget.budget||null},budget.status);
  const input=JSON.stringify({reason:escalationText(body?.reason,80),focus:escalationText(body?.focus,240),brief:escalationBrief(body?.brief),latest:escalationText(body?.text,1200),conversation:escalationMessages(body?.messages)});
  const model=await callEscalationModel(env,{model:TAKEOVER_MODEL,maxOutputTokens:220,system:TAKEOVER_SYSTEM,schema:TAKEOVER_SCHEMA,name:"go_takeover_v1",input});
  if(!model.ok)return json({ok:false,code:model.code},model.status);
  const out=model.result||{};
  if(typeof out.reply!=="string"||typeof out.focus!=="string"||typeof out.resolved!=="boolean")return json({ok:false,code:"INVALID_PROVIDER_RESPONSE"},502);
  return json({ok:true,reply:safePublicReply(out.reply,"ขอเก็บเฉพาะจุดที่ยังไม่ชัดอีกนิดครับ"),focus:escalationText(out.focus,240),resolved:out.resolved,budget:budget.budget,model:TAKEOVER_MODEL});
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
  result=applyConversationGuards(text,result);

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
    serviceLine:briefText(input.serviceLine,40),
    entryService:briefText(input.entryService,40),
    sourcePage:briefText(input.sourcePage,240).split(/[?#]/)[0],
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
const PAYMENT_STATUSES=new Set(["QUOTE_DRAFT","QUOTE_SENT","PAYMENT_PENDING","PAYMENT_CONFIRMED","PAYMENT_FAILED","REFUND_PENDING","REFUNDED","DISPUTED","UNKNOWN"]);
const CHECKOUT_INPUT_FIELDS=new Set(["customerId","quoteId","workId","idempotencyKey"]);
function safeCheckoutUrl(value){
  try{const url=new URL(String(value||""));return url.protocol==="https:"&&!url.username&&!url.password&&url.href.length<=2000?url.href:null}catch{return null}
}
function publicPaymentReadback(value={}){
  const source=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  const status=PAYMENT_STATUSES.has(source.status)?source.status:"UNKNOWN";
  const ownerSource=briefId(source.ownerSource),providerEventId=briefId(source.providerEventId);
  if(status==="PAYMENT_CONFIRMED"&&(ownerSource!=="PAYMENT_PROVIDER"||!providerEventId))return {error:"PAYMENT_EVIDENCE_REQUIRED"};
  const checkoutUrl=safeCheckoutUrl(source.checkoutUrl);
  if(status==="PAYMENT_PENDING"&&!checkoutUrl)return {error:"PAYMENT_CHECKOUT_INVALID"};
  return {value:{
    ok:true,
    paymentId:briefId(source.paymentId)||null,
    quoteId:briefId(source.quoteId)||null,
    workId:briefId(source.workId)||null,
    status,
    checkoutUrl,
    providerReference:briefId(source.providerReference)||null,
    ownerSource:ownerSource||null,
    providerEventId:providerEventId||null,
  }};
}
async function handlePaymentCheckout(request,env){
  if(request.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:{allow:"POST"}});
  if(rateLimited(request,"payment-checkout"))return json({ok:false,code:"RATE_LIMITED"},429);
  const raw=await request.text();if(raw.length>8192)return json({ok:false,code:"PAYLOAD_TOO_LARGE"},413);
  let body;try{body=JSON.parse(raw)}catch{return json({ok:false,code:"INVALID_JSON"},400)}
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(key=>!CHECKOUT_INPUT_FIELDS.has(key)))return json({ok:false,code:"PAYMENT_INPUT_FORBIDDEN"},400);
  const customerId=briefId(body.customerId),quoteId=briefId(body.quoteId),workId=briefId(body.workId),idempotencyKey=briefId(body.idempotencyKey);
  if(!customerId||!quoteId||!workId||!idempotencyKey)return json({ok:false,code:"PAYMENT_IDENTITY_REQUIRED"},400);
  const result=await callBriefRegistry(env,"/internal/payment/checkout",{version:"1",surface:"SPECTRUMSALE",customerId,quoteId,workId,idempotencyKey,requestedAt:new Date().toISOString()});
  if(!result.ok)return json({ok:false,code:result.code,quoteId,workId},result.status);
  const readback=publicPaymentReadback(result.body);
  if(readback.error)return json({ok:false,code:readback.error,quoteId,workId},502);
  return json(readback.value);
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
  const brief=briefObject(body?.brief);
  const handoff=buildHandoffPacket({briefId:id,clientId,conversationId,brief,latestInterpretation:body?.latestInterpretation,recentCustomerWords:body?.recentCustomerWords});
  const payload={version:"1",briefId:id,clientId,conversationId,surface:"SPECTRUMSALE",status:"CONFIRMED",stage:"summary",brief,handoff,confirmedAt:new Date().toISOString()};
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
<title>SPECTRUMSALE · YGG METRO</title><meta name="description" content="คุยกับ SPECTRUMSALE เพื่อจัดโจทย์และส่งรายละเอียดให้ทีม YGG METRO">
<style>
:root{color-scheme:dark;--bg:#080b10;--panel:rgba(18,24,34,.82);--panel-2:rgba(10,14,21,.78);--line:rgba(255,255,255,.13);--text:#f5f7fa;--muted:rgba(245,247,250,.64);--warm:#f5c78b;--green:#a7f3d0;--service-accent:#f5c78b;--service-glow:rgba(245,199,139,.22)}
*{box-sizing:border-box}html,body{margin:0;min-height:100%}body{min-height:100svh;color:var(--text);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg) url("https://raw.githubusercontent.com/pureekangraw-ops/yggmetro-web/main/home-bg.webp") center/cover fixed no-repeat}
body:before{content:"";position:fixed;inset:0;background:linear-gradient(180deg,rgba(4,8,14,.64),rgba(4,8,14,.9)),radial-gradient(circle at 78% 12%,rgba(245,199,139,.16),transparent 30%);pointer-events:none}.page{position:relative;z-index:1;min-height:100svh;padding:22px 20px 44px}.top{width:min(1180px,100%);margin:0 auto 52px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{color:#fff;text-decoration:none;font-size:.73rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase}.back{color:var(--muted);text-decoration:none;font-size:.84rem}.back:hover,.back:focus-visible{color:#fff}.shell{width:min(1180px,100%);margin:auto}.intro{display:flex;align-items:end;justify-content:space-between;gap:32px;margin-bottom:24px}.eyebrow{font-size:.7rem;letter-spacing:.19em;text-transform:uppercase;color:var(--warm);font-weight:800}.service-label{color:var(--service-accent);text-shadow:0 0 22px var(--service-glow)}.intro h1{margin:10px 0 10px;font-size:clamp(2.8rem,7vw,6.4rem);line-height:1.02;letter-spacing:-.055em}.intro p{max-width:480px;margin:0;color:var(--muted);line-height:1.6}.intro-note{max-width:220px;color:var(--muted);font-size:.84rem;line-height:1.5;text-align:right}.progress{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:16px;min-width:0;max-width:100%}.progress-step{padding:10px 12px;border-top:1px solid var(--line);color:rgba(245,247,250,.38);font-size:.72rem;letter-spacing:.06em;transition:border-color .25s ease,color .25s ease,background .25s ease}.progress-step span{display:block;font-size:.64rem;color:rgba(245,247,250,.38);margin-bottom:4px}.progress-step.active{border-color:var(--service-accent);color:#fff;background:linear-gradient(90deg,var(--service-glow),transparent 70%)}.progress-step.active span{color:var(--service-accent)}.progress-step.done{color:rgba(245,247,250,.7);border-color:rgba(167,243,208,.6)}
.workspace{display:block;min-width:0;max-width:100%}.chat{width:min(900px,100%);max-width:100%;min-width:0;margin:0 auto}.panel{border:1px solid var(--line);background:var(--panel);backdrop-filter:blur(18px);border-radius:22px;box-shadow:0 18px 60px rgba(0,0,0,.22)}.chat{height:560px;min-height:0;max-height:70dvh;display:flex;flex-direction:column;overflow:hidden}.chat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid var(--line)}.chat-head strong{font-size:.94rem}.chat-head small{color:var(--muted)}.reset{border:0;background:transparent;color:var(--muted);font:inherit;font-size:.78rem;cursor:pointer}.reset:hover{color:#fff}.messages{flex:1 1 auto;min-height:0;padding:22px 20px;display:flex;flex-direction:column;gap:14px;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable}.message{max-width:min(82%,620px);padding:14px 16px;border-radius:17px;line-height:1.58;font-size:.95rem;white-space:pre-wrap;animation:message-in .35s cubic-bezier(.22,1,.36,1) both}.message.assistant{align-self:flex-start;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-top-left-radius:6px}.message.user{align-self:flex-end;background:#fff;color:#0b0e13;border-top-right-radius:6px}.message.error{color:#fecaca;border-color:rgba(248,113,113,.35)}.quick{display:flex;flex-wrap:wrap;gap:8px;padding:0 20px 14px}.quick button,.chip{border:1px solid var(--line);border-radius:999px;padding:8px 12px;color:var(--muted);background:rgba(255,255,255,.05);font:inherit;font-size:.78rem;cursor:pointer}.quick button:hover,.quick button:focus-visible{border-color:var(--service-accent);color:#fff;background:var(--service-glow)}.composer{display:flex;gap:10px;padding:14px 20px 20px;border-top:1px solid var(--line);min-width:0}.composer textarea{flex:1;min-width:0;min-height:52px;max-height:140px;resize:vertical;border:1px solid var(--line);border-radius:14px;padding:14px;background:var(--panel-2);color:#fff;font:inherit;line-height:1.45}.composer textarea::placeholder{color:rgba(245,247,250,.4)}.composer textarea:focus{outline:2px solid var(--warm);outline-offset:1px}.send{align-self:stretch;min-width:76px;border:0;border-radius:14px;background:#fff;color:#0b0e13;font:inherit;font-weight:800;cursor:pointer}.send:hover{background:var(--warm)}.send:disabled{opacity:.5;cursor:wait}
.brief{padding:20px;align-self:start;position:sticky;top:18px}.brief-top{display:flex;align-items:start;justify-content:space-between;gap:12px}.brief h2{margin:6px 0 0;font-size:1.45rem;letter-spacing:-.035em}.status{color:var(--service-accent);font-size:.72rem;text-align:right;white-space:nowrap}.brief-copy{margin:20px 0 16px;padding-bottom:16px;border-bottom:1px solid var(--line);color:var(--muted);font-size:.84rem;line-height:1.55}.brief-list{display:flex;flex-wrap:wrap;gap:8px;min-height:44px}.chip{color:#fff;background:var(--service-glow);border-color:rgba(255,255,255,.22);cursor:default}.missing{margin:22px 0 0;padding:14px;border-radius:14px;background:rgba(255,255,255,.05);color:var(--muted);font-size:.82rem;line-height:1.55}.missing strong{display:block;color:#fff;margin-bottom:6px}.brief-actions{display:flex;gap:8px;margin-top:16px;justify-content:flex-end;min-width:0}.brief-action{flex:0 0 auto;min-height:44px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-weight:750;cursor:pointer}.brief-action.primary{background:#fff;color:#0b0e13;border-color:#fff}.brief-action:hover{border-color:var(--service-accent)}.privacy{margin:16px 0 0;color:rgba(245,247,250,.4);font-size:.72rem;line-height:1.5}
@keyframes message-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.step{transition:transform .25s ease,border-color .25s ease}.step:hover{transform:translateX(6px);border-color:var(--service-accent)}.service-hint{display:inline-flex;align-items:center;gap:8px;margin-top:14px;padding:7px 10px;border:1px solid rgba(255,255,255,.18);border-radius:999px;color:var(--service-accent);font-size:.74rem;letter-spacing:.04em}
@media(max-width:840px){.intro{display:block}.intro-note{max-width:none;margin-top:14px;text-align:left}.workspace{grid-template-columns:1fr}.brief{position:static}.chat{height:520px;max-height:68dvh;min-height:0}}
@media(max-width:560px){html,body{overflow-x:hidden}.page{padding:16px 12px 24px;overflow-x:hidden}.shell,.workspace,.chat,.panel{width:100%;max-width:100%;min-width:0}.top{margin-bottom:22px}.back{font-size:.76rem}.intro{margin-bottom:14px}.intro h1{font-size:clamp(2.5rem,13.5vw,4.2rem);line-height:.98}.intro p,.intro-note{font-size:.8rem;line-height:1.42}.progress{margin-bottom:10px;gap:4px}.progress-step{min-width:0;padding:8px 3px;font-size:.58rem;letter-spacing:0;text-align:center;overflow:hidden;text-overflow:ellipsis}.progress-step span{font-size:.54rem}.chat{height:clamp(360px,56dvh,500px);min-height:0;max-height:500px;border-radius:18px}.chat-head,.messages,.quick,.composer{padding-left:12px;padding-right:12px}.chat-head{padding-top:12px;padding-bottom:10px;min-width:0}.chat-head>div{min-width:0}.chat-head strong{font-size:.88rem}.chat-head small{font-size:.72rem}.messages{flex:1 1 auto;min-height:0;max-height:none;padding-top:12px;padding-bottom:12px}.message{max-width:90%;font-size:.89rem;padding:12px 13px}.quick{flex-wrap:nowrap;overflow-x:auto;padding-bottom:8px;scrollbar-width:none}.quick::-webkit-scrollbar{display:none}.quick button{white-space:nowrap;flex:0 0 auto}.brief-actions{padding:0 12px 8px!important;margin-top:0;justify-content:flex-end}.brief-action{min-height:34px;padding:0 11px;border-radius:999px;font-size:.74rem;font-weight:650}.brief-action.primary{background:rgba(255,255,255,.07);color:var(--muted);border-color:var(--line)}.composer{padding-top:9px;padding-bottom:12px;align-items:stretch;flex-direction:row}.composer textarea{min-height:44px;max-height:96px;padding:11px 12px}.send{min-width:54px;min-height:44px}.brief{padding:14px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.message{animation:none}}
</style></head><body><main class="page">
<header class="top"><a class="brand" href="/">YGG METRO</a><a class="back" href="/">กลับหน้าแรก ↗</a></header>
<section class="shell"><div class="intro"><div><div class="eyebrow">YGG METRO · SPECTRUMSALE · <span id="service-context" class="service-label">INTAKE</span></div><h1>เริ่มจาก<br>โจทย์ของคุณ</h1><p>เล่าสิ่งที่อยากทำมาได้เลย ไม่ต้องเตรียม brief ให้สมบูรณ์ก่อน</p><span id="service-hint" class="service-hint">เริ่มจากโจทย์จริงของคุณ</span></div><div class="intro-note">SPECTRUMSALE จะช่วยจับประเด็น ถามเท่าที่จำเป็น และจัดรายละเอียดให้พร้อมส่งต่อทีม</div></div>
<nav class="progress" aria-label="สถานะการรับ brief"><div class="progress-step active" data-stage="discover"><span>01</span>โจทย์</div><div class="progress-step" data-stage="audience"><span>02</span>คนดู</div><div class="progress-step" data-stage="materials"><span>03</span>ของที่มี</div><div class="progress-step" data-stage="timing"><span>04</span>เวลา</div><div class="progress-step" data-stage="summary"><span>05</span>สรุป</div></nav>
<div class="workspace"><section class="panel chat" aria-label="บทสนทนา SPECTRUMSALE"><div class="chat-head"><div><strong>คุยกับ SPECTRUMSALE</strong><br><small>เล่าโจทย์มาได้เลย เดี๋ยวช่วยจัดให้</small></div><button class="reset" id="reset" type="button">เริ่มใหม่</button></div><div id="messages" class="messages" aria-live="polite"></div><div id="quick" class="quick" aria-label="ตัวเลือกเริ่มต้น"></div><div class="brief-actions" style="padding:0 20px 14px"><button class="brief-action primary" id="confirm" type="button">ส่งรายละเอียดให้ทีม</button></div><form id="composer" class="composer"><textarea id="input" rows="1" maxlength="2000" placeholder="พิมพ์โจทย์ของคุณ เช่น อยากทำ company profile ประมาณ 12 หน้า" aria-label="ข้อความ brief"></textarea><button class="send" id="send" type="submit">ส่ง</button></form></section><div hidden aria-hidden="true"><span id="status"></span><div id="brief-list"></div><div id="missing"></div><button id="copy" type="button"></button></div></div></section></main>
<script>
const STORAGE_KEY='yggmetro-spectrumsale-v1';
const clientKey='yggmetro-spectrumsale-client-id-v1',conversationKey='yggmetro-spectrumsale-conversation-id-v1',briefKey='yggmetro-spectrumsale-brief-id-v1';
function stableId(storage,key,prefix){let id=storage.getItem(key);if(!id){id=prefix+'-'+crypto.randomUUID();storage.setItem(key,id)}return id}
const clientId=stableId(localStorage,clientKey,'CLIENT');
const conversationId=stableId(sessionStorage,conversationKey,'CONV');
const briefId=stableId(localStorage,briefKey,'BRIEF');
const JOB_LABELS={PROPOSAL:'Proposal',COMPANY_PROFILE:'Company Profile',PORTFOLIO_CASE_STUDY:'Portfolio Case Study',REPORT_SUMMARY:'Report Summary',BRAND_VISUAL_SYSTEM:'Brand & Visual System',WEB_EXPERIENCE:'Web Experience',TEMPLATE_ASSET:'Template / Asset',OTHER:'งานเฉพาะทาง'};
const SERVICE_ENTRY={
 presentation:{serviceLine:'PRESENTATION',label:'Presentation · Company & Pitch',opening:'เห็นว่าคุณเข้ามาจากงาน Presentation ครับ เล่าได้เลยว่าเป็น Company Profile, Pitch, Proposal หรือไฟล์เดิมที่อยากให้จัดใหม่',quick:['Company Profile','Pitch Deck','Proposal','มีไฟล์เดิม อยากจัดโครงใหม่']},
 visual:{serviceLine:'VISUAL',label:'Brand & Visual System',opening:'เห็นว่าคุณสนใจ Brand & Visual System ครับ เล่าได้เลยว่าตอนนี้แบรนด์ติดตรงไหน หรืออยากวางภาพรวมใหม่แค่ไหน',quick:['อยากวาง Visual Direction','มีแบรนด์เดิม แต่อยากจัดระบบ','ทำ Brand System ใหม่','มี reference แล้ว']},
 digital:{serviceLine:'DIGITAL',label:'Web Experience',opening:'เห็นว่าคุณสนใจงาน Web Experience ครับ เล่าได้เลยว่าเว็บนี้ต้องทำหน้าที่อะไร และตอนนี้มีของเดิมหรือยัง',quick:['ทำเว็บไซต์ใหม่','ปรับเว็บเดิม','Landing Page / Demo','มีดีไซน์แล้ว อยากทำต่อ']},
 lab:{serviceLine:'YGG_LAB',label:'Templates & Assets',opening:'เห็นว่าคุณสนใจ YGG Lab ครับ บอกได้เลยว่าต้องการ template, theme หรือ asset แบบไหน และจะเอาไปใช้กับงานอะไร',quick:['Presentation Template','Visual Asset','Web Theme','อยากดูของที่เหมาะกับงาน']}
};
const STAGES=['discover','audience','materials','timing','summary'];
const params=new URLSearchParams(location.search),entryService=String(params.get('service')||'').toLowerCase(),entry=SERVICE_ENTRY[entryService]||null;
const defaultState={stage:'discover',serviceLine:entry?.serviceLine||null,entryService:entryService||null,sourcePage:location.pathname,jobType:null,package:null,pageCount:null,desiredDate:null,goal:'',audience:'',materials:'',deadlineText:'',confirmed:false,bridgeStatus:'PENDING',workId:null,workStatus:null,workCreated:false,whisperCount:0,stuckCount:0,goActive:false,goTurns:0,goFocus:'',teamRequestPending:false,messages:[]};
function loadState(){try{return {...defaultState,...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}}catch{return {...defaultState}}}
let state=loadState();
const activeServiceLine=entry?.serviceLine||'INTAKE';
if(state.entryService!==entryService){state={...defaultState,messages:[]};save()}
document.documentElement.style.setProperty('--service-accent',entry?.serviceLine==='VISUAL'?'#9b87ff':entry?.serviceLine==='DIGITAL'?'#4da3ff':entry?.serviceLine==='YGG_LAB'?'#65d6c2':'#f5c78b');
document.documentElement.style.setProperty('--service-glow',entry?.serviceLine==='VISUAL'?'rgba(155,135,255,.22)':entry?.serviceLine==='DIGITAL'?'rgba(77,163,255,.22)':entry?.serviceLine==='YGG_LAB'?'rgba(101,214,194,.22)':'rgba(245,199,139,.22)');
document.getElementById('service-context').textContent=activeServiceLine;
document.getElementById('service-hint').textContent=entry?.label||'เล่าโจทย์มาได้เลย เดี๋ยวช่วยจัดให้';
const messages=document.getElementById('messages'),quick=document.getElementById('quick'),input=document.getElementById('input'),send=document.getElementById('send'),status=document.getElementById('status'),briefList=document.getElementById('brief-list'),missing=document.getElementById('missing'),confirmButton=document.getElementById('confirm');
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function escapeHtml(value){return String(value||'').replace(/[&<>'"]/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[char]})}
function scrollToLatest(){requestAnimationFrame(function(){messages.scrollTop=messages.scrollHeight})}
function addMessage(role,text,saveState=true){state.messages.push({role,text});if(saveState)save();renderMessages();scrollToLatest()}
function renderMessages(){messages.innerHTML=state.messages.map(function(item){return '<div class="message '+escapeHtml(item.role)+'">'+escapeHtml(item.text)+'</div>'}).join('')}
function stageLabel(){return {discover:'กำลังเริ่ม',audience:'ถามคนดู',materials:'เก็บข้อมูล',timing:'ถามเวลา',summary:state.confirmed?'ยืนยันแล้ว':'พร้อมตรวจสอบ'}[state.stage]||'กำลังคุย'}
function renderProgress(){const current=STAGES.indexOf(state.stage);document.querySelectorAll('.progress-step').forEach(function(el){const index=STAGES.indexOf(el.dataset.stage);el.classList.toggle('active',index===current);el.classList.toggle('done',index<current||state.confirmed)})}
function getBriefItems(){const items=[];if(state.serviceLine)items.push('บริการ: '+state.serviceLine);if(state.jobType)items.push(JOB_LABELS[state.jobType]||state.jobType);if(state.pageCount)items.push(state.pageCount+' หน้า');if(state.package)items.push('Package '+state.package);if(state.audience)items.push('ผู้ชม: '+state.audience);if(state.materials)items.push('มีข้อมูล/ไฟล์แล้ว');if(state.deadlineText)items.push('ใช้ภายใน: '+state.deadlineText);return items}
function renderBrief(){
  status.textContent='';
  const items=getBriefItems();
  briefList.innerHTML=items.length?items.map(function(item){return '<span class="chip">'+escapeHtml(item)+'</span>'}).join(''):'';
  missing.textContent='';
  const showTeam=state.confirmed||state.teamRequestPending||state.stage==='summary'||Boolean(state.lastInterpretation?.wantsManager)||state.messages.some(function(m){return m.role==='user'&&/(?:ขอคุยกับ|คุยกับทีม|คุยกับคน|เรียกทีม|พนักงาน|เจ้าหน้าที่|คนจริง)/i.test(m.text)});
  confirmButton.closest('.brief-actions').hidden=!showTeam;
  confirmButton.textContent=state.confirmed?'ส่งแล้ว':state.teamRequestPending?'กำลังเรียกทีม…':'คุยกับทีม';
  confirmButton.disabled=state.confirmed||state.teamRequestPending;
  renderProgress()
}
function renderQuick(){const options=state.stage==='discover'?(entry?.quick||['Company Profile','Brand / Visual','หน้าเว็บ','Template / Asset']):state.stage==='summary'?['ข้อมูลถูกต้องแล้ว','ขอแก้ข้อมูล']:['อยากประเมินก่อน','ขอคุยกับคน'];quick.innerHTML=options.map(function(text){return '<button type="button" data-quick="'+escapeHtml(text)+'">'+escapeHtml(text)+'</button>'}).join('');quick.querySelectorAll('button').forEach(function(button){button.addEventListener('click',function(){submitText(button.dataset.quick)})})}
function render(){renderMessages();renderBrief();renderQuick();if(!state.messages.length)addMessage('assistant',entry?.opening||'สวัสดีครับ ผม SPECTRUMSALE เล่าโจทย์ที่อยากทำมาได้เลย\\nจะเป็น Presentation, Brand & Visual, Web Experience หรือ Template / Asset ก็ได้',false)}
function advanceFromText(text,data){
  if(data&&(data.wantsManager||data.wantsEstimate||['PRICE','PRE_ESTIMATE','HELP'].includes(data.intent)))return;
  if(!state.goal)state.goal=text;
  if(data&&data.jobType)state.jobType=data.jobType;
  if(!state.serviceLine&&data&&data.jobType){state.serviceLine=data.jobType==='BRAND_VISUAL_SYSTEM'?'VISUAL':data.jobType==='WEB_EXPERIENCE'?'DIGITAL':data.jobType==='TEMPLATE_ASSET'?'YGG_LAB':'PRESENTATION'}
  if(data&&data.package)state.package=data.package;
  if(data&&data.pageCount)state.pageCount=data.pageCount;
  if(data&&data.desiredDate)state.desiredDate=data.desiredDate;
  if(state.stage==='discover'){if(state.jobType)state.stage='audience'}
  else if(state.stage==='audience'){state.audience=text;state.stage='materials'}
  else if(state.stage==='materials'){state.materials=text;state.stage='timing'}
  else if(state.stage==='timing'){state.deadlineText=data&&data.desiredDate?data.desiredDate:text;state.stage='summary'}
}
function replyFor(data){
  if(data?.wantsManager){
    return state.confirmed?'ได้ครับ ทีมรับช่วงต่อจากข้อมูลที่คุยกันไว้แล้ว':'ได้ครับ ถ้าอยากคุยกับทีม กด “คุยกับทีม” ได้เลย ผมจะส่งต่อจากที่คุยกันไว้ ไม่ให้เล่าใหม่ครับ';
  }
  if(data?.wantsEstimate)return data.reply||'ได้ครับ ถ้าอยากให้ทีมประเมินต่อ เดี๋ยวผมส่งสิ่งที่คุยกันไว้ให้ครับ';
  if(typeof data?.reply==='string'&&data.reply.trim())return data.reply.trim();
  if(state.stage==='discover')return 'อยากทำงานประเภทไหนครับ? เล่าเป็นประโยคสั้น ๆ ได้เลย';
  if(state.stage==='audience')return 'โอเคครับ งานนี้อยากให้ใครเป็นคนเห็นหรือใช้งานเป็นหลัก?';
  if(state.stage==='materials')return 'ตอนนี้มีไฟล์เดิม ข้อมูล หรือภาพอ้างอิงอะไรอยู่แล้วบ้างครับ?';
  if(state.stage==='timing')return 'อยากใช้ประมาณเมื่อไหร่ครับ ถ้ายังไม่รีบก็บอกว่า “ยังไม่กำหนด” ได้เลย';
  return 'รายละเอียดพอเห็นภาพแล้วครับ ถ้ามีอะไรอยากเพิ่มพิมพ์ต่อได้เลย หรือคุยกับทีมต่อได้ครับ';
}
function briefBody(latestInterpretation){return {version:'1',briefId:briefId,clientId:clientId,conversationId:conversationId,status:state.confirmed?'CONFIRMED':'DRAFT',stage:state.stage,brief:{goal:state.goal,serviceLine:state.serviceLine,entryService:state.entryService,sourcePage:state.sourcePage,jobType:state.jobType,audience:state.audience,materials:state.materials,pageCount:state.pageCount,package:state.package,desiredDate:state.desiredDate,deadlineText:state.deadlineText},latestInterpretation:latestInterpretation||state.lastInterpretation||null,recentCustomerWords:state.messages.filter(function(m){return m.role==='user'}).slice(-5).map(function(m){return m.text}),updatedAt:new Date().toISOString()}}
async function upsertBrief(latestInterpretation){const response=await fetch('/api/v1/brief/upsert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(briefBody(latestInterpretation))});const body=await response.json().catch(function(){return {}});if(!response.ok)throw new Error(body.code||'BRIEF_UPSERT_FAILED');state.bridgeStatus='DRAFT_SAVED';save();return body}
async function confirmBrief(){const response=await fetch('/api/v1/brief/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(briefBody(state.lastInterpretation))});const body=await response.json().catch(function(){return {}});if(!response.ok)throw new Error(body.code||'BRIEF_CONFIRM_FAILED');state.bridgeStatus='CONFIRMED';state.workId=body.workId||body.office?.workId||null;state.workStatus=body.work?.status||body.office?.work?.status||null;state.workCreated=Boolean(body.workCreated||body.office?.workCreated);save();return body}
function escalationBody(reason,text){return {clientId:clientId,conversationId:conversationId,requestId:'GO-'+crypto.randomUUID(),reason:reason,text:String(text||'').slice(0,1200),brief:{goal:state.goal,serviceLine:state.serviceLine,jobType:state.jobType,audience:state.audience,materials:state.materials,deadlineText:state.deadlineText},messages:state.messages.slice(-6),focus:state.goFocus||''}}
async function askWhisper(reason,text){const response=await fetch('/api/v1/go/whisper',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(escalationBody(reason,text))});const body=await response.json().catch(function(){return {}});if(!response.ok)throw new Error(body.code||'GO_WHISPER_FAILED');state.whisperCount+=1;save();return body}
async function askGo(reason,text){const response=await fetch('/api/v1/go/takeover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(escalationBody(reason,text))});const body=await response.json().catch(function(){return {}});if(!response.ok)throw new Error(body.code||'GO_TAKEOVER_FAILED');state.goTurns+=1;state.goFocus=body.focus||state.goFocus;state.goActive=!body.resolved&&state.goTurns<3;save();return body}
async function finalizeTeamHandoff(){
 if(state.confirmed)return;
 await confirmBrief();state.confirmed=true;state.teamRequestPending=false;state.stage='summary';save();
 addMessage('assistant','รับเรื่องแล้วครับ ทีมจะรับช่วงต่อจากข้อมูลที่คุยกันไว้');
}
async function handleTeamPrecheck(text){
 try{
  const whisper=await askWhisper('CUSTOMER_REQUESTS_TEAM',text);
  state.goFocus=whisper.focus||state.goFocus;
  if(whisper.decision==='GO_TAKEOVER'){
   const go=await askGo('CUSTOMER_REQUESTS_TEAM',text);addMessage('assistant',go.reply);
   if(!state.goActive)await finalizeTeamHandoff();
   return;
  }
  if(whisper.decision==='SPECTRUM_RETRY'&&whisper.nextQuestion){
   addMessage('assistant',whisper.nextQuestion);save();return;
  }
  await finalizeTeamHandoff();
 }catch(error){
  await finalizeTeamHandoff();
 }
}
async function submitText(text){
 text=String(text||'').trim();if(!text||send.disabled)return;addMessage('user',text);send.disabled=true;send.textContent='…';
 try{
  if(state.goActive){
   const go=await askGo('ACTIVE_TAKEOVER',text);addMessage('assistant',go.reply);
   if(!state.goActive){
    if(state.teamRequestPending)await finalizeTeamHandoff();
    else addMessage('assistant','โอเคครับ จุดนี้ชัดแล้ว เดี๋ยว SPECTRUMSALE รับช่วงต่อครับ');
   }
   renderBrief();renderQuick();return;
  }
  if(state.teamRequestPending){
   await handleTeamPrecheck(text);renderBrief();renderQuick();return;
  }
  const beforeStage=state.stage,beforeJob=state.jobType;
  const response=await fetch('/api/v1/interpret',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({version:'1',clientId:clientId,conversationId:conversationId,text:text,context:{surface:'SPECTRUMSALE',stage:state.stage,serviceLine:state.serviceLine,jobType:state.jobType,package:state.package,confirmed:state.confirmed}})});
  const data=await response.json();if(!response.ok)throw new Error(data.code||'REQUEST_FAILED');
  state.lastInterpretation=data;advanceFromText(text,data);
  const progressed=state.stage!==beforeStage||state.jobType!==beforeJob;
  state.stuckCount=(!progressed&&data.intent==='UNKNOWN')?state.stuckCount+1:0;
  try{await upsertBrief(data)}catch(error){state.bridgeStatus='BRIDGE_PENDING';save()}
  let spoken=false;
  if(state.stuckCount>=2&&state.whisperCount<3){
   const hadWhisper=state.whisperCount>0;
   try{
    const whisper=await askWhisper('SPECTRUM_CANNOT_PROGRESS',text);
    state.goFocus=whisper.focus||'';
    if(hadWhisper&&whisper.decision==='GO_TAKEOVER'){
      const go=await askGo('SPECTRUM_CANNOT_PROGRESS',text);addMessage('assistant',go.reply);spoken=true;
    }else if(whisper.nextQuestion){
      addMessage('assistant',whisper.nextQuestion);spoken=true;state.stuckCount=0;save();
    }
   }catch(error){}
  }
  if(!spoken)addMessage('assistant',replyFor(data));
  save();renderBrief();renderQuick();
 }catch(error){addMessage('assistant','ตอนนี้ตอบข้อความนี้ไม่ได้ชั่วคราวครับ ลองส่งอีกครั้งได้เลย');}
 finally{send.disabled=false;send.textContent='ส่ง';input.focus()}
}
document.getElementById('composer').addEventListener('submit',function(event){event.preventDefault();submitText(input.value);input.value=''})
input.addEventListener('keydown',function(event){if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();document.getElementById('composer').requestSubmit()}})
document.getElementById('reset').addEventListener('click',function(){localStorage.removeItem(STORAGE_KEY);state={...defaultState,messages:[]};render()})
document.getElementById('copy').addEventListener('click',async function(){const brief=['YGG METRO brief','ประเภทงาน: '+(JOB_LABELS[state.jobType]||'ยังไม่ระบุ'),'โจทย์: '+(state.goal||'ยังไม่ระบุ'),'ผู้ชม: '+(state.audience||'ยังไม่ระบุ'),'ข้อมูล/ไฟล์: '+(state.materials||'ยังไม่ระบุ'),'จำนวนหน้า: '+(state.pageCount||'ยังไม่ระบุ'),'กำหนดใช้: '+(state.deadlineText||'ยังไม่ระบุ')].join('\\n');try{await navigator.clipboard.writeText(brief);addMessage('assistant','คัดลอก brief ให้แล้วครับ นำไปส่งต่อให้ทีมได้เลย')}catch{addMessage('assistant',brief)}})
confirmButton.addEventListener('click',async function(){if(state.confirmed||state.teamRequestPending||confirmButton.disabled)return;state.teamRequestPending=true;save();renderBrief();try{const last=state.messages.filter(function(m){return m.role==='user'}).slice(-1)[0]?.text||state.goal||'ขอคุยกับทีม';await handleTeamPrecheck(last);renderBrief();renderQuick()}catch(error){state.teamRequestPending=false;state.bridgeStatus='BRIDGE_PENDING';save();addMessage('assistant','ตอนนี้ยังเรียกทีมไม่ได้ครับ ลองอีกครั้งอีกสักครู่');renderBrief()}})
render();
</script></body></html>`;
}

const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>YGG METRO · Creative Services & Digital Assets</title><meta name="description" content="YGG METRO คือแพลตฟอร์มสร้างสรรค์และหน้าร้านดิจิทัลสำหรับ presentation, visual systems, web experiences และ digital assets ช่วยเปลี่ยนไอเดีย ไฟล์ และ brief ที่ยังไม่เป็นรูปให้พร้อมใช้งานจริง"><link rel="canonical" href="https://yggmetro.com/">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":"https://yggmetro.com/#organization","name":"YGG METRO","alternateName":"YGG METRO Shop","url":"https://yggmetro.com/","description":"Standalone creative service and digital asset platform for presentations, visual systems, web experiences, templates and digital assets."},{"@type":"WebSite","@id":"https://yggmetro.com/#website","url":"https://yggmetro.com/","name":"YGG METRO","publisher":{"@id":"https://yggmetro.com/#organization"}},{"@type":"Service","@id":"https://yggmetro.com/#spectrum-intake","name":"SPECTRUMSALE project intake","serviceType":"Creative project consultation and intake","provider":{"@id":"https://yggmetro.com/#organization"},"url":"https://yggmetro.com/client","description":"Official YGG METRO project-intake surface for turning loose ideas, files and unfinished briefs into a clear project direction."}]}</script>
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
.service-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.card{display:flex;flex-direction:column;min-height:260px;padding:18px;border-radius:20px;border:1px solid var(--line);background:linear-gradient(145deg,rgba(255,255,255,.1),rgba(8,12,18,.62));backdrop-filter:blur(16px);color:#fff;text-decoration:none;position:relative;overflow:hidden;transition:transform .28s ease,border-color .28s ease,box-shadow .28s ease}.card:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 90% 0%,var(--card-glow,rgba(245,199,139,.18)),transparent 38%);pointer-events:none;transition:opacity .28s ease}.card:after{content:"";position:absolute;inset:auto -20% -40% 20%;height:55%;background:radial-gradient(ellipse,var(--card-glow,rgba(245,199,139,.16)),transparent 68%);opacity:.35;filter:blur(14px);pointer-events:none;transition:opacity .28s ease}.card:hover{transform:translateY(-7px);border-color:var(--card-accent,#f5c78b);box-shadow:0 22px 50px rgba(0,0,0,.28),0 0 28px var(--card-glow,rgba(245,199,139,.14))}.card:hover:after{opacity:.8}.card>*{position:relative;z-index:1}.card small{letter-spacing:.16em;text-transform:uppercase;color:var(--card-accent,var(--warm));font-size:.68rem;font-weight:750}.card h3{margin:30px 0 8px;font-size:1.35rem;letter-spacing:-.035em}.card p{margin:0;color:var(--muted);font-size:.9rem;line-height:1.55}.card .go{margin-top:auto;padding-top:24px;font-size:.86rem;font-weight:750;color:#fff}.card[data-service="presentation"]{--card-accent:#f5c78b;--card-glow:rgba(245,199,139,.2)}.card[data-service="visual"]{--card-accent:#9b87ff;--card-glow:rgba(155,135,255,.2)}.card[data-service="digital"]{--card-accent:#4da3ff;--card-glow:rgba(77,163,255,.2)}.card[data-service="lab"]{--card-accent:#65d6c2;--card-glow:rgba(101,214,194,.2)}
.process{display:grid;grid-template-columns:.8fr 1.2fr;gap:48px;align-items:start}.process-intro h2{margin:8px 0 16px;font-size:clamp(2.2rem,5vw,4rem);line-height:.96;letter-spacing:-.06em}.process-intro p{margin:0;max-width:360px;color:var(--muted);line-height:1.6}.steps{border-top:1px solid var(--line)}.step{display:grid;grid-template-columns:48px 1fr;gap:18px;padding:20px 0;border-bottom:1px solid var(--line);transition:transform .25s ease,border-color .25s ease}.step:hover{transform:translateX(6px);border-color:var(--warm)}.step-index{color:var(--warm);font-size:.76rem;letter-spacing:.12em;font-weight:800;padding-top:3px}.step h3{margin:0 0 6px;font-size:1.05rem}.step p{margin:0;color:var(--muted);font-size:.92rem;line-height:1.55}
.feature{padding:30px;border-radius:24px;border:1px solid var(--line);background:linear-gradient(120deg,rgba(245,199,139,.16),rgba(255,255,255,.05) 45%,rgba(8,12,18,.62));display:flex;align-items:end;justify-content:space-between;gap:30px}.feature h2{margin:8px 0 12px;font-size:clamp(2.1rem,5vw,4rem);line-height:.95;letter-spacing:-.06em}.feature p{margin:0;max-width:540px;color:var(--muted);line-height:1.58}.feature .button{flex:0 0 auto}
.foot{display:flex;justify-content:space-between;gap:20px;padding:34px 0 22px;color:rgba(255,255,255,.46);font-size:.76rem;border-top:1px solid var(--line)}
@media(max-width:900px){.hero-grid{grid-template-columns:1fr;gap:32px}.hero-note{justify-self:start;max-width:420px}.service-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.process{grid-template-columns:1fr;gap:34px}}
@media(max-width:640px){body{background-attachment:scroll;background-position:center}#services{background-position:center top}.container{width:min(100% - 32px,1180px)}.top{padding:18px 16px}.topnav a{display:none}.hero{min-height:720px;padding:112px 0 52px}.hero h1{font-size:clamp(3.2rem,16vw,5.5rem)}.section{padding:58px 0}.section-head{display:block}.section-head p{margin-top:12px}.service-grid{grid-template-columns:1fr}.card{min-height:190px}.process{gap:26px}.feature{display:block;padding:24px}.feature .button{margin-top:24px}.foot{display:block}.foot span{display:block;margin-top:8px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.button{transition:none}.button:hover{transform:none}}
</style></head>
<body><main class="page">
<header class="top"><a class="brand" href="/" aria-label="YGG METRO home">YGG METRO</a><nav class="topnav" aria-label="เมนูหลัก"><a href="#services">บริการ</a><a href="#process">วิธีทำงาน</a><a class="shop" href="/client">เริ่มคุยงาน</a></nav></header>
<section class="hero"><div class="container hero-grid"><div class="hero-copy"><div class="eyebrow">Creative systems · visual work</div><h1>ทำให้งาน<br>ไปต่อได้</h1><p>YGG METRO คือแพลตฟอร์มสร้างสรรค์และหน้าร้านดิจิทัลของเราเอง ช่วยเปลี่ยนโจทย์ ไฟล์ หรือ brief ที่ยังไม่เป็นรูป ให้กลายเป็น presentation, visual system และ web experience ที่พร้อมนำไปใช้จริง</p><div class="actions"><a class="button primary" href="/client">เริ่มคุยกับ SPECTRUMSALE</a><a class="button ghost" href="#services">ดูบริการ</a></div></div><aside class="hero-note"><strong>เริ่มจากสิ่งที่คุณมี</strong>เล่าโจทย์ ไฟล์ หรือสิ่งที่ยังจัดไม่ลงตัว แล้วให้เราเข้าไปช่วยจัดโครงให้ชัดขึ้น</aside></div></section>
<section id="services" class="section"><div class="container"><div class="section-head"><div><div class="eyebrow">What we make</div><h2>บริการที่พา<br>งานเดินหน้า</h2></div><p>เลือกจากปัญหาที่อยากแก้ แล้วคุยกับ SPECTRUMSALE เพื่อเริ่มต้นจากโจทย์จริงของคุณ</p></div><div class="service-grid">
<a class="card" data-service="presentation" href="/client?service=presentation"><small>01 · Presentation</small><h3>Company & Pitch</h3><p>จัดโครงเรื่อง ออกแบบสไลด์ และทำงานนำเสนอให้พร้อมใช้จริง</p><div class="go">เริ่มคุยงาน →</div></a>
<a class="card" data-service="visual" href="/client?service=visual"><small>02 · Visual</small><h3>Brand & Visual System</h3><p>วางทิศทางแบรนด์ งานภาพ และ visual language ให้ทั้งระบบไปทางเดียวกัน</p><div class="go">คุยเรื่องทิศทาง →</div></a>
<a class="card" data-service="digital" href="/client?service=digital"><small>03 · Digital</small><h3>Web Experience</h3><p>ออกแบบหน้าเว็บ เดโม และประสบการณ์ดิจิทัลที่เล่าเรื่องผ่านบรรยากาศ</p><div class="go">เริ่มวางหน้าเว็บ →</div></a>
<a class="card" data-service="lab" href="/client?service=lab"><small>04 · YGG Lab</small><h3>Templates & Assets</h3><p>เทมเพลต ธีม และของดาวน์โหลดจากงานทดลองของ YGG METRO</p><div class="go">ดูของที่กำลังทำ →</div></a>
</div></div></section>
<section id="process" class="section"><div class="container process"><div class="process-intro"><div class="eyebrow">How it works</div><h2>ไม่ต้องพร้อม<br>ตั้งแต่แรก</h2><p>ส่งสิ่งที่มีมาได้เลย เราจะช่วยแยกโจทย์และพาไปสู่รูปแบบงานที่คุยต่อได้ง่ายขึ้น</p></div><div class="steps"><div class="step"><div class="step-index">01</div><div><h3>เล่าโจทย์</h3><p>บอกว่าอยากทำอะไร มีข้อมูลหรือไฟล์อะไรอยู่แล้ว และติดตรงไหน</p></div></div><div class="step"><div class="step-index">02</div><div><h3>จัดทิศทาง</h3><p>SPECTRUMSALE ช่วยจับประเภทงาน ขอบเขต และสิ่งที่ต้องตัดสินใจก่อนเริ่ม</p></div></div><div class="step"><div class="step-index">03</div><div><h3>คุยงานที่เหมาะ</h3><p>เมื่อภาพชัดขึ้น เราจึงค่อยเลือกวิธีทำงานและขยับไปสู่รายละเอียด</p></div></div></div></div></section>
<section class="section"><div class="container"><div class="feature"><div><div class="eyebrow">Selected work · YGG METRO</div><h2>มีโจทย์อยู่ในหัว<br>ให้เราช่วยจัดมัน</h2><p>เริ่มจากข้อความสั้น ๆ ก็ได้ ไม่ต้องเตรียม brief ให้สมบูรณ์ก่อน</p></div><a class="button primary" href="/client">คุยกับ SPECTRUMSALE</a></div></div></section>
<footer class="container foot"><span>YGG METRO · Shop</span><span>Presentation · Visual · Digital · YGG Lab</span></footer>
</main></body></html>`

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ok:true,service:"yggmetro-web",status:"READY",spectrumSaleConfigured:Boolean(env?.OPENAI_API_KEY)}, {headers:{"cache-control":"no-store"}});
    }
    if (url.pathname === "/api/v1/events") return handleSalesEvent(request,env);
    if (url.pathname === "/api/v1/payment/checkout") return handlePaymentCheckout(request,env);
    if (url.pathname === "/api/v1/go/whisper") return handleGoWhisper(request,env);
    if (url.pathname === "/api/v1/go/takeover") return handleGoTakeover(request,env);
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
