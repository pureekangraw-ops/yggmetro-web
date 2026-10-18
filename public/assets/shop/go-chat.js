(()=>{
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
  function allowedLink(url){return typeof url==="string" && (/^\/products\/[a-z0-9-]+$/.test(url)||/^\/client\?service=lab$/.test(url)||url==="/#products")}
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

})();
