import {shopChatWidget} from './shop-assistant.js';
import content from '../public/assets/shop/studio/content.json' with {type:'json'};
const PREFIX='/assets/shop/studio/';
const headers={'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'};
export async function sitesStorefront(request,env){
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/';
 if(path===PREFIX+'widget.css')return new Response(shopChatWidget().match(/<style>([\s\S]*?)<\/style>/)[1],{headers:{...headers,'content-type':'text/css'}});
 if(path===PREFIX+'content.js')return new Response('globalThis.StorefrontContent='+JSON.stringify(content).replace(/</g,'\\u003c')+';', {headers:{...headers,'content-type':'text/javascript; charset=utf-8'}});
 // Keep server-owned checkout and order routes intact, including sandbox fixtures.
 const product=path.startsWith('/products/')&&content.products.some(p=>p.id===path.slice(10));
 if(!['/','/shop','/portfolio','/portfolio/cloud-stories','/gallery','/custom-order','/services','/contact','/hermes','/how-to-buy'].includes(path)&&!product)return null;
 if(product&&url.searchParams.get('purchase')==='1')return null;
 if(!env.ASSETS)return null;
 const asset=await env.ASSETS.fetch(new Request(url.origin+PREFIX+'index.html',{method:'GET'}));
 if(!asset.ok)return new Response('Storefront temporarily unavailable',{status:503,headers});
 const widget=shopChatWidget().replace(/<style>[\s\S]*?<\/style>/,'');
 const html=(await asset.text()).replace('</head>','<link rel="canonical" href="https://shop.yggmetro.com'+path+'"><link rel="stylesheet" href="'+PREFIX+'widget.css"></head>').replace('</body>',widget+'</body>');
 return new Response(request.method==='HEAD'?null:html,{headers:{...headers,'content-type':'text/html; charset=utf-8'}});
}
