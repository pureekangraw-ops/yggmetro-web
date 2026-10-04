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
document.querySelectorAll("[data-route]").forEach(b=>b.addEventListener("click",()=>{const kind=b.dataset.route;setContext(kind.toUpperCase());openRoute(kind)}));
$("#resume").addEventListener("click",()=>openRoute(state.lastRoute));
$("#settings").addEventListener("click",openSettings);
$("#saveSettings").addEventListener("click",()=>{for(const k of ["metroUrl","shopUrl","officeUrl","prismUrl"]){const raw=$("#"+k).value.trim();const norm=raw?normalizeUrl(raw):"";if(raw&&!norm){toast("URL ไม่ถูกต้อง: "+k);return}state[k]=norm}save();$("#settingsDlg").close();toast("บันทึกเส้นทางแล้ว")});
$("#spectrumOpen").addEventListener("click",()=>openSpectrum());
document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{$("#mission").value=b.dataset.prompt;$("#result").value="สรุปที่ตัดสินใจต่อได้ พร้อมข้อจำกัดและ next action"}));
$("#sendSpectrum").addEventListener("click",()=>{const metro=normalizeUrl(state.metroUrl);if(!metro){toast("ตั้ง METRO / GO Hub URL ก่อน");$("#spectrum").close();openSettings();return}const mission=$("#mission").value.trim(),result=$("#result").value.trim();if(mission||result){sessionStorage.setItem("ygg-metro-spectrum-draft",JSON.stringify({mission,requestedResult:result,context,createdAt:new Date().toISOString()}))}state.lastRoute="metro";save();location.href=metro});
window.addEventListener("DOMContentLoaded",()=>{renderLast();if(!state.metroUrl)setTimeout(()=>toast("ตั้ง Metro routes ครั้งแรกได้ที่ ⚙"),500)});
