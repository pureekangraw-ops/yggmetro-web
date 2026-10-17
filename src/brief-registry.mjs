// Request-scoped customer session; only operational intake uses the PANTHEON capability.
const cookieName='__Host-ygg-brief-session';
const encoder=new TextEncoder();
const json=(code,status)=>Response.json({ok:false,code},{status,headers:{'cache-control':'no-store'}});
const hex=bytes=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
const hash=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const operationalPaths=new Map([
 ['/internal/brief/upsert','brief_upsert'],['/internal/brief/confirm','brief_confirm'],
 ['/internal/spectrum/event','sales_event'],['/internal/spectrum/go-budget','go_budget']
]);
export async function pantheonRegistryCall(env,path,payload){
 if(!operationalPaths.has(path))return null; // payments retain their independent legacy authority
 if(!env.PANTHEON||typeof env.PANTHEON.storefrontCall!=='function')return {ok:false,status:503,code:'BRIEF_BRIDGE_NOT_CONFIGURED'};
 if(!env.STOREFRONT_PRINCIPAL)return {ok:false,status:403,code:'BRIEF_SESSION_REQUIRED'};
 let result;
 try{result=await env.PANTHEON.storefrontCall({operation:operationalPaths.get(path),payload,principal:env.STOREFRONT_PRINCIPAL});}
 catch{return {ok:false,status:502,code:'BRIEF_BRIDGE_UNAVAILABLE'}}
 if(!result||typeof result.ok!=='boolean'||!Number.isInteger(result.status)||!result.body||typeof result.body!=='object'||Array.isArray(result.body))return {ok:false,status:502,code:'BRIEF_BRIDGE_INVALID_RESPONSE'};
 if(!result.ok)return {ok:false,status:502,code:String(result.body.code||'BRIEF_BRIDGE_REJECTED')}; // retain public v1 transport error contract
 return {ok:true,body:result.body};
}
export async function withBriefSession(request,env,handler){
 const mode=env?.BRIEF_REGISTRY_BACKEND??'go-hub';
 if(!['go-hub','pantheon'].includes(mode))return json('BRIEF_BACKEND_INVALID',503);
 if(mode!=='pantheon')return handler(request,env);
 const url=new URL(request.url);
 const write=/^\/(?:client\/)?api\/v1\/(?:brief\/(?:upsert|confirm)|events|go\/(?:whisper|takeover))$/.test(url.pathname);
 const page=['GET','HEAD'].includes(request.method)&&['/','/client','/client/'].includes(url.pathname);
 if(!write&&!page)return handler(request,env);
 const secret=env.BRIEF_SESSION_KEY;
 if(typeof secret!=='string'||secret.length<32)return write?json('BRIEF_SESSION_NOT_CONFIGURED',503):handler(request,env);
 if(write){
  const origin=request.headers.get('origin');
  if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return json('BRIEF_ORIGIN_DENIED',403);
 }
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 const cookies=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));
 let token=cookies.length===1?cookies[0].slice(cookieName.length+1):null,session;
 if(cookies.length>1)return json('BRIEF_SESSION_INVALID',403);
 if(token){
  const parts=token.split('.');
  if(parts.length!==3||!/^[a-f0-9]{64}$/.test(parts[0])||!/^\d{10}$/.test(parts[1])||!/^[a-f0-9]{64}$/.test(parts[2]))return json('BRIEF_SESSION_INVALID',403);
  const signature=Uint8Array.from(parts[2].match(/../g),h=>parseInt(h,16));
  if(!await crypto.subtle.verify('HMAC',key,signature,encoder.encode(parts[0]+'.'+parts[1]))||Number(parts[1])<Math.floor(Date.now()/1000))return json('BRIEF_SESSION_INVALID',403);
  session=parts[0];
 }else{
  session=hex(crypto.getRandomValues(new Uint8Array(32)));
  const value=session+'.'+Math.floor(Date.now()/1000+90*86400);
  token=value+'.'+hex(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
 }
 const scoped={...env,STOREFRONT_PRINCIPAL:await hash('customer-session:'+session)};
 const response=await handler(request,scoped);
 const headers=new Headers(response.headers);
 if(!cookies.length)headers.append('set-cookie',cookieName+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=7776000');
 if(write)headers.set('cache-control','no-store');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
