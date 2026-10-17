const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib');
test('all statically referenced storefront assets exist and PNG data is complete',async()=>{
 const {renderShop}=await import('../src/shop.js');const assets=new Set();
 for(const route of ['/','/shop','/portfolio','/portfolio/cloud-stories','/custom-order','/cart','/checkout',...['land-planner','root-cause','adaptive-lens','shop-home','finance-simulator','lost-era'].map(s=>'/products/'+s)]){
  const html=renderShop(route).html;
  for(const m of html.matchAll(/(?:src="|url\(')(\/assets\/shop\/[^"')]+)/g))assets.add(m[1]);
 }
 for(const asset of assets){const data=fs.readFileSync('public'+asset);assert.ok(data.length>100,asset);
  if(asset.endsWith('.png')){let offset=8,idat=[],ended=false;assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a',asset);
   while(offset<data.length){const length=data.readUInt32BE(offset),kind=data.toString('ascii',offset+4,offset+8);assert.ok(offset+length+12<=data.length,asset+' truncated '+kind);if(kind==='IDAT')idat.push(data.subarray(offset+8,offset+8+length));if(kind==='IEND')ended=true;offset+=length+12}
   assert.ok(ended,asset+' missing IEND');assert.ok(zlib.inflateSync(Buffer.concat(idat)).length>0,asset);
  }
 }
});
