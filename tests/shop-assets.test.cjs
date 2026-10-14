const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
async function worker(){
 const root=path.join(__dirname,'..');
 const source=fs.readFileSync(path.join(root,'src/index.js'),'utf8').replace(/^import .*;$/gm,'');
 return (await import('data:text/javascript;base64,'+Buffer.from('const renderShop=()=>({html:"shop",status:200}); const getShopPublicCatalog=()=>[]; const handleShopAssistant=()=>{};\n'+source).toString('base64'))).default;
}
test('missing shop asset returns 404 instead of homepage HTML',async()=>{
 const w=await worker(); const r=await w.fetch(new Request('https://shop.yggmetro.com/assets/shop/missing.png'),{ASSETS:{fetch:async()=>new Response('missing',{status:404})}});
 assert.equal(r.status,404);
});
test('asset requests fail clearly when deployment has no asset binding',async()=>{
 const w=await worker(); const r=await w.fetch(new Request('https://shop.yggmetro.com/assets/shop/manifest.json'),{});
 assert.equal(r.status,503);
});
test('asset paths reject writes',async()=>{
 const w=await worker(); const r=await w.fetch(new Request('https://shop.yggmetro.com/assets/shop/a.png',{method:'POST'}),{});
 assert.equal(r.status,405);
});
