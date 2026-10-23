(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ShopShowcase=factory();})(globalThis,function(){
'use strict';
const guides=globalThis.StorefrontContent.guides;
const galleryLinks={planner:'land-planner',finance:'finance-simulator',world:'lost-era'};
function reply(question,context,products){
 const q=String(question||'').trim().slice(0,1000),lower=q.toLowerCase();
 const named=products.find(p=>lower.includes(p.name.toLowerCase()))||products.find(p=>(guides[p.id]?.aliases||[]).some(a=>lower.includes(a)));
 const p=named||products.find(p=>p.id===context),g=p&&guides[p.id];
 const links=p?[{label:'ดู '+p.name,href:'#/product/'+p.id}]:[];
 const result=(text,extra=links)=>({text,links:extra,productId:p?.id||null});
 if(/คืนเงิน|refund|ลิขสิทธิ์|ใช้เชิงพาณิชย์|รับประกัน|ใบกำกับ|ส่วนลด|คูปอง/.test(lower))return result('ยังไม่มีเงื่อนไขเรื่องนี้ที่ยืนยันไว้ในข้อมูลร้านครับ ตรวจหน้าสินค้าปลายทาง หรือสอบถามผู้ดูแลก่อนซื้อได้เลย',[...links,{label:'ช่องทางติดต่อ',href:'#/contact'}]);
 if(/ฟรี/.test(q)&&!named&&(!p||/อะไร|ไหน|แนะนำ/.test(q)))return {text:'Land Planner ใช้ฟรีครับ เหมาะกับการวางแปลนที่ดิน 2 มิติและแปลงหน่วย ใช้สำหรับวางแผนเบื้องต้น ไม่ใช่แบบก่อสร้างรับรอง',links:[{label:'ดูวิธีใช้ Land Planner',href:'#/product/land-planner'}],productId:'land-planner'};
 if(/ออกแบบ|สั่งทำ|บรีฟ|custom|ติดต่อ|ส่งงานให้/.test(lower))return result('เริ่มที่ Custom Order เพื่อเลือกประเภทงาน ดูขอบเขตและสิ่งที่จะได้รับครับ เตรียมโจทย์ว่าอยากได้อะไร ใช้กับใคร และมีตัวอย่างที่ชอบไหม จากนั้นติดต่อผู้ดูแลเพื่อตกลงราคาและกำหนดส่ง การบันทึกบรีฟในพรีวิวนี้ยังไม่ส่งให้ร้าน',[{label:'ดูบริการ Custom Order',href:'#/studio'},{label:'ติดต่อผู้ดูแล',href:'#/contact'}]);
 if(/มือถือ|โทรศัพท์|ออฟไลน์|offline/.test(lower))return result('ยังยืนยันการใช้สินค้าจริงบนมือถือหรือออฟไลน์จากข้อมูลที่มีไม่ได้ครับ '+(g?g.limit+' ตรวจตัวอย่างและข้อกำหนดที่หน้าสินค้าก่อนเลือก':'บอกชื่อเครื่องมือที่สนใจ แล้วดูข้อกำหนดของสินค้านั้นร่วมกันได้'));
 if(/ข้อมูล|บันทึก|ซิงก์|sync|จำกัด|ข้อควร/.test(lower))return p?result(g.limit+' ครับ หากต้องการรายละเอียดเพิ่มเติม ใช้ช่องทางติดต่อผู้ดูแลได้เลย'):result('ข้อจำกัดและที่เก็บข้อมูลขึ้นกับเครื่องมือครับ บอกชื่อสินค้าที่สนใจ แล้วผมจะสรุปข้อมูลที่มีให้');
 if(/notion|โนชั่น|แอป|รูปแบบ|แตกต่าง|ต่างกัน|เทมเพลต/.test(lower)){
  if(p?.id==='shop-home')return result('SHOP HOME ในแค็ตตาล็อกนี้เป็นเทมเพลต Notion ครับ ใช้บันทึกออเดอร์ ยอดชำระ และงานของร้านด้วยตัวเอง Quick Tools ไม่ซิงก์ตารางอัตโนมัติ ส่วนแอปจัดการร้านแยกขายยังไม่มีข้อมูลราคาและฟังก์ชันที่ยืนยัน จึงยังเลือกซื้อไม่ได้');
  if(g)return result(p.name+' มีรูปแบบเป็น '+g.format+' ครับ '+g.delivery+' ไม่ควรถือว่าทุกเครื่องมือมีทั้งแบบ Notion และเว็บแอป');
  return result('เทมเพลตใช้ทำงานใน Notion ของคุณ ส่วนเว็บแอปเปิดใช้ฟังก์ชันผ่านเบราว์เซอร์ครับ แต่ละสินค้ามีรูปแบบและฟังก์ชันต่างกัน บอกชื่อเครื่องมือที่สนใจได้เลย',[{label:'เลือกเครื่องมือ',href:'#/shop'}]);
 }
 if(p?.price==='ฟรี'&&/ราคา|เท่าไหร่|กี่บาท|ซื้อ|จ่าย|รับสินค้า|รับไฟล์|ฟรีไหม|ใช้ฟรี/.test(q))return result(p.name+' ใช้ฟรีครับ '+g.delivery+' ดูวิธีใช้งานในหน้าสินค้า แล้วเปิดลิงก์ไปเริ่มใช้ได้เลย');
 if(/ราคา|เท่าไหร่|กี่บาท|ซื้อ|จ่าย|รับสินค้า|รับไฟล์|ฟรีไหม|ใช้ฟรี/.test(q))return p?result(p.name+' — '+(p.price==='ฟรี'?'ใช้ฟรี':p.price==='ดูที่หน้าสินค้า'?'ยังไม่มีราคายืนยันในแค็ตตาล็อก':'ราคาอ้างอิง '+p.price)+' ครับ '+g.delivery+' ตรวจราคาและเงื่อนไขล่าสุดที่ปลายทางก่อนซื้อ พรีวิวนี้ยังไม่รับชำระเงินจริง'):result('คุณสนใจตัวไหนครับ? ราคาและวิธีรับต่างกันในแต่ละสินค้า เลือกชื่อด้านบนหรือเปิดหน้าสินค้าเพื่อถามต่อได้เลย',[{label:'ดูสินค้า',href:'#/shop'}]);

 if(p&&/ใช้|เริ่ม|ทำอะไร|ช่วย|เหมาะ|คือ|แนะนำ|รายละเอียด|อย่างไร/.test(q))return result(p.name+' เหมาะกับ'+g.audience+'ครับ\n'+g.steps.map((s,i)=>(i+1)+'. '+s[0]+' — '+s[1]).join('\n')+'\nข้อควรรู้: '+g.limit);
 if(named)return result(p.name+' — '+p.desc+'\nรูปแบบ: '+g.format+'\nถามต่อเรื่องวิธีใช้ ราคา หรือข้อจำกัดได้ครับ');
 if(/สวัสดี|หวัดดี|hello/.test(lower))return result('สวัสดีครับ อยากวางแผนพื้นที่ จัดการร้าน เขียนเรื่องราว หรือหาเครื่องมือช่วยคิดกับ AI ครับ? บอกงานที่อยากทำ หรือเลือกสินค้าเพื่อถามต่อได้เลย',[{label:'สำรวจสินค้า',href:'#/shop'},{label:'ดูผลงาน',href:'#/gallery'}]);
 return result('ยังไม่มีข้อมูลที่พอจะตอบคำถามนี้อย่างมั่นใจครับ ลองถามเรื่องวิธีใช้ รูปแบบ ราคา หรือข้อจำกัดของสินค้าที่สนใจ หากเป็นคำถามเฉพาะ ติดต่อผู้ดูแลได้เลย',[...links,{label:'ติดต่อผู้ดูแล',href:'#/contact'}]);
}
return {guides,galleryLinks,reply};
});
