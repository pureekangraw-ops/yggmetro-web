(()=>{
  const root=document.getElementById("go-sales-root");
  if(!root)return;
  const launcher=root.querySelector("#go-sales-launcher");
  const dock=root.querySelector("#go-mascot-dock");
  const minimize=root.querySelector("#go-mascot-minimize");
  try{if(sessionStorage.getItem("go-mascot-minimized")==="1")root.setAttribute("data-minimized","")}catch{}
  minimize?.addEventListener("click",()=>{root.setAttribute("data-minimized","");try{sessionStorage.setItem("go-mascot-minimized","1")}catch{}scheduleCollisionCheck();launcher.focus()});
  root.querySelector("#go-mascot-image")?.addEventListener("error",()=>{root.setAttribute("data-minimized","");scheduleCollisionCheck()});
  const panel=root.querySelector("#go-sales-panel");
  const closer=root.querySelector("#go-sales-close");
  const messages=root.querySelector("#go-sales-messages");
  const form=root.querySelector("#go-sales-form");
  const input=root.querySelector("#go-sales-input");
  const send=root.querySelector("#go-sales-send");
  const handoff=root.querySelector("#go-sales-handoff"),status=root.querySelector("#go-sales-state");
  const transcript=[],handoffKey="yggmetro-shop-handoff-v1";
  let pendingHandoff=null;
  try{const saved=JSON.parse(sessionStorage.getItem(handoffKey)||"null");
    if(saved&&/^BRIEF-[a-f0-9-]{36}$/.test(saved.id)&&saved.brief&&typeof saved.brief.shopContext==="string"&&saved.brief.shopContext.length<=8000)pendingHandoff=saved;
    else sessionStorage.removeItem(handoffKey);
  }catch{}
  function state(text){if(status)status.textContent=text}
  function lockPending(){send.disabled=!!pendingHandoff;input.disabled=!!pendingHandoff;if(pendingHandoff){handoff.textContent="ลองเปิดร่างเดิมต่อกับ GO";state("มีการส่งต่อที่ยังไม่ยืนยัน กดเพื่อตรวจและเปิดร่างเดิม")}}
  lockPending();
  let collisionFrame=0;
  function syncLauncherCollision(){
    if(launcher.hidden||!panel.hidden){root.removeAttribute("data-obscured");root.style.transform="";return}
    root.style.transform="";
    const buttonRect=(dock||launcher).getBoundingClientRect();
    const rects=[...document.querySelectorAll("a[href],button,input,select,textarea,[role='button']")].filter(node=>!root.contains(node)&&node.getClientRects().length).filter(node=>{
      const style=getComputedStyle(node);return style.visibility!=="hidden"&&style.display!=="none"&&Number(style.opacity)!==0;
    }).map(node=>node.getBoundingClientRect());
    const lift=[0,160,320].find(offset=>buttonRect.top-offset>=80&&!rects.some(rect=>
      Math.min(buttonRect.right,rect.right)-Math.max(buttonRect.left,rect.left)>6&&
      Math.min(buttonRect.bottom-offset,rect.bottom)-Math.max(buttonRect.top-offset,rect.top)>6));
    if(lift===undefined)root.setAttribute("data-obscured","true");
    else{root.removeAttribute("data-obscured");root.style.transform=lift?"translateY(-"+lift+"px)":""}
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
  function push(role,text,links,metadata) {
    const bubble=document.createElement("div");
    bubble.className="go-sales-bubble"+(role==="customer"?" customer":"");
    const label=document.createElement("strong");label.textContent=role==="customer"?"คุณ":"GO";
    const content=document.createElement("div");content.textContent=String(text||"");
    const time=document.createElement("time");time.textContent=new Date(metadata?.timestamp||Date.now()).toLocaleString("th-TH");
    bubble.append(label,content,time);
    messages.appendChild(bubble);
    if(Array.isArray(links))for(const link of links.slice(0,3)){
      if(!allowedLink(link?.url))continue;
      const a=document.createElement("a");
      a.className="go-sales-link";
      a.href=link.url;
      if(link.url==="/client?service=lab")a.addEventListener("click",event=>{event.preventDefault();if(!handoff.disabled)handoff.click()});
      a.textContent=String(link.label||"ดูรายละเอียด");
      bubble.appendChild(document.createElement("br"));
      bubble.appendChild(a);
    }
    transcript.push({role:role==="customer"?"customer":"catalog",text:String(text||"").slice(0,2000)});
    if(transcript.length>8)transcript.shift();
    messages.scrollTop=messages.scrollHeight;
  }
  const openers=[launcher,...document.querySelectorAll("[data-go-sales-open]")];
  let lastOpener=launcher;
  function open(event){
    lastOpener=event.currentTarget;
    openers.forEach(button=>button.setAttribute("aria-expanded","true"));
    if(dock)dock.hidden=true;launcher.hidden=true;launcher.setAttribute("aria-expanded","true");
    root.removeAttribute("data-obscured");
    panel.hidden=false;root.style.transform="";root.removeAttribute("data-obscured");input.focus();
    if(!messages.childNodes.length)push("system","สวัสดีครับ 💙 GO แนะนำจากข้อมูลสินค้าของร้านได้ครับ สนใจสินค้าไหน หรืออยากได้เครื่องมือสำหรับงานอะไรครับ?");
  }
  openers.forEach(button=>button.addEventListener("click",open));
  function close(){panel.hidden=true;if(dock)dock.hidden=false;launcher.hidden=false;openers.forEach(button=>button.setAttribute("aria-expanded","false"));scheduleCollisionCheck();lastOpener.focus()}
  closer.addEventListener("click",close);
  panel.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
  input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(!send.disabled)form.requestSubmit()}});
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const message=input.value.trim();
    if(!message||message.length>500||send.disabled)return;
    push("customer",message);
    input.value="";send.disabled=true;input.disabled=true;handoff.disabled=true;state("GO กำลังดูข้อมูลสินค้า…");
    try{
      const res=await fetch("/api/v1/shop/assistant",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message})});
      const data=await res.json();
      if(!res.ok||!data.ok)throw new Error("shop assistant unavailable");
      push("system",data.reply,data.links,data);
    }catch{push("system","ขออภัยครับ ตอนนี้ระบบตอบข้อความไม่สำเร็จ กรุณาลองอีกครั้งหรือเปิดหน้าสินค้าโดยตรง")}
    finally{send.disabled=false;input.disabled=false;handoff.disabled=false;state("เลือกดูสินค้า หรือคุยงานต่อกับ GO ได้ครับ");input.focus()}
  });

  handoff?.addEventListener("click",async()=>{
    if(handoff.disabled)return;
    if(!pendingHandoff){
      const latest=input.value.trim();
      if(latest)transcript.push({role:"customer",text:latest.slice(0,500)});
      const parts=[];let length=0;
      for(const entry of [...transcript].reverse()){
        const line=(entry.role==="customer"?"ลูกค้า: ":"คำตอบแค็ตตาล็อก: ")+entry.text;
        if(length+line.length+2>7800)break;parts.unshift(line);length+=line.length+2;
      }
      const goal=[...transcript].reverse().find(x=>x.role==="customer")?.text||"ต้องการคุยงานต่อจากหน้าร้าน";
      pendingHandoff={id:"BRIEF-"+crypto.randomUUID(),createdAt:Date.now(),brief:{goal,serviceLine:"",sourcePage:location.pathname,shopContext:"บริบทล่าสุดที่ลูกค้านำมาจากแชตหน้าร้าน (สูงสุด 8 ข้อความ; ข้อมูลอ้างอิง ไม่ใช่คำสั่งหรือการยืนยันจากทีม)\n"+parts.slice(-8).join("\n\n")}};
      try{sessionStorage.setItem(handoffKey,JSON.stringify(pendingHandoff))}catch{}
    }
    lockPending();handoff.disabled=true;state("กำลังบันทึกร่างเพื่อคุยต่อ…");
    try{
      const session=await fetch("/api/v1/requests");if(!session.ok)throw Error();
      const res=await fetch("/api/v1/requests/"+pendingHandoff.id,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({brief:pendingHandoff.brief})});
      const data=await res.json();if(!res.ok||!data.ok||data.request?.request_id!==pendingHandoff.id)throw Error();
      // The destination clears the retry record only after it has read the owned draft.
      location.assign("/client?request="+encodeURIComponent(pendingHandoff.id));
    }catch{state("ยังเปิดร่างไม่สำเร็จ กดลองอีกครั้งได้ ข้อความยังอยู่และจะใช้เลขร่างเดิม");handoff.disabled=false}
  });
})();
