const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
async function shop(assets){
 const source=fs.readFileSync(require('node:path').join(__dirname,'../src/shop.js'),'utf8').replace(/^import .*;$/gm,'');
 return import('data:text/javascript;base64,'+Buffer.from('const shopChatWidget=()=>""; const manifest='+JSON.stringify({version:1,assets})+';\n'+source).toString('base64'));
}
test('manifest product image appears on collection and detail pages',async()=>{
 const s=await shop([{file:'land.png',alt:'Real planner',product:'land-planner',category:'product'}]);
 for(const route of ['/','/products/land-planner']) assert.match(s.renderShop(route).html,/src="\/assets\/shop\/land.png"/);
});
test('portfolio manifest images appear in gallery',async()=>{
 const s=await shop([{file:'work.png',alt:'Selected artwork',category:'portfolio'}]);
 assert.match(s.renderShop('/').html,/src="\/assets\/shop\/work.png"/);
});
test('empty manifest keeps original product cards',async()=>{
 const s=await shop([]); assert.match(s.renderShop('/').html,/LAND PLANNER/);
 assert.doesNotMatch(s.renderShop('/').html,/id="gallery"/);
});
