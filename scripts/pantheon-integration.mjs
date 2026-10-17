// Local workerd integration, real D1 and R2; synthetic fixture identities only.
// This does not deploy, call production, or certify production OAuth/customer migration.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {Miniflare,Log,LogLevel,convertV4MiniflareOptions} from 'miniflare';
const webRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(webRoot,'..');
const pantheon=process.env.PANTHEON_SOURCE_DIR||path.join(root,'Pantheon-WorkHub');
const callers=process.env.REWIRE_CALLER_ROOT||path.join(root,'callers');
const scratch=await mkdtemp(path.join(webRoot,'.pantheon-rewire-e2e-'));
let mf;
const checks=[];
try{
 const bundles={};
 const entries={web:path.join(webRoot,'src/index.js'),pantheon:path.join(pantheon,'cloudflare/production/direct-entrypoint.mjs'),
 factory:path.join(callers,'Factory-District/src/worker.mjs'),light:path.join(callers,'LIGHT-BOOKMARK/src/index.js')};
 const goHarness=path.join(scratch,'go-harness.mjs');
 await writeFile(goHarness,`import go from ${JSON.stringify(path.join(callers,'Go-Together/worker/index.js'))};\nexport default {fetch(r,e){return go.fetch(r,e,{access:{aud:'local-fixture',async getIdentity(){return {email:'owner@example.test'}}}})}};\n`);
 entries.go=goHarness;
 for(const [name,entry] of Object.entries(entries)){
  bundles[name]=path.join(scratch,name+'.mjs');
  await build({entryPoints:[entry],outfile:bundles[name],bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:workers'],logLevel:'silent'});
 }
 const secret='isolated-local-rail-key-'.repeat(3);
 const factorySha=execFileSync('git',['rev-parse','HEAD'],{cwd:path.join(callers,'Factory-District'),encoding:'utf8'}).trim();
 mf=new Miniflare(convertV4MiniflareOptions({log:new Log(LogLevel.ERROR),workers:[
  {name:'web',modules:true,scriptPath:bundles.web,compatibilityDate:'2026-10-13',bindings:{BRIEF_REGISTRY_BACKEND:'pantheon',BRIEF_SESSION_KEY:'isolated-session-key-'.repeat(3)},serviceBindings:{PANTHEON:{name:'pantheon',entrypoint:'StorefrontBridge'}}},
  {name:'pantheon',modules:true,scriptPath:bundles.pantheon,compatibilityDate:'2026-10-13',bindings:{STOREFRONT_INGRESS_ENABLED:'true',WORKHUB_TOKEN:'isolated-owner-token-'.repeat(3),FACTORY_PANTHEON_SECRET:secret},d1Databases:{DB:'pantheon-local'},serviceBindings:{FACTORY:'factory'}},
  {name:'factory',modules:true,scriptPath:bundles.factory,compatibilityDate:'2026-10-13',bindings:{SOURCE_SHA:factorySha,PANTHEON_FACTORY_RAIL_SECRET:secret},r2Buckets:{RECORD_STORE:'factory-local'}},
  {name:'light',modules:true,scriptPath:bundles.light,compatibilityDate:'2026-10-13',bindings:{LIGHT_BOOKMARK_TOKEN:'isolated-light-token'},d1Databases:{BOOKMARKS:'light-local'},serviceBindings:{PANTHEON:'pantheon'}},
  {name:'go',modules:true,scriptPath:bundles.go,compatibilityDate:'2026-10-13',bindings:{ACCESS_AUD:'local-fixture',OWNER_EMAIL:'owner@example.test'},serviceBindings:{PANTHEON:'pantheon',PANTHEON_OWNER:{name:'pantheon',entrypoint:'OwnerBridge'}}}
 ]}));
 const DB=await mf.getD1Database('DB','pantheon');
 for(const file of ['test-schema.sql','migrations/0004_storefront.sql']){
  const schema=await readFile(path.join(pantheon,'cloudflare/production',file),'utf8');
  for(const statement of schema.replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await DB.prepare(statement).run();
 }
 const web=await mf.getWorker('web');let cookie;
 const p={version:'1',briefId:'BRIEF-local',clientId:'CLIENT-local',conversationId:'CONV-local',brief:{goal:'A local company profile',jobType:'PROFILE'}};
 const send=async(action,body=p,c=cookie)=>{
  const r=await web.fetch('https://yggmetro.com/api/v1/brief/'+action,{method:'POST',headers:{'content-type':'application/json',...(c?{cookie:c}:{})},body:JSON.stringify(body)});
  if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};
 };
 const draft=await send('upsert');assert.equal(draft.status,200,JSON.stringify(draft));
 const confirmed=await send('confirm');assert.equal(confirmed.status,200,JSON.stringify(confirmed));assert.equal(confirmed.body.workCreated,true);
 const duplicate=await send('confirm');assert.equal(duplicate.status,200);assert.equal(duplicate.body.workCreated,false);assert.equal(duplicate.body.workId,confirmed.body.workId);
 const impersonation=await send('confirm',p,'');assert.equal(impersonation.status,502);assert.equal(impersonation.body.code,'BRIEF_OWNER_MISMATCH');
 checks.push({workflow:'YGG METRO -> named StorefrontBridge -> real local D1',status:'PASS',task_id:confirmed.body.work.task_id});
 const go=await mf.getWorker('go');
 async function goCall(name,args={}){
  const r=await go.fetch('https://go-together.pureekangraw.workers.dev/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});
  assert.equal(r.status,200);const body=await r.json();assert.ok(!body.error,JSON.stringify(body));assert.ok(!body.result.isError,JSON.stringify(body));return JSON.parse(body.result.content[0].text);
 }
 const queued=await goCall('pantheon_command',{operation:'queue_factory',request:'Local LOGIC trainee integration acceptance'});
 assert.equal(queued.ok,true,JSON.stringify(queued));const taskId=queued.result.task_id;
 const dispatch=await goCall('pantheon_command',{operation:'dispatch_factory',task_id:taskId,approved:true});
 assert.equal(dispatch.ok,true,JSON.stringify(dispatch));
 const readback=await goCall('pantheon_factory',{task_id:taskId});
 assert.equal(readback.ok,true,JSON.stringify(readback));assert.equal(readback.result.job.status,'COMPLETED',JSON.stringify(readback));
 assert.ok(readback.result.job.receipt_id);assert.equal((await DB.prepare('SELECT status FROM tasks WHERE task_id=?').bind(taskId).first()).status,'COMPLETED');
 checks.push({workflow:'GO MCP -> OwnerBridge -> PANTHEON -> HMAC Factory LOGIC -> local R2 receipt/readback',status:'PASS',task_id:taskId,receipt_id:readback.result.job.receipt_id});
 const light=await mf.getWorker('light');const lightResponse=await light.fetch('https://light-bookmark.test/mcp',{method:'POST',headers:{authorization:'Bearer isolated-light-token','content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'pantheon_health',arguments:{}}})});
 assert.equal(lightResponse.status,200);const lightBody=await lightResponse.json();assert.ok(!lightBody.result.isError,JSON.stringify(lightBody));
 const lightValue=JSON.parse(lightBody.result.content[0].text);assert.equal(lightValue.connected,true,JSON.stringify(lightValue));
 checks.push({workflow:'LIGHT authenticated MCP -> PANTHEON -> Factory health',status:'PASS'});
 const unauthorized=await light.fetch('https://light-bookmark.test/mcp',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(unauthorized.status,401);
 const ph=await mf.getWorker('pantheon');const publicIngress=await ph.fetch('https://phatheon-workhub.test/internal/brief/confirm',{method:'POST',body:JSON.stringify(p)});assert.equal(publicIngress.status,401);
 assert.equal((await DB.prepare('SELECT count(*) n FROM storefront_briefs').first()).n,1);
 checks.push({workflow:'Anonymous public receiver and LIGHT access denied',status:'PASS'});
 const report={evidence_type:'LOCAL_WORKERD_D1_R2_INTEGRATION',production_verified:false,source_revisions:{factory:factorySha},checks,
  limitations:['GO edge Access identity is a local fixture, not production OAuth verification.','No production resources or customer records used.','No customer-data migration or paid checkout was tested.']};
 const output=process.env.REWIRE_REPORT||path.join(webRoot,'pantheon-integration-result.json');await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{if(mf)await mf.dispose();await rm(scratch,{recursive:true,force:true});}
