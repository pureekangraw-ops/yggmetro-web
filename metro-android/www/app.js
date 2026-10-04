const $=s=>document.querySelector(s);
const STORE="ygg-metro-mobile-v1";
const DEFAULTS={metroUrl:"",shopUrl:"",officeUrl:"",prismUrl:"",lastRoute:""};
let state={...DEFAULTS,...safeJson(localStorage.getItem(STORE))};
let context={city:"HOME"};
function safeJson(v){try{return JSON.parse(v||"{}")}catch{return {}}}
function save(){localStorage.setItem(STORE,JSON.stringify(state))}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.remove("hidden");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.add("hidden"),1600)}
function normalizeUrl(v){const s=String(v||"").trim();if(!s)return "";try{const u=new URL(s);if(!/^https?:$/.test(u.protocol))return "";return u.toString()}catch{return ""}}
function routeUrl(kind){if(kind==="shop")return state.shopUrl;if(kind==="office")return state.officeUrl;if(kind==="prism")return state.prismUrl;if(kind==="metro")return state.metroUrl;return ""}
function openRoute(kind){const url=normalizeUrl(routeUrl(kind));if(!url){toast("ตั้ง URL ของ "+kind.toUpperCase()+" ก่อน");openSettings();return}state.lastRoute=kind;save();renderLast();location.href=url}
function renderLast(){const kind=state.lastRoute;$("#lastRoute").textContent=kind?kind.toUpperCase()+" · พร้อมเปิดต่อ":"ยังไม่มีเส้นทางล่าสุด";$("#resume").disabled=!kind}
function setContext(city){context={city};$("#contextChip").textContent="METRO · "+city;$("#routePreview").textContent="METRO → SPECTRUM → GO HUB → "+city}
function openSpectrum(city=context.city||"HOME"){setContext(city);$("#spectrum").showModal()}
function openSettings(){for(const k of ["metroUrl","shopUrl","officeUrl","prismUrl"])$("#"+k).value=state[k]||"";$("#settingsDlg").showModal()}
function bubbleApi(){return window.Capacitor?.Plugins?.MetroBubble||null}
async function refreshBubble(){
  const api=bubbleApi(),label=$("#bubbleState"),button=$("#bubbleToggle");
  if(!label||!button)return;
  if(!api){label.textContent="Bubble · ใช้ได้เมื่อเปิดเป็นแอป Android";button.disabled=true;return}
  button.disabled=false;
  try{
    const info=await api.status();
    label.textContent=info.running?"Bubble · กำลังลอย":"Bubble · "+(info.granted?"พร้อม":"รอสิทธิ์แสดงทับแอป");
    button.textContent=info.running?"ปิด Bubble":"ลอย Bubble";
    button.dataset.running=info.running?"1":"0";
  }catch{label.textContent="Bubble · UNKNOWN"}
}
async function toggleBubble(){
  const api=bubbleApi();if(!api)return toast("Bubble ใช้ได้ในแอป Android");
  try{
    const info=await api.status();
    if(info.running){await api.stop();toast("ปิด Bubble แล้ว")}
    else if(!info.granted){await api.requestPermission();toast("อนุญาต Display over other apps แล้วกลับมา METRO")}
    else{await api.start();toast("Bubble ลอยแล้ว")}
  }catch(e){toast(String(e?.message||"เปิด Bubble ไม่สำเร็จ"))}
  setTimeout(refreshBubble,350);
}

document.querySelectorAll("[data-route]").forEach(b=>b.addEventListener("click",()=>{const kind=b.dataset.route;setContext(kind.toUpperCase());openRoute(kind)}));
$("#resume").addEventListener("click",()=>openRoute(state.lastRoute));
$("#settings").addEventListener("click",openSettings);
$("#bubbleToggle").addEventListener("click",toggleBubble);
$("#saveSettings").addEventListener("click",()=>{for(const k of ["metroUrl","shopUrl","officeUrl","prismUrl"]){const raw=$("#"+k).value.trim();const norm=raw?normalizeUrl(raw):"";if(raw&&!norm){toast("URL ไม่ถูกต้อง: "+k);return}state[k]=norm}save();$("#settingsDlg").close();toast("บันทึกเส้นทางแล้ว")});
$("#spectrumOpen").addEventListener("click",()=>openSpectrum());
document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{$("#mission").value=b.dataset.prompt;$("#result").value="สรุปที่ตัดสินใจต่อได้ พร้อมข้อจำกัดและ next action"}));
$("#sendSpectrum").addEventListener("click",()=>{const metro=normalizeUrl(state.metroUrl);if(!metro){toast("ตั้ง METRO / GO Hub URL ก่อน");$("#spectrum").close();openSettings();return}const mission=$("#mission").value.trim(),result=$("#result").value.trim();if(mission||result){sessionStorage.setItem("ygg-metro-spectrum-draft",JSON.stringify({mission,requestedResult:result,context,createdAt:new Date().toISOString()}))}state.lastRoute="metro";save();location.href=metro});
window.addEventListener("DOMContentLoaded",()=>{renderLast();refreshBubble();if(!state.metroUrl)setTimeout(()=>toast("ตั้ง Metro routes ครั้งแรกได้ที่ ⚙"),500)});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshBubble()});
