const test=require('node:test'),assert=require('node:assert/strict');
const page=async(path,env={})=>{const {renderShop}=await import('../src/shop.js');return renderShop(path,env)};
test('cart and checkout are real pages with empty states and a route back to shop',async()=>{
 for(const path of ['/cart','/checkout']){const r=await page(path);assert.equal(r.status,200,path);assert.match(r.html,/id="commerce-root"/);assert.match(r.html,/href="\/shop"/);for(const s of r.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Function(s[1]));}
});
test('checkout only offers configured goods and never exposes delivery keys',async()=>{
 const env={STRIPE_TEST_CHECKOUT_ENABLED:'true',STRIPE_TEST_KEY:'rk_test_fixture',STRIPE_TEST_WEBHOOK_SECRET:'whsec_fixture',SHOP_ORDERS:{prepare(){}},SHOP_DOWNLOADS:{get(){},head(){}},STRIPE_TEST_CATALOG:JSON.stringify({'finance-simulator':{enabled:true,priceId:'price_TEST',amount:900,currency:'usd',deliveryKey:'private/shop-home.zip'}})};
 const html=(await page('/products/finance-simulator',env)).html;assert.match(html,/data-add-to-cart="finance-simulator"/);assert.doesNotMatch(html,/private\/shop-home.zip|rk_test_fixture|whsec_fixture/);
 const plain=(await page('/products/finance-simulator')).html;assert.doesNotMatch(plain,/<button[^>]+data-add-to-cart/);
});
test('shared navigation uses concise text labels and keeps heading art for page titles',async()=>{
 const html=(await page('/')).html;assert.match(html,/href="\/shop"/);assert.match(html,/<span class="nav-label">Home<\/span>/);assert.match(html,/<span class="nav-label">Custom Order<\/span>/);assert.doesNotMatch(html,/nav[^]*?headings\/home\.png/);
});
