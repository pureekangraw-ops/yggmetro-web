import { officeShell, OFFICE_PAGES } from './office-shell.mjs';

const OFFICE_ASSETS=new Set(['/go-hub-office-surface.css','/go-hub-office-surface.js','/go-hub-office-login.js']);

function baseHeaders(extra={}){
 return {'cache-control':'no-store, max-age=0',pragma:'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",...extra};
}
function json(payload,status=200){return new Response(JSON.stringify(payload),{status,headers:baseHeaders({'content-type':'application/json; charset=utf-8'})});}
function html(body,status=200){return new Response(body,{status,headers:baseHeaders({'content-type':'text/html; charset=utf-8'})});}
function redirect(request,pathname){return Response.redirect(new URL(pathname,request.url).toString(),303);}
function authorityUnavailable(){return json({ok:false,code:'OFFICE_AUTHORITY_UNAVAILABLE',authorityOwner:'go-hub'},503);}

function loginPage(errorCode=''){
 const safeError=errorCode==='OFFICE_AUTH_FAILED'?'OFFICE_AUTH_FAILED':'';
 const error=safeError?`<p class="office-auth-error" role="alert">${safeError}</p>`:'';
 return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b1118"><title>YGG METRO Office</title><link rel="stylesheet" href="/go-hub-office-surface.css"></head><body class="office-body"><main class="office-login"><section class="office-login-card"><p class="office-kicker">YGG METRO</p><h1>OFFICE</h1><p class="office-muted">Owner workspace · secure entry</p>${error}<button type="button" data-passkey-login hidden>Use Passkey</button><p class="office-muted" data-passkey-login-status></p><details><summary>Use bootstrap passcode</summary><form method="post" action="/office/login"><label>Passcode<input name="passcode" type="password" autocomplete="current-password" required></label><button type="submit">Enter Office</button></form></details></section></main><script type="module" src="/go-hub-office-login.js"></script></body></html>`;
}

async function hubFetch(request,env){
 if(!env?.GO_HUB||typeof env.GO_HUB.fetch!=='function')return null;
 try{return await env.GO_HUB.fetch(request);}catch{return null;}
}

async function servePage(request,env,page){
 const sessionUrl=new URL('/office/session',request.url);
 const sessionHeaders=new Headers();
 const cookie=request.headers.get('cookie');
 if(cookie)sessionHeaders.set('cookie',cookie);
 const session=await hubFetch(new Request(sessionUrl,{method:'GET',headers:sessionHeaders}),env);
 if(!session)return authorityUnavailable();
 if(session.status===401||session.status===403)return redirect(request,'/office/login');
 if(!session.ok)return authorityUnavailable();
 return html(officeShell(page));
}

export function createOfficeWorker(){
 return {async fetch(request,env={}){
  const url=new URL(request.url),pathname=url.pathname;
  if(pathname==='/health'&&request.method==='GET')return json({ok:true,service:'yggmetro-office',surfaceOwner:'yggmetro-web',authorityOwner:'go-hub'});
  if(pathname==='/'&&request.method==='GET')return redirect(request,'/office');
  if(OFFICE_ASSETS.has(pathname)&&request.method==='GET'){
   if(!env.ASSETS||typeof env.ASSETS.fetch!=='function')return json({ok:false,code:'OFFICE_ASSET_NOT_FOUND'},404);
   return env.ASSETS.fetch(request);
  }
  if(pathname==='/office/login'&&request.method==='GET')return html(loginPage(url.searchParams.get('error')||''));
  const normalized=pathname==='/office/'?'/office':pathname;
  if(request.method==='GET'&&Object.prototype.hasOwnProperty.call(OFFICE_PAGES,normalized))return servePage(request,env,OFFICE_PAGES[normalized]);
  if(pathname==='/office'||pathname.startsWith('/office/')){
   const response=await hubFetch(request,env);
   return response||authorityUnavailable();
  }
  return json({ok:false,code:'OFFICE_ROUTE_NOT_FOUND'},404);
 }};
}

export default createOfficeWorker();
