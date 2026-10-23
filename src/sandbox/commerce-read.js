import {readCommerceOrders} from '../office-commerce.js';
import {shopOrigin} from '../shop-origin.js';

// Called only by the named Cloudflare service entrypoint, never a public route.
export async function sandboxCommerceRead(env,input={}) {
 if(env.SHOP_ENVIRONMENT!=='sandbox'||env.STRIPE_CHECKOUT_MODE!=='test'||!shopOrigin(env))return {ok:false,code:'SANDBOX_ONLY'};
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>k!=='cursor')||
   (input.cursor!==undefined&&(typeof input.cursor!=='string'||input.cursor.length>160)))return {ok:false,code:'INVALID_READ_REQUEST'};
 const params=new URLSearchParams();if(input.cursor!==undefined)params.set('cursor',input.cursor);
 const result=await(await readCommerceOrders(env,params)).json();
 if(!result.ok)return result;
 // Internal platform contract exposes approved commerce fields plus a keyset cursor,
 // totals, owner identifiers, checkout parameters or storage keys.
 return {ok:true,mode:'test',next_cursor:result.next_cursor,orders:result.orders.map(({order_id,amount_minor,currency,payment_status,download_authorized,download_evidence,customer_receipt})=>({order_id,amount_minor,currency,payment_status,download_authorized,download_evidence,customer_receipt}))};
}
