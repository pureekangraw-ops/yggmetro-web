import {authenticateAdmin} from './request-workflow.js';
import {isShopSandbox, isShopRequest} from './shop-origin.js';

const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const reply=(body,status=200)=>Response.json(body,{status,headers});
const fail=(code,status)=>{throw Object.assign(Error(code),{status})};

// This is an opt-in grant to existing admin identities, not an automatic extension
// of request-admin authority. No deployed config supplies this grant yet.
export async function officeCommerce(request,env={}) {
 const url=new URL(request.url);
 if(!['/admin/shop','/api/v1/admin/shop/orders'].includes(url.pathname))return null;
 if(!(isShopSandbox(env)?isShopRequest(request,env):url.origin==='https://office.yggmetro.com'))return reply({ok:false,code:'NOT_FOUND'},404);
 if(request.method!=='GET')return reply({ok:false,code:'METHOD_NOT_ALLOWED'},405);
 if(url.pathname==='/admin/shop')return new Response(officeCommercePage,{headers:{...headers,'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'"}});
 try {
  if(request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==url.origin))fail('ORIGIN_DENIED',403);
  const actor=await authenticateAdmin(request,env);
  let grants;try{grants=JSON.parse(env.SHOP_OFFICE_READ_ACTORS||'[]')}catch{fail('COMMERCE_ACCESS_NOT_CONFIGURED',503)}
  if(!Array.isArray(grants)||!grants.every(v=>typeof v==='string'))fail('COMMERCE_ACCESS_NOT_CONFIGURED',503);
  if(!grants.includes(actor.id))fail('COMMERCE_ACCESS_DENIED',403);
  return await readCommerceOrders(env,url.searchParams);
 }catch(error){return reply({ok:false,code:error.status?error.message:'COMMERCE_STORE_UNAVAILABLE'},error.status||503)}
}

// Shared read-only projection. Callers must establish their own trusted boundary.
export async function readCommerceOrders(env,params=new URLSearchParams()) {
 try {
  if(!env.SHOP_ORDERS?.prepare)fail('COMMERCE_STORE_NOT_CONFIGURED',503);
  // Never combine live and test revenue, even if a store contains both histories.
  if(![undefined,'test','live'].includes(env.STRIPE_CHECKOUT_MODE)||(isShopSandbox(env)&&env.STRIPE_CHECKOUT_MODE==='live'))fail('COMMERCE_MODE_INVALID',503);
  const mode=env.STRIPE_CHECKOUT_MODE==='live'?'live':'test',prefix='cs_'+mode+'_%';
  const cursor=params.get('cursor');
  const position=cursor?/^(\d{1,16}):(cs_(?:test|live)_[A-Za-z0-9_]+)$/.exec(cursor):null;
  if((cursor&&(!position||!Number.isSafeInteger(Number(position[1]))))||[...params.keys()].some(k=>k!=='cursor'))fail('INVALID_CURSOR',400);
  // Explicit projection excludes owner hashes, checkout attempts, email and file keys.
  const rows=(await env.SHOP_ORDERS.prepare("SELECT session_id,amount,currency,status,paid_at,created_at FROM shop_orders WHERE session_id GLOB ? AND (created_at < ? OR (created_at = ? AND session_id < ?)) ORDER BY created_at DESC,session_id DESC LIMIT 101").bind(prefix.replace('%','*'),position?Number(position[1]):Number.MAX_SAFE_INTEGER,position?Number(position[1]):Number.MAX_SAFE_INTEGER,position?position[2]:'').all()).results;
  const totals=(await env.SHOP_ORDERS.prepare("SELECT currency,SUM(amount) AS amount_minor,COUNT(*) AS order_count FROM shop_orders WHERE session_id GLOB ? AND status='paid' GROUP BY currency ORDER BY currency").bind(prefix.replace('%','*')).all()).results;
  if([...rows.map(r=>r.amount),...totals.flatMap(r=>[r.amount_minor,r.order_count])].some(n=>!Number.isSafeInteger(n)||n<0))fail('COMMERCE_AMOUNT_INVALID',503);
  return reply({ok:true,mode,next_cursor:rows.length>100?rows[99].created_at+':'+rows[99].session_id:null,
   totals:totals.map(r=>({currency:r.currency,amount_minor:r.amount_minor,order_count:r.order_count})),
   orders:rows.slice(0,100).map(r=>({order_id:r.session_id,currency:r.currency,amount_minor:r.amount,payment_status:r.status,paid_at:r.paid_at,created_at:r.created_at,
    download_authorized:r.status==='paid',download_evidence:'not_recorded',customer_receipt:'unknown'}))});
 }catch(error){return reply({ok:false,code:error.status?error.message:'COMMERCE_STORE_UNAVAILABLE'},error.status||503)}
}

export const officeCommercePage=`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>คำสั่งซื้อหน้าร้าน · YGG METRO Office</title><style>
*{box-sizing:border-box}body{margin:0;background:#0b1019;color:#f5f7fa;font:16px/1.6 system-ui}main{max-width:1080px;margin:auto;padding:20px}a{color:#e7c293}input,button{font:inherit;padding:12px;max-width:100%;min-height:44px}label{display:block}article{border:1px solid #60728a;border-radius:12px;padding:16px;margin:12px 0;overflow-wrap:anywhere}#totals{white-space:pre-line}nav{display:flex;gap:20px;flex-wrap:wrap}</style></head><body><main><nav><a href="/admin/requests">ศูนย์รับงาน</a><a href="https://shop.yggmetro.com">หน้าร้าน</a></nav><h1>คำสั่งซื้อหน้าร้าน</h1><p>ยอดชำระเงินยืนยันแยกตามสกุลเงิน ไม่หักค่าธรรมเนียมหรือคืนเงิน ไม่ใช่ยอดสุทธิ</p><form id="login"><label>รหัสเข้าถึง Admin <input id="token" type="password" autocomplete="off" required></label><button>อ่านคำสั่งซื้อ</button><button id="logout" type="button">ออกจากระบบ</button></form><p id="notice" role="status"></p><p id="totals"></p><section id="orders" aria-label="คำสั่งซื้อ"></section><button id="more" hidden>ดูเพิ่มเติม</button><p>สิทธิ์ดาวน์โหลดเกิดจากการยืนยันชำระเงิน ไม่รับรองว่าไฟล์ยังพร้อมหรือว่าลูกค้าได้รับหรือเปิดไฟล์แล้ว ระบบยังไม่มีบันทึกการรับไฟล์</p></main><script>
const $=id=>document.getElementById(id);let credential='',cursor=null,epoch=0,busy=false;
function clear(){epoch++;credential='';cursor=null;$('orders').replaceChildren();$('totals').textContent='';$('more').hidden=true;$('token').value=''}
async function read(append=false){if(busy)return;busy=true;const generation=epoch;$('more').disabled=true;try{const r=await fetch('/api/v1/admin/shop/orders'+(append?'?cursor='+encodeURIComponent(cursor):''),{headers:{authorization:'Bearer '+credential},credentials:'omit',cache:'no-store'});const d=await r.json();if(generation!==epoch)return;if(!r.ok)throw Error(d.code);if(!append)$('orders').replaceChildren();$('totals').textContent=(d.mode==='test'?'Sandbox · ทดสอบ':'Live')+' — ยอดชำระยืนยัน (หน่วยย่อย)\\n'+d.totals.map(t=>t.currency.toUpperCase()+': '+t.amount_minor+' · '+t.order_count+' รายการ').join('\\n');for(const o of d.orders){const card=document.createElement('article');card.textContent=o.order_id+' · '+o.currency.toUpperCase()+' '+o.amount_minor+' (หน่วยย่อย) · '+(o.payment_status==='paid'?'ชำระยืนยันแล้ว · มีสิทธิ์ดาวน์โหลด':'ยังไม่ยืนยันชำระ · ยังดาวน์โหลดไม่ได้')+' · การรับไฟล์: ยังไม่มีหลักฐาน';$('orders').append(card)}cursor=d.next_cursor;$('more').hidden=!cursor;$('notice').textContent=d.orders.length?'อ่านสถานะจากคำสั่งซื้อจริงแล้ว':'ไม่มีคำสั่งซื้อในหน้านี้'}catch(e){if(generation===epoch){clear();$('notice').textContent='อ่านคำสั่งซื้อไม่ได้: '+e.message}}finally{busy=false;$('more').disabled=false}}
$('login').onsubmit=e=>{e.preventDefault();if(busy)return;const value=$('token').value;clear();credential=value;read()};$('more').onclick=()=>read(true);$('logout').onclick=()=>{clear();$('notice').textContent='ออกจากระบบแล้ว'};
</script></body></html>`;
