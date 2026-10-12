const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/index.js')).href);

test('Office hostname serves the shared Office surface, not the Shop client',async()=>{
  const {default:web}=await load();
  const office=await web.fetch(new Request('https://office.yggmetro.com/'),{});
  const officeHtml=await office.text();
  assert.equal(office.status,200);
  assert.match(officeHtml,/สำนักงานร่วม/);
  assert.match(officeHtml,/GO, LIGHT, แสง และทีมเครื่องมือ/);

  const officeClient=await web.fetch(new Request('https://office.yggmetro.com/client'),{});
  assert.equal(officeClient.status,404);
  assert.doesNotMatch(await officeClient.text(),/SPECTRUMSALE/);
});

test('Shop hostname continues to serve the existing client surface',async()=>{
  const {default:web}=await load();
  const shopClient=await web.fetch(new Request('https://shop.yggmetro.com/client'),{});
  assert.equal(shopClient.status,200);
  assert.match(await shopClient.text(),/SPECTRUMSALE/);
});