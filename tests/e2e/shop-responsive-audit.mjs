// Read-only evidence capture. No clicks, form submissions, purchases or chat.
import {chromium} from 'playwright';
import {mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const origin = new URL(process.env.SHOP_AUDIT_ORIGIN || 'https://shop.yggmetro.com');
if (!['https://shop.yggmetro.com','http://127.0.0.1:8787','http://localhost:8787'].includes(origin.origin)) {
  throw new Error('Use the approved production origin or isolated local port 8787.');
}
const out = resolve(process.env.SHOP_AUDIT_OUTPUT || `test-results/shop-audit-${Date.now()}`);
mkdirSync(out); // Refuse overwriting a prior evidence run.
mkdirSync(`${out}/assets`);
const report = {origin:origin.origin, capturedAt:new Date().toISOString(), kind:'runtime-observation-not-authored-source', pages:[], assets:[], blockedRequests:[]};
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
const routes = ['/#/home','/#/gallery','/cart','/how-to-buy'];
const pending = [];
try {
  for (const [width,height,isMobile] of [[390,844,true],[768,1024,true],[1440,900,false]]) {
    const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile,hasTouch:isMobile,serviceWorkers:'block'});
    await context.route('**/*', route => {
      const req=route.request(), url=new URL(req.url());
      const allowed=req.method()==='GET' && ((url.origin===origin.origin &&
        (['/','/cart','/how-to-buy'].includes(url.pathname) || url.pathname.startsWith('/assets/'))) ||
        ['https://fonts.googleapis.com','https://fonts.gstatic.com'].includes(url.origin));
      if(allowed) return route.continue();
      report.blockedRequests.push({method:req.method(),origin:url.origin,path:url.pathname});
      return route.abort('blockedbyclient');
    });
    const page=await context.newPage();
    page.on('response', response => {
      const url=new URL(response.url());
      if(url.origin!==origin.origin || response.status()!==200) return;
      pending.push((async()=>{
        const bytes=await response.body();
        const sha256=createHash('sha256').update(bytes).digest('hex');
        try {writeFileSync(`${out}/assets/${sha256}`,bytes,{flag:'wx'});} catch(error) {if(error.code!=='EEXIST') throw error;}
        report.assets.push({url:response.url(),status:response.status(),sha256,bytes:bytes.length,contentType:response.headers()['content-type']});
      })().catch(e=>{report.assets.push({url:response.url(),error:e.message});}));
    });
    for(const route of routes) {
      const record={width,height,isMobile,deviceScaleFactor:1,route};report.pages.push(record);
      try {
        const response=await page.goto(new URL(route,origin).href,{waitUntil:'networkidle',timeout:25000});
        record.status=response?.status();
        if(!response?.ok()) throw new Error(`Document HTTP ${response?.status()}`);
        await page.evaluate(()=>document.fonts.ready);
        record.metrics=await page.evaluate(()=>{
          const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
          return {
            viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
            horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
            title:document.title,thaiText:/[\u0e00-\u0e7f]/.test(document.body.innerText),
            fonts:document.fonts.status,
            brokenImages:[...document.images].filter(e=>visible(e)&&(!e.complete||!e.naturalWidth)).map(e=>e.getAttribute('src')),
            controls:[...document.querySelectorAll('a,button')].filter(visible).map(e=>{
              const r=e.getBoundingClientRect(),style=getComputedStyle(e);
              return {text:(e.innerText||e.getAttribute('aria-label')||'').slice(0,120),href:e.getAttribute('href'),width:r.width,height:r.height,fontSize:style.fontSize,lineHeight:style.lineHeight};
            }),
            fixedElements:[...document.querySelectorAll('body *')].filter(e=>visible(e)&&getComputedStyle(e).position==='fixed').map(e=>({tag:e.tagName,id:e.id,className:typeof e.className==='string'?e.className:'',rect:e.getBoundingClientRect().toJSON()})),
          };
        });
        const name=`${width}-${route.replace(/[^a-z0-9]/gi,'_')}`;
        await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
        writeFileSync(`${out}/${name}.html`,await page.content());
      } catch(error) {record.error=error.message;}
    }
    await Promise.all(pending);
    await context.close();
  }
} finally {
  await Promise.all(pending);
  await browser.close();
  writeFileSync(`${out}/manifest.json`,JSON.stringify(report,null,2)+'\n');
}
console.log(`Read-only evidence: ${out}`);
if(report.pages.some(p=>p.error||p.metrics?.horizontalOverflow||p.metrics?.brokenImages.length)) process.exitCode=1;
