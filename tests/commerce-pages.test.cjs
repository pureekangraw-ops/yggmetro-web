const test=require('node:test'),assert=require('node:assert/strict');
const page=async(path,env={})=>{const {renderShop}=await import('../src/shop.js');return renderShop(path,env)};
test('cart and checkout are real pages with empty states and a route back to shop',async()=>{
 for(const path of ['/cart','/checkout']){const r=await page(path);assert.equal(r.status,200,path);assert.match(r.html,/id="commerce-root"/);assert.match(r.html,/href="\/shop"/);for(const s of r.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Function(s[1]));}
});
test('checkout only offers configured goods and never exposes delivery keys',async()=>{
 const env={STRIPE_TEST_CHECKOUT_ENABLED:'true',STRIPE_TEST_KEY:'rk_test_fixture',STRIPE_TEST_WEBHOOK_SECRET:'whsec_fixture',SHOP_ORDERS:{prepare(){}},SHOP_DOWNLOADS:{get(){},head(){}},STRIPE_TEST_CATALOG:JSON.stringify({'finance-simulator':{enabled:true,priceId:'price_TEST',amount:900,currency:'usd',deliveryKey:'private/shop-home.zip'}})};
 const html=(await page('/products/finance-simulator',env)).html;assert.doesNotMatch(html,/data-add-to-cart="finance-simulator"/);assert.match(html,/www\.notion\.com\/th\/templates\/ygg-metro-personal-finance-simulator/);assert.doesNotMatch(html,/private\/shop-home.zip|rk_test_fixture|whsec_fixture/);
 const plain=(await page('/products/finance-simulator')).html;assert.doesNotMatch(plain,/<button[^>]+data-add-to-cart/);
});
test('navigation uses clear text labels and accessible customer paths',async()=>{
 const html=(await page('/')).html;assert.match(html,/href="\/shop"/);assert.match(html,/aria-label="Home"/);assert.match(html,/aria-label="Custom Order"/);assert.match(html,/>Home<\/a>/);assert.match(html,/>Shop<\/a>/);assert.match(html,/>Portfolio<\/a>/);assert.doesNotMatch(html,/nav-label/);
});
test('the 40 baht sample exists only on a valid sandbox and uses the same server price throughout',async()=>{
 const {getShopPublicCatalog}=await import('../src/shop.js');
 const env={SHOP_ENVIRONMENT:'sandbox',SHOP_SANDBOX_ORIGIN:'https://yggmetro-shop-sandbox.example',STRIPE_TEST_CHECKOUT_ENABLED:'true',STRIPE_TEST_KEY:'rk_test_fixture',STRIPE_TEST_WEBHOOK_SECRET:'whsec_fixture',SHOP_ORDERS:{prepare(){}},SHOP_DOWNLOADS:{get(){},head(){}},STRIPE_TEST_CATALOG:JSON.stringify({'checkout-test':{enabled:true,priceId:'price_TEST',amount:4000,currency:'thb',deliveryKey:'private/test.zip'}})};
 assert.equal((await page('/products/checkout-test')).status,404);
 assert.equal(getShopPublicCatalog().some(p=>p.slug==='checkout-test'),false);
 assert.equal(getShopPublicCatalog(env).some(p=>p.slug==='checkout-test'),true);
 const product=await page('/products/checkout-test',env);assert.equal(product.status,200);assert.match(product.html,/฿40\.00/);assert.match(product.html,/data-add-to-cart="checkout-test"/);
 const checkout=await page('/checkout',env);assert.match(checkout.html,/"amount":4000,"currency":"thb"/);assert.doesNotMatch(checkout.html,/price_TEST|private\/test.zip|rk_test_fixture|whsec_fixture/);
 const bad={...env,STRIPE_TEST_CATALOG:env.STRIPE_TEST_CATALOG.replace('4000','900')};assert.doesNotMatch((await page('/products/checkout-test',bad)).html,/<button[^>]+data-add-to-cart/);
});
