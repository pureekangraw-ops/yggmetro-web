const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const load=()=>import(pathToFileURL(path.resolve(__dirname,'../src/index.js')).href);

async function page(web,host,path='/') {
  const response=await web.fetch(new Request(`https://${host}${path}`),{});
  return {response,body:await response.text()};
}

test('shop hostname serves the storefront surface',async()=>{
  const {default:web}=await load();
  const {response,body}=await page(web,'shop.yggmetro.com');
  assert.equal(response.status,200);
  assert.match(body,/<title>YGG METRO · Creative Services & Digital Assets<\\/title>/);
  assert.match(body,/data-surface="shop"/);
  assert.doesNotMatch(body,/YGG METRO · Office/);
});

test('office hostname serves a distinct office surface',async()=>{
  const {default:web}=await load();
  const {response,body}=await page(web,'office.yggmetro.com');
  assert.equal(response.status,200);
  assert.match(body,/<title>YGG METRO · Office<\\/title>/);
  assert.match(body,/data-surface="office"/);
  assert.match(body,/OFFICE/);
  assert.doesNotMatch(body,/YGG METRO · Shop/);
});

test('office does not expose the storefront client route',async()=>{
  const {default:web}=await load();
  const {response}=await page(web,'office.yggmetro.com','/client');
  assert.equal(response.status,404);
});

test('unconfigured host is not silently treated as the storefront',async()=>{
  const {default:web}=await load();
  const {response,body}=await page(web,'unknown.yggmetro.com');
  assert.equal(response.status,421);
  assert.equal(body,'Host Not Configured');
});

test('workers.dev preview and canonical root keep the storefront surface',async()=>{
  const {default:web}=await load();
  for(const host of ['yggmetro.com','yggmetro-web.example.workers.dev']){
    const {response,body}=await page(web,host);
    assert.equal(response.status,200,host);
    assert.match(body,/data-surface="shop"/,host);
  }
});
