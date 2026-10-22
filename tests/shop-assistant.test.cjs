const test=require("node:test");
const assert=require("node:assert/strict");
const {pathToFileURL}=require("node:url"),path=require("node:path");
const fs=require("node:fs");
const load=()=>import(pathToFileURL(path.resolve(__dirname,"../src/index.js")).href);

test("GO chat appears only on shop pages, including detail pages",async()=>{
  const {default:web}=await load();
  const chatSource=fs.readFileSync(path.resolve(__dirname,"../public/assets/shop/go-chat.js"),"utf8");
  assert.match(chatSource,/launcher\.addEventListener\("click"/);
  assert.doesNotMatch(chatSource,/__name/);
  for(const path of ["/","/products/land-planner","/products/root-cause"]){
    const response=await web.fetch(new Request("https://shop.yggmetro.com"+path),{});
    assert.equal(response.status,200);
    const html=await response.text();
    assert.match(html,/id="go-sales-launcher"/);
    assert.match(html,/id="go-sales-messages"/);
    assert.match(html,/ช่วยค้นหาจากข้อมูลสินค้าในร้าน/);
    assert.match(html,/<script src="\/assets\/shop\/go-chat\.js" defer><\/script>/);
    const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
    for(const source of scripts)assert.doesNotThrow(()=>new Function(source));
  }
  const office=await (await web.fetch(new Request("https://office.yggmetro.com/"),{})).text();
  assert.doesNotMatch(office,/id="go-sales-launcher"/);
});

test("public catalog chat answers from shop data without provider or payment claims",async()=>{
  const {default:web}=await load();
  const originalFetch=global.fetch;
  global.fetch=async()=>{throw Error("public shop chat must never call an external model")};
  const ask=async(message,host="shop.yggmetro.com")=>{
    const response=await web.fetch(new Request("https://"+host+"/api/v1/shop/assistant",{
      method:"POST",headers:{"content-type":"application/json","cf-connecting-ip":"go-chat-test"},
      body:JSON.stringify({message})
    }),{OPENAI_API_KEY:"present-but-unused"});
    return {status:response.status,data:await response.json()};
  };
  try{
    const land=await ask("อยากวางแปลนที่ดิน");
    assert.equal(land.status,200);
    assert.equal(land.data.mode,"catalog");
    assert.match(land.data.reply,/Land Planner/);
    assert.match(land.data.reply,/ฟรี/);
    assert.equal(land.data.links[0].url,"/products/land-planner");
    const shop=await ask("ราคา SHOP HOME");
    assert.match(shop.data.reply,/US\$9/);
    const finance=await ask("Finance Simulator ซื้อได้ไหม");
    assert.match(finance.data.reply,/เตรียมเปิดขาย/);
    const payment=await ask("ผมจ่ายเงินแล้วใช่ไหม");
    assert.match(payment.data.reply,/ยังตรวจยอดหรือยืนยันสถานะไม่ได้/);
    assert.doesNotMatch(payment.data.reply,/ชำระเงินสำเร็จ/);
    const office=await ask("สวัสดี","office.yggmetro.com");
    assert.equal(office.status,404);
  }finally{global.fetch=originalFetch;}
});

test("shop assistant input is bounded, JSON only, and method limited",async()=>{
  const {default:web}=await load();
  const origin="https://shop.yggmetro.com/api/v1/shop/assistant";
  const get=await web.fetch(new Request(origin),{});
  assert.equal(get.status,405);
  const wrongType=await web.fetch(new Request(origin,{method:"POST",headers:{"content-type":"text/plain"},body:"hello"}),{});
  assert.equal(wrongType.status,415);
  const long=await web.fetch(new Request(origin,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:"a".repeat(501)})}),{});
  assert.equal(long.status,400);
  const huge=await web.fetch(new Request(origin,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:"a".repeat(2200)})}),{});
  assert.equal(huge.status,413);
});
