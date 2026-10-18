// Public, zero-API-cost product guidance for the YGG METRO storefront.
// No conversational history, personal identifiers, or payment claims are persisted.
const MATCHERS = [
  ["land-planner", /land[\s-]?planner|วางแปลน|ที่ดิน|บ้าน.*สวน|สระน้ำ|แปลงหน่วย/i],
  ["root-cause", /root[\s-]?causes?|ต้นเหตุ|รากปัญหา|วิเคราะห์(?:สาเหตุ|ปัญหา)/i],
  ["adaptive-lens", /adaptive[\s-]?lens|เลนส์|มุมมอง|ai[\s-]?skill/i],
  ["shop-home", /shop[\s-]?home|จัดการร้าน|บริหารร้าน|ออเดอร์|notion.*ร้าน/i],
  ["finance-simulator", /finance[\s-]?simulator|การเงิน|กู้|เงินออม|ปลดหนี้|สินเชื่อ|ค่างวด/i],
  ["lost-era", /lost[\s-]?era|สร้างโลก|นิยาย|ประวัติศาสตร์|เกม.*เนื้อเรื่อง/i]
];
function briefProduct(p) {
  return p.name + " — " + p.desc + "\nราคา: " + p.price + " · สถานะ: " + p.status;
}
function linksFor(items) {
  return items.slice(0,3).map(p=>({label:"ดู " + p.name,url:"/products/" + p.slug}));
}
export function answerShopQuestion(text,catalog) {
  const question=String(text||"").trim();
  const matches=catalog.filter(p=>MATCHERS.some(([slug,re])=>slug===p.slug&&re.test(question)) ||
    p.name.toLocaleLowerCase().length>3 && question.toLocaleLowerCase().includes(p.name.toLocaleLowerCase()));
  if (/จ่าย.*แล้ว|ชำระ.*แล้ว|โอน.*แล้ว|คืนเงิน|refund|payment.*(?:paid|done)|เลข.*ออเดอร์/i.test(question)) {
    return {reply:"เรื่องการชำระเงินและคำสั่งซื้อต้องตรวจจากระบบจริงครับ ผมยังตรวจยอดหรือยืนยันสถานะไม่ได้ โปรดติดต่อทีมผ่านหน้าคุยงาน และอย่าส่งข้อมูลบัตรหรือรหัสผ่านในแชตนี้",links:[{label:"ติดต่อทีม",url:"/client?service=lab"}]};
  }
  if (/ติดต่อ|คุยกับคน|คนจริง|พนักงาน|เจ้าหน้าที่|ทีมงาน|human/i.test(question)) {
    return {reply:"หากต้องการให้ทีมรับเรื่อง สามารถเปิดหน้าคุยงานเพื่อส่งรายละเอียดได้ครับ ผมไม่สามารถยืนยันได้ว่ามีเจ้าหน้าที่ออนไลน์อยู่ในขณะนี้",links:[{label:"เปิดหน้าคุยงาน",url:"/client?service=lab"}]};
  }
  if (matches.length) {
    const picks=matches.slice(0,2);
    const details=picks.map(briefProduct).join("\n\n");
    const note=picks.length===1 && picks[0].note ? "\n\nหมายเหตุ: " + picks[0].note : "";
    return {reply:"จากข้อมูลสินค้าปัจจุบัน มีรายการที่ตรงกับคำถามครับ\n\n"+details+note+"\n\nเปิดหน้าสินค้าเพื่อตรวจรายละเอียดและช่องทางใช้งานก่อนตัดสินใจนะครับ",links:linksFor(picks)};
  }
  if (/ฟรี|free|ทดลอง|ลองใช้/i.test(question)) {
    const p=catalog.find(x=>x.slug==="land-planner");
    return {reply:"ตอนนี้ Land Planner เป็นเครื่องมือที่ระบุว่าเปิดใช้ฟรีครับ\n\n"+briefProduct(p)+"\n\nสินค้าอื่นให้ตรวจราคาหรือเครดิตจากหน้าสินค้าปลายทางก่อนใช้งานครับ",links:linksFor([p])};
  }
  if (/ราคา|เท่าไหร่|ค่าบริการ|ซื้อ|ชำระ|ขาย|มีอะไร|สินค้า|product|shop|สวัสดี|hi|hello/i.test(question) || question.length<8) {
    const featured=["land-planner","root-cause","adaptive-lens","shop-home"];
    const picks=featured.map(slug=>catalog.find(p=>p.slug===slug)).filter(Boolean);
    return {reply:"ยินดีต้อนรับครับ 💙 ผม GO ผู้ช่วยข้อมูลสินค้าของ YGG METRO\n\nร้านมีเครื่องมือวางแผน เทมเพลต และเครื่องมือ AI เช่น\n"+picks.map(p=>"• "+p.name+" — "+p.price+" ("+p.status+")").join("\n")+"\n\nบางรายการขายผ่านแพลตฟอร์มปลายทาง และบางรายการยังไม่เปิดขายตรงบนเว็บนี้ครับ สนใจงานประเภทไหนเป็นพิเศษ?",links:linksFor(picks)};
  }
  return {reply:"ผมยังจับคู่คำถามนี้กับสินค้ารายการใดไม่ได้ครับ ตอนนี้ช่วยตอบจากแค็ตตาล็อกจริงของร้าน เช่น วางแปลนที่ดิน การเงิน วิเคราะห์ปัญหา หรือเทมเพลตจัดการร้าน\n\nหากเป็นงานที่ต้องออกแบบเฉพาะ สามารถคุยรายละเอียดกับทีมผ่านหน้าคุยงานได้ครับ",links:[{label:"เลือกดูสินค้า",url:"/#products"},{label:"คุยงานกับทีม",url:"/client?service=lab"}]};
}
export async function handleShopAssistant(request,catalog) {
  const headers={"cache-control":"no-store","x-content-type-options":"nosniff"};
  const respond=(data,status=200)=>Response.json(data,{status,headers});
  if(request.method!=="POST")return new Response("Method Not Allowed",{status:405,headers:{...headers,allow:"POST"}});
  if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")||""))return respond({ok:false,code:"CONTENT_TYPE_REQUIRED"},415);
  if(Number(request.headers.get("content-length")||0)>2048)return respond({ok:false,code:"PAYLOAD_TOO_LARGE"},413);
  const raw=await request.text();
  if(raw.length>2048)return respond({ok:false,code:"PAYLOAD_TOO_LARGE"},413);
  let body;
  try{body=JSON.parse(raw)}catch{return respond({ok:false,code:"INVALID_JSON"},400)}
  const message=body?.message;
  if(typeof message!=="string"||message.trim().length<1||message.length>500)return respond({ok:false,code:"INVALID_MESSAGE"},400);
  const result=answerShopQuestion(message,catalog);
  return respond({ok:true,mode:"catalog",reply:result.reply,links:result.links});
}
const CHAT_CSS = [
"#go-sales-root{position:fixed;right:18px;bottom:max(18px,env(safe-area-inset-bottom));z-index:1000;color:#f5f3ec;font:400 14px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}",
"#go-sales-root *{box-sizing:border-box}",
"#go-sales-root [hidden]{display:none!important}",
"#go-sales-root[data-obscured='true']{visibility:hidden;pointer-events:none}",
"#go-sales-launcher{display:flex;gap:8px;align-items:center;justify-content:center;min-height:48px;padding:0 14px;border-radius:999px;border:1px solid #b8f8e3;background:#b8f8e3;color:#102522;font-size:13px;font-weight:800;box-shadow:0 6px 24px #0007;cursor:pointer}",
"#go-sales-launcher:hover{background:#d5fff0}",
"#go-sales-panel{display:flex;flex-direction:column;width:min(370px,calc(100vw - 24px));height:min(540px,calc(100dvh - 104px));border:1px solid #4b6b67;border-radius:19px;background:#101c20;box-shadow:0 18px 60px #000b;overflow:hidden}",
"#go-sales-header{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#193035;border-bottom:1px solid #3a5253;padding:14px 16px}",
"#go-sales-header strong{display:block;font-size:15px}",
"#go-sales-header small{display:block;color:#bfd4d0;font-size:11px;font-weight:500}",
"#go-sales-close{background:transparent;color:#f5f3ec;border:1px solid #4b6b67;border-radius:10px;min-width:38px;min-height:38px;font-size:22px;cursor:pointer}",
"#go-sales-messages{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:15px;display:flex;flex-direction:column;gap:10px}",
".go-sales-bubble{max-width:95%;white-space:pre-line;overflow-wrap:anywhere;padding:11px 13px;border-radius:14px;background:#22373b;color:#f5f3ec}",
".go-sales-bubble.customer{align-self:flex-end;background:#245d58;color:#fff}",
".go-sales-link{display:inline-block;padding:7px 10px;border:1px solid #638982;border-radius:9px;color:#b8f8e3;font-size:12px;margin:7px 6px 0 0}",
"#go-sales-form{display:flex;gap:8px;padding:12px;border-top:1px solid #344a4c}",
"#go-sales-input{flex:1;min-width:0;resize:none;max-height:96px;min-height:46px;border:1px solid #486565;border-radius:10px;padding:11px;background:#14272b;color:white;font:inherit}",
"#go-sales-send{flex:0 0 auto;border:0;border-radius:10px;min-width:55px;padding:0 12px;background:#b8f8e3;color:#102522;font-weight:800;cursor:pointer}",
"#go-sales-send:disabled{opacity:.5;cursor:wait}",
"#go-sales-note{font-size:10px;line-height:1.4;color:#b4c9c5;padding:0 14px 10px}",
"#go-sales-root button:focus-visible,#go-sales-root textarea:focus-visible,#go-sales-root a:focus-visible{outline:3px solid #fff;outline-offset:2px}",
"@media(max-width:540px){#go-sales-root{right:12px;bottom:max(12px,env(safe-area-inset-bottom))}#go-sales-panel{width:calc(100vw - 24px);height:min(570px,calc(100dvh - 76px))}}"
].join("");
const CHAT_HTML = [
'<aside id="go-sales-root" aria-label="ผู้ช่วยข้อมูลสินค้าของ YGG METRO">',
'<button type="button" id="go-sales-launcher" aria-expanded="false" aria-controls="go-sales-panel">💬 คุยกับ GO</button>',
'<section id="go-sales-panel" role="dialog" aria-label="GO ผู้ช่วยเลือกสินค้า" hidden>',
'<div id="go-sales-header"><div><strong>GO · ผู้ช่วยเลือกสินค้า</strong><small>โหมดแค็ตตาล็อก · ไม่ใช้ AI Cloud</small></div><button type="button" id="go-sales-close" aria-label="ปิดแชต">×</button></div>',
'<div id="go-sales-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>',
'<form id="go-sales-form"><textarea id="go-sales-input" maxlength="500" rows="2" placeholder="อยากได้เครื่องมือแบบไหนครับ?" aria-label="ข้อความถึง GO"></textarea><button type="submit" id="go-sales-send">ส่ง</button></form>',
'<p id="go-sales-note">ตอบจากข้อมูลสินค้าในร้าน · ไม่ตรวจออเดอร์หรือรับข้อมูลบัตร · หากต้องการคุยงาน กดเมนูคุยงาน</p>',
'</section></aside>'
].join("");
function clientChat() {
  const root=document.getElementById("go-sales-root");
  if(!root)return;
  const launcher=root.querySelector("#go-sales-launcher");
  const panel=root.querySelector("#go-sales-panel");
  const closer=root.querySelector("#go-sales-close");
  const messages=root.querySelector("#go-sales-messages");
  const form=root.querySelector("#go-sales-form");
  const input=root.querySelector("#go-sales-input");
  const send=root.querySelector("#go-sales-send");
  let collisionFrame=0;
  function syncLauncherCollision(){
    if(launcher.hidden||!panel.hidden){root.removeAttribute("data-obscured");return}
    const buttonRect=launcher.getBoundingClientRect();
    const content=[...document.querySelectorAll("a[href],button,input,select,textarea,[role='button'],img,h1,h2,h3,p,li")].filter(node=>!root.contains(node)&&node.getClientRects().length);
    const overlaps=content.some(node=>{
      const style=getComputedStyle(node);
      if(style.visibility==="hidden"||style.display==="none"||Number(style.opacity)===0)return false;
      const rect=node.getBoundingClientRect();
      return Math.min(buttonRect.right,rect.right)-Math.max(buttonRect.left,rect.left)>6&&
        Math.min(buttonRect.bottom,rect.bottom)-Math.max(buttonRect.top,rect.top)>6;
    });
    if(overlaps)root.setAttribute("data-obscured","true");else root.removeAttribute("data-obscured");
  }
  function scheduleCollisionCheck(){
    cancelAnimationFrame(collisionFrame);
    collisionFrame=requestAnimationFrame(syncLauncherCollision);
  }
  window.addEventListener("scroll",scheduleCollisionCheck,{passive:true});
  window.addEventListener("resize",scheduleCollisionCheck,{passive:true});
  document.addEventListener("click",scheduleCollisionCheck,true);
  document.addEventListener("input",scheduleCollisionCheck,true);
  document.addEventListener("change",scheduleCollisionCheck,true);
  scheduleCollisionCheck();
  const allowedLink=url=>typeof url==="string" && (/^\/products\/[a-z0-9-]+$/.test(url)||/^\/client\?service=lab$/.test(url)||url==="/#products");
  function push(role,text,links) {
    const bubble=document.createElement("div");
    bubble.className="go-sales-bubble"+(role==="customer"?" customer":"");
    bubble.textContent=String(text||"");
    messages.appendChild(bubble);
    if(Array.isArray(links))for(const link of links.slice(0,3)){
      if(!allowedLink(link?.url))continue;
      const a=document.createElement("a");
      a.className="go-sales-link";
      a.href=link.url;
      a.textContent=String(link.label||"ดูรายละเอียด");
      bubble.appendChild(document.createElement("br"));
      bubble.appendChild(a);
    }
    messages.scrollTop=messages.scrollHeight;
  }
  launcher.addEventListener("click",()=>{
    launcher.hidden=true;launcher.setAttribute("aria-expanded","true");
    panel.hidden=false;input.focus();
    if(!messages.childNodes.length)push("assistant","สวัสดีครับ 💙 ผม GO ช่วยแนะนำจากข้อมูลสินค้าของร้านได้ครับ สนใจสินค้าไหน หรืออยากได้เครื่องมือสำหรับงานอะไรครับ?");
  });
  function close(){panel.hidden=true;launcher.hidden=false;launcher.setAttribute("aria-expanded","false");scheduleCollisionCheck();launcher.focus()}
  closer.addEventListener("click",close);
  panel.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
  input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(!send.disabled)form.requestSubmit()}});
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const message=input.value.trim();
    if(!message||message.length>500||send.disabled)return;
    push("customer",message);
    input.value="";send.disabled=true;input.disabled=true;
    try{
      const res=await fetch("/api/v1/shop/assistant",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message})});
      const data=await res.json();
      if(!res.ok||!data.ok)throw new Error("shop assistant unavailable");
      push("assistant",data.reply,data.links);
    }catch{push("assistant","ขออภัยครับ ตอนนี้ระบบตอบข้อความไม่สำเร็จ กรุณาลองอีกครั้งหรือเปิดหน้าสินค้าโดยตรง")}
    finally{send.disabled=false;input.disabled=false;input.focus()}
  });
}
export function shopChatWidget(){
  return "<style>"+CHAT_CSS+"</style>"+CHAT_HTML+"<script>("+clientChat.toString()+")();</script>";
}
