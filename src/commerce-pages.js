import {getShopProduct} from './stripe-checkout.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function commerceCatalog(products,env){return products.flatMap(p=>{if(p.url?.startsWith('https:'))return [];const c=getShopProduct(env,p.slug);return c?[{slug:p.slug,name:p.name,label:p.label,amount:c.amount,currency:c.currency,testMode:env.STRIPE_CHECKOUT_MODE!=='live'}]:[]})}
export const commerceStyle=`
.cart-link{color:white;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;min-width:44px}.cart-link img{width:24px;height:24px}.commerce-layout{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(280px,1fr);gap:38px;padding:30px 0 80px}.commerce-panel{background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:36px;min-width:0}.commerce-panel h2{font-size:26px;margin:0 0 26px}.commerce-panel label{display:grid;gap:10px;margin:24px 0}.commerce-panel input{width:100%;padding:16px;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:10px;font:inherit}.commerce-panel .btn{width:100%;margin:18px 0}.cart-item{display:flex;gap:24px;align-items:center;padding:25px 0;border-bottom:1px solid var(--line)}.cart-item h3{font-size:22px;margin:0 0 10px}.cart-item .cart-item-image{width:150px;aspect-ratio:4/3;object-fit:contain;border-radius:12px}.cart-item button{background:transparent;border:0;color:var(--muted);text-decoration:underline;min-height:44px}.order-total{display:flex;justify-content:space-between;gap:18px;padding:24px 0;border-block:1px solid var(--line);font-size:21px}.payment-info{background:#dce7fa;border-radius:12px;padding:24px;color:#14254b;margin:28px 0}.test-mode{display:block;padding:12px 18px;background:#fff2cc;color:#644600;border-radius:8px;margin:16px 0}.commerce-status{min-height:28px;color:var(--muted)}.empty-cart{padding:50px 0;text-align:center}.btn:disabled{opacity:.6;cursor:wait}.add-cart-note{color:var(--muted);font-size:13px}.commerce-panel a:not(.btn){text-decoration:underline}.commerce-intro{padding:50px 0 10px}.commerce-intro h1{font-size:42px;margin:15px 0}.commerce-intro p{color:var(--muted)}
@media(max-width:760px){.commerce-layout{grid-template-columns:1fr;gap:20px;padding-bottom:36px}.commerce-panel{padding:24px}.commerce-intro h1{font-size:34px}.cart-item{gap:16px}.cart-item .cart-item-image{width:100px}.cart-item h3{font-size:18px}}
`;
export function commercePage(path){const checkout=path==='/checkout';return `<div class="wrap commerce-intro"><p><a href="/shop">Shop</a> / <a href="/cart">Cart</a>${checkout?' / Checkout':''}</p><h1>${checkout?'Secure checkout':'Shopping cart'}</h1><p>${checkout?'ตรวจรายการก่อนเปิดหน้าชำระเงินที่ปลอดภัย':'ตะกร้านี้ใช้เฉพาะสินค้าที่เปิดชำระเงินบนเว็บไซต์'}</p></div><section class="wrap" id="commerce-root" data-checkout="${checkout}"><div class="empty-cart"><h2>ตะกร้าของคุณยังว่าง</h2><p>สินค้าบน Notion และ PromptBase เปิดซื้อและรับสินค้าที่แพลตฟอร์มนั้นโดยตรง ไม่ต้องเพิ่มลงตะกร้านี้</p><a class="btn primary" href="/shop">เลือกชมสินค้า →</a><p><a href="/how-to-buy">ดูวิธีซื้อและรับสินค้าแต่ละรายการ</a></p></div></section>`}
export function commerceScript(catalog,images){const data=JSON.stringify({catalog,images}).replace(/</g,'\\u003c');return `<script>(()=>{
const {catalog,images}=${data};const key='yggmetro-cart-v1';const root=document.getElementById('commerce-root');let selected=null;
try{selected=localStorage.getItem(key)}catch{}
const money=p=>new Intl.NumberFormat('th-TH',{style:'currency',currency:p.currency}).format(p.amount/100);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const link=(text,href,cls)=>{const a=el('a',text,cls);a.href=href;return a};
function render(){const product=catalog.find(p=>p.slug===selected);document.querySelectorAll('[data-cart-count]').forEach(n=>n.textContent=product?'1':'0');if(!root)return;if(!product)return;
root.replaceChildren();const layout=el('div',undefined,'commerce-layout');const main=el('div',undefined,'commerce-panel'),summary=el('aside',undefined,'commerce-panel');const checkout=root.dataset.checkout==='true';
main.append(el('h2',checkout?'1 · ข้อมูลติดต่อ':'สินค้าของคุณ'));const row=el('div',undefined,'cart-item');if(images[product.slug]){const img=el('img');img.src='/assets/shop/products/'+images[product.slug];img.alt=product.name;img.className='cart-item-image';row.append(img)}const details=el('div');details.append(link(product.name,'/products/'+product.slug),el('p',product.label),el('p','สิทธิ์ใช้งาน 1 ชุด · '+money(product)));row.append(details);main.append(row);
if(product.testMode){main.append(el('p','โหมดทดสอบ — ไม่มีการเรียกเก็บเงินจริง','test-mode'))}
let form,email;if(checkout){form=el('form');form.id='secure-checkout-form';const label=el('label','อีเมลสำหรับรายการสั่งซื้อ');email=el('input');email.type='email';email.autocomplete='email';email.required=true;email.maxLength=254;email.name='email';email.placeholder='you@example.com';label.append(email);form.append(label,el('h2','2 · ชำระเงิน'));const info=el('div',undefined,'payment-info');info.append(el('strong','เปิดหน้าชำระเงินของ Stripe'),el('p','กรอกข้อมูลการชำระเงินบนหน้าที่ Stripe ดูแล'));form.append(info,el('p','เมื่อได้รับการยืนยันชำระเงิน ระบบจะแสดงปุ่มรับสินค้าในหน้ารายการสั่งซื้อ'));main.append(form)}else{const remove=el('button','นำสินค้าออก');remove.type='button';remove.addEventListener('click',()=>{try{localStorage.removeItem(key)}catch{}location.reload()});main.append(remove,el('p','สั่งซื้อสินค้าดิจิทัลครั้งละ 1 รายการ','hint'))}
summary.append(el('h2','สรุปคำสั่งซื้อ'),el('p',product.name));const total=el('div',undefined,'order-total');total.append(el('span','รวม'),el('strong',money(product)));summary.append(total);const status=el('p','','commerce-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
if(checkout){const button=el('button','ดำเนินการชำระเงิน →','btn primary');button.type='submit';button.setAttribute('form',form.id);summary.append(button,status);const storageKey='yggmetro-checkout-'+product.slug+'-'+(product.testMode?'test':'live');
let requestId=null,previousEmail=null,started=false,storageReady=true,legacy=false;
try{requestId=sessionStorage.getItem(storageKey);previousEmail=sessionStorage.getItem(storageKey+'-email');started=sessionStorage.getItem(storageKey+'-started')==='true';legacy=previousEmail!==null&&!started}catch{storageReady=false}
if(!/^[a-f0-9]{64}$/.test(requestId||'')){
 if(started||legacy){storageReady=false;requestId=null}else requestId=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
}
try{if(requestId)sessionStorage.setItem(storageKey,requestId)}catch{storageReady=false}
if(previousEmail!==null)email.value=previousEmail;
if(started){email.readOnly=true;button.textContent='ตรวจและเปิดรายการเดิม →';status.textContent='มีรายการที่เริ่มไว้แล้ว ระบบจะตรวจรายการเดิมก่อนดำเนินการต่อ'}
const help=link('ติดต่อเราเรื่องรายการนี้','/client');help.hidden=true;summary.append(help);
if(legacy){button.disabled=true;email.readOnly=true;help.hidden=false;status.textContent='พบรายการจากระบบรุ่นก่อน กรุณาติดต่อเราเพื่อตรวจสถานะก่อนเริ่มใหม่'}
if(!storageReady){button.disabled=true;help.hidden=false;status.textContent='ยังเก็บข้อมูลสำหรับกู้รายการไม่ได้ กรุณาอนุญาตพื้นที่จัดเก็บของเว็บไซต์ก่อนเริ่ม'}
async function submitAttempt(payload){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const r=await fetch('/api/v1/shop/checkout',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});return {response:r,data:await r.json()}}finally{clearTimeout(timer)}
}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(button.disabled||!form.reportValidity())return;
 const contact=email.value.trim();
 if(started&&previousEmail!==contact){status.textContent='รายการเดิมยังไม่จบ กรุณาตรวจรายการเดิมหรือติดต่อเราก่อนเปลี่ยนอีเมล';help.hidden=false;return}
 // Persist the original identity before sending. Never replace an uncertain attempt automatically.
 try{sessionStorage.setItem(storageKey,requestId);sessionStorage.setItem(storageKey+'-email',contact);sessionStorage.setItem(storageKey+'-started','true')}catch{status.textContent='ยังเก็บข้อมูลสำหรับกู้รายการไม่ได้ กรุณาตรวจพื้นที่จัดเก็บของเว็บไซต์';help.hidden=false;return}
 started=true;previousEmail=contact;email.readOnly=true;button.disabled=true;status.textContent='กำลังตรวจและเตรียมรายการ…';
 try{
  const payload={slug:product.slug,requestId,email:contact};let result=await submitAttempt(payload);
  // A first response sets the HttpOnly owner cookie without contacting Stripe; retry once to confirm it.
  if(result.response.status===428&&result.data.code==='CHECKOUT_SESSION_REQUIRED')result=await submitAttempt(payload);
  const {response:r,data:d}=result;
  if(!r.ok||!d.ok)throw Error(d.code||'CHECKOUT_UNAVAILABLE');
  if(typeof d.orderUrl==='string'){
   const target=new URL(d.orderUrl,location.origin),id=target.searchParams.get('session_id');
   if(target.origin===location.origin&&target.pathname==='/order'&&!target.hash&&[...target.searchParams].length===1&&/^cs_(test|live)_[A-Za-z0-9_]+$/.test(id||'')){location.assign(target.href);return}
   throw Error('INVALID_PROVIDER_SESSION');
  }
  const url=new URL(d.url);if(url.origin!=='https://checkout.stripe.com'||url.username||url.password)throw Error('INVALID_PROVIDER_SESSION');location.assign(url.href);
 }catch(e){
  const needsHelp=['CHECKOUT_CONFLICT','CHECKOUT_EXPIRED','CHECKOUT_RECONCILIATION_REQUIRED'].includes(e.message);
  status.textContent=needsHelp?'รายการเดิมต้องตรวจสอบก่อนเริ่มใหม่ กรุณาติดต่อเราเพื่อยืนยันสถานะ':'ยังเปิดหน้าชำระเงินไม่ได้ และยังยืนยันผลรายการไม่ได้ กดตรวจรายการเดิมอีกครั้งหรือติดต่อเรา';
  if(e.message==='CHECKOUT_SESSION_REQUIRED')status.textContent='ยังยืนยันเบราว์เซอร์ไม่ได้ กรุณาอนุญาตคุกกี้ของเว็บไซต์แล้วตรวจรายการเดิมอีกครั้ง';
  help.hidden=false;button.disabled=needsHelp;button.textContent='ตรวจและเปิดรายการเดิม →';
 }
})}else summary.append(link('ไปหน้าชำระเงิน →','/checkout','btn primary'));
summary.append(el('p','ชำระเงินอย่างปลอดภัยผ่าน Stripe','hint'),link('กลับไปเลือกสินค้า','/shop'));layout.append(main,summary);root.append(layout)}
document.querySelectorAll('[data-add-to-cart]').forEach(button=>button.addEventListener('click',()=>{const slug=button.dataset.addToCart;if(!catalog.some(p=>p.slug===slug))return;try{localStorage.setItem(key,slug);location.assign('/cart')}catch{const note=document.querySelector('.add-cart-note');if(note)note.textContent='กรุณาอนุญาตการจัดเก็บข้อมูลของเว็บไซต์เพื่อใช้ตะกร้า'}}));render();
})();</script>`}
