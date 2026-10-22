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
    return {reply:"เรื่องการชำระเงินและคำสั่งซื้อต้องตรวจจากระบบจริงครับ ผมยังตรวจยอดหรือยืนยันสถานะไม่ได้ โปรดติดต่อ Admin ผ่านหน้าคุยงาน และอย่าส่งข้อมูลบัตรหรือรหัสผ่านในแชตนี้",links:[{label:"ติดต่อ Admin",url:"/client?service=lab"}]};
  }
  if (/ติดต่อ|คุยกับคน|คนจริง|พนักงาน|เจ้าหน้าที่|ทีมงาน|human/i.test(question)) {
    return {reply:"หากต้องการส่งคำขอให้ศูนย์รับงาน สามารถเปิดหน้าคุยงานเพื่อส่งรายละเอียดได้ครับ ผมไม่สามารถยืนยันได้ว่ามี Admin ออนไลน์อยู่ในขณะนี้",links:[{label:"เปิดหน้าคุยงาน",url:"/client?service=lab"}]};
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
    return {reply:"ยินดีต้อนรับครับ 💙 System แนะนำข้อมูลสินค้าของ YGG METRO\n\nร้านมีเครื่องมือวางแผน เทมเพลต และเครื่องมือ AI เช่น\n"+picks.map(p=>"• "+p.name+" — "+p.price+" ("+p.status+")").join("\n")+"\n\nบางรายการขายผ่านแพลตฟอร์มปลายทาง และบางรายการยังไม่เปิดขายตรงบนเว็บนี้ครับ สนใจงานประเภทไหนเป็นพิเศษ?",links:linksFor(picks)};
  }
  return {reply:"ผมยังจับคู่คำถามนี้กับสินค้ารายการใดไม่ได้ครับ ตอนนี้ช่วยตอบจากแค็ตตาล็อกจริงของร้าน เช่น วางแปลนที่ดิน การเงิน วิเคราะห์ปัญหา หรือเทมเพลตจัดการร้าน\n\nหากเป็นงานที่ต้องออกแบบเฉพาะ สามารถส่งคำขอผ่านหน้าคุยงานได้ครับ",links:[{label:"เลือกดูสินค้า",url:"/#products"},{label:"ส่งคำขอ",url:"/client?service=lab"}]};
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
  return respond({ok:true,sender_type:"SYSTEM",sender_id:"catalog",sender_label:"System",timestamp:new Date().toISOString(),mode:"catalog",reply:result.reply,links:result.links});
}
const CHAT_CSS = [
"#go-sales-root{position:fixed;right:18px;bottom:max(18px,env(safe-area-inset-bottom));z-index:1000;color:#f5f3ec;font:400 14px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}",
"#go-sales-root *{box-sizing:border-box}",
"#go-sales-root [hidden]{display:none!important}",
"#go-sales-root[data-obscured='true']{visibility:hidden;pointer-events:none}",
"#go-sales-launcher{display:flex;gap:8px;align-items:center;justify-content:center;min-height:48px;padding:0 14px;border-radius:999px;border:1px solid #b8f8e3;background:#b8f8e3;color:#102522;font-size:13px;font-weight:800;box-shadow:0 6px 24px #0007;cursor:pointer}",
"#go-sales-launcher:hover{background:#d5fff0}",
"#go-mascot-dock{position:relative;width:120px;margin-left:auto}#go-mascot-dock #go-sales-launcher{width:120px;min-height:150px;padding:0 0 5px;flex-direction:column;gap:0;background:transparent;border:0;box-shadow:none;color:#102522}#go-mascot-image{display:block;width:112px;height:124px;object-fit:contain;transform-origin:50% 90%;animation:go-mascot-greet 2.8s ease-in-out 3;filter:drop-shadow(0 5px 8px #102b5b30)}#go-mascot-label{background:#e4f7ff;border:1px solid #69c8ef;border-radius:16px;padding:5px 10px;font-size:12px;white-space:nowrap}#go-mascot-minimize{position:absolute;right:0;top:0;border:1px solid #69c8ef;border-radius:50%;width:32px;height:32px;background:#e4f7ff;color:#102522;cursor:pointer;font-size:20px}#go-sales-root[data-minimized] #go-mascot-image{display:none}#go-sales-root[data-minimized] #go-sales-launcher{min-height:48px}#go-sales-root[data-minimized] #go-mascot-minimize{display:none}@keyframes go-mascot-greet{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-4px) rotate(-3deg)}}@media(prefers-reduced-motion:reduce){#go-mascot-image{animation:none}}@media(max-width:540px){#go-mascot-dock,#go-mascot-dock #go-sales-launcher{width:100px}#go-mascot-dock #go-sales-launcher{min-height:126px}#go-mascot-image{width:90px;height:100px}}",

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
"#go-sales-handoff{margin:0 12px 8px;padding:9px;border:1px solid #69c8ef;border-radius:10px;background:#193035;color:#e4f7ff;cursor:pointer;min-height:44px}#go-sales-handoff:disabled{opacity:.6;cursor:wait}#go-sales-state{display:block;min-height:18px;padding:0 14px 5px;color:#b4c9c5;font-size:12px}",
"#go-sales-note{font-size:10px;line-height:1.4;color:#b4c9c5;padding:0 14px 10px}",
"#go-sales-root button:focus-visible,#go-sales-root textarea:focus-visible,#go-sales-root a:focus-visible{outline:3px solid #fff;outline-offset:2px}",
"@media(max-width:540px){#go-sales-root{right:12px;bottom:max(12px,env(safe-area-inset-bottom))}#go-sales-panel{width:calc(100vw - 24px);height:min(570px,calc(100dvh - 76px))}}"
].join("");
const CHAT_HTML = [
'<aside id="go-sales-root" aria-label="ผู้ช่วยข้อมูลสินค้าของ YGG METRO">',
 '<div id="go-mascot-dock"><button type="button" id="go-sales-launcher" aria-label="คุยกับ GO แนะนำสินค้า" aria-expanded="false" aria-controls="go-sales-panel"><img id="go-mascot-image" src="/assets/shop/go-mascot.webp" alt="" width="112" height="124"><span id="go-mascot-label">คุยกับ GO 💬</span></button><button type="button" id="go-mascot-minimize" aria-label="ย่อมาสคอต GO">−</button></div>',
'<section id="go-sales-panel" role="dialog" aria-label="GO ช่วยเลือกสินค้า" hidden>',
'<div id="go-sales-header"><div><strong>GO · ช่วยเลือกสินค้า</strong><small>ช่วยค้นหาจากข้อมูลสินค้าในร้าน</small></div><button type="button" id="go-sales-close" aria-label="ปิดแชต">×</button></div>',
'<div id="go-sales-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>',
'<form id="go-sales-form"><textarea id="go-sales-input" maxlength="500" rows="2" placeholder="อยากได้เครื่องมือแบบไหนครับ?" aria-label="คำถามเกี่ยวกับสินค้า"></textarea><button type="submit" id="go-sales-send">ส่ง</button></form>',
'<button type="button" id="go-sales-handoff">คุยงานต่อกับ GO →</button><small style="padding:0 14px 8px;color:#bfd4d0">นำข้อความล่าสุดสูงสุด 8 ข้อความไปสร้างร่าง ยังไม่ส่งคำขอจ้าง · <a href="/client" style="color:#b8f8e3">เปิดคำขอเดิม</a></small><span id="go-sales-state" role="status" aria-live="polite"></span>',
'<p id="go-sales-note">ตอบจากข้อมูลสินค้าในร้าน · ไม่ตรวจออเดอร์หรือรับข้อมูลบัตร · หากต้องการคุยงาน กดเมนูคุยงาน</p>',
'</section></aside>'
].join("");

export function shopChatWidget(){
  return "<style>"+CHAT_CSS+"</style>"+CHAT_HTML+'<script src="/assets/shop/go-chat.js" defer></script>';
}
