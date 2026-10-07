const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/index.js')).href);

test('ROOT CAUSES embed is rendered only on shop.yggmetro.com',async()=>{
  const {default:web}=await load();
  const shop=await (await web.fetch(new Request('https://shop.yggmetro.com/'),{})).text();
  const root=await (await web.fetch(new Request('https://yggmetro.com/'),{})).text();
  const office=await (await web.fetch(new Request('https://office.yggmetro.com/'),{})).text();

  assert.match(shop,/promptbase\.com\/embed\/root-causes-analysis/);
  assert.match(shop,/ROOT CAUSES/);
  assert.doesNotMatch(root,/promptbase\.com\/embed\/root-causes-analysis/);
  assert.doesNotMatch(office,/promptbase\.com\/embed\/root-causes-analysis/);
});
