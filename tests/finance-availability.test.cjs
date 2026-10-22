const test=require('node:test'),assert=require('node:assert/strict');
test('Finance catalog and FAQ reflect existing marketplace availability without upcoming claims',async()=>{
 const {renderShop,getShopPublicCatalog}=await import('../src/shop.js');
 const catalog=getShopPublicCatalog();
 const finance=catalog.find(p=>p.slug==='finance-simulator');
 assert.equal(finance.price,'US$19');
 assert.equal(finance.status,'ขายบน Notion Marketplace');
 assert.match(finance.note,/ประมาณ/);
 assert.match(finance.note,/ไม่ใช่คำแนะนำ.*ทางการเงิน/);
 assert.match(finance.note,/ด้วยตนเอง/);
 const faq=renderShop('/how-to-buy').html;
 assert.match(faq,/SHOP HOME, Personal Finance Simulator และ Lost Era ไปหน้าร้าน Notion/);
 for(const route of ['/shop','/products/finance-simulator','/how-to-buy']){
  assert.doesNotMatch(renderShop(route).html,/เตรียมเปิดขาย|เตรียมประกาศราคา|สอบถามวันเปิดขาย|สำหรับ Finance Simulator ยังไม่เปิด/);
 }
 assert.deepEqual(catalog.filter(p=>p.slug!=='finance-simulator').map(p=>[p.slug,p.price,p.status]),[
  ['land-planner','ฟรี','เปิดใช้ได้ฟรี'],['root-cause','7 credits / run','เปิดใช้บน PromptBase'],
  ['adaptive-lens','US$6.99','ขายบน PromptBase'],['shop-home','US$9','ขายบน Notion Marketplace'],
  ['lost-era','US$19 · ราคาเปิดตัว','หน้าร้านบน Notion']
 ]);
});
