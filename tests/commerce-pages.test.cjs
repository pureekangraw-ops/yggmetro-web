const test=require('node:test'),assert=require('node:assert/strict');
const page=async(path,env={})=>{const {renderShop}=await import('../src/shop.js');return renderShop(path,env)};
test('cart and checkout are real pages with empty states and a route back to shop',async()=>{
 for(const path of ['/cart','/checkout']){const r=await page(path);assert.equal(r.status,200,path);assert.match(r.html,/id="commerce-root"/);assert.match(r.html,/href="\/shop"/);for(const s of r.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Function(s[1]));}
});
test('Finance remains marketplace-only even with a native checkout fixture',async()=>{
 const env={STRIPE_TEST_CHECKOUT_ENABLED:'true',STRIPE_TEST_KEY:'rk_test_fixture',STRIPE_TEST_WEBHOOK_SECRET:'whsec_fixture',SHOP_ORDERS:{prepare(){}},SHOP_DOWNLOADS:{get(){},head(){}},STRIPE_TEST_CATALOG:JSON.stringify({'finance-simulator':{enabled:true,priceId:'price_TEST',amount:900,currency:'usd',deliveryKey:'private/shop-home.zip'}})};
 const html=(await page('/products/finance-simulator',env)).html;assert.doesNotMatch(html,/<button[^>]+data-add-to-cart/);assert.doesNotMatch(html,/private\/shop-home.zip|rk_test_fixture|whsec_fixture/);
 const plain=(await page('/products/finance-simulator')).html;assert.doesNotMatch(plain,/<button[^>]+data-add-to-cart/);
});
test('navigation uses clear text labels and accessible customer paths',async()=>{
 const html=(await page('/')).html;assert.match(html,/href="\/shop"/);assert.match(html,/aria-label="Home"/);assert.match(html,/aria-label="Custom Order"/);assert.match(html,/>Home<\/a>/);assert.match(html,/>Shop<\/a>/);assert.match(html,/>Portfolio<\/a>/);assert.doesNotMatch(html,/nav-label/);
});

test('native commerce rendering remains testable with a synthetic non-marketplace product',async()=>{
 const {commerceCatalog,commerceScript}=await import('../src/commerce-pages.js');
 const env={STRIPE_TEST_CHECKOUT_ENABLED:'true',STRIPE_TEST_KEY:'rk_test_fixture',STRIPE_TEST_WEBHOOK_SECRET:'whsec_fixture',SHOP_ORDERS:{prepare(){}},SHOP_DOWNLOADS:{get(){},head(){}},STRIPE_TEST_CATALOG:JSON.stringify({'offline-fixture':{enabled:true,priceId:'price_TEST',amount:900,currency:'usd',deliveryKey:'private/fixture.zip'}})};
 const catalog=commerceCatalog([{slug:'offline-fixture',name:'Offline fixture',label:'Fixture',url:'/fixture'}],env);
 assert.deepEqual(catalog,[{slug:'offline-fixture',name:'Offline fixture',label:'Fixture',amount:900,currency:'usd',testMode:true}]);
 assert.doesNotMatch(commerceScript(catalog,{}),/private\/fixture.zip|rk_test_fixture|whsec_fixture/);
});
