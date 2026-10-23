const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const workflow = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');

// Deliberately accept only this workflow's small YAML subset. Unknown syntax,
// duplicate keys and policy-changing fields fail closed; no extra dependency.
function parseYaml(text) {
  const lines = text.split('\n'); let pos = 0;
  const indent = s => s.match(/^ */)[0].length;
  const scalar = s => {
    if (!s) return null;
    if (/^\[.*\]$/.test(s)) return s.slice(1,-1).split(',').map(x=>scalar(x.trim()));
    if (/^['"].*['"]$/.test(s)) return s.slice(1,-1);
    assert.ok(!/^[&*!>|{]/.test(s), 'unsupported YAML scalar');
    return s;
  };
  function skip() { while(pos < lines.length && /^\s*(#.*)?$/.test(lines[pos])) pos++; }
  function block(level) {
    skip(); const array = lines[pos]?.slice(level).startsWith('- '); const out = array ? [] : {};
    function pair(target, raw, keyLevel) {
      const m = /^([\w-]+):(?: (.*))?$/.exec(raw); assert.ok(m, `unsupported YAML: ${raw}`);
      const [,key,value=''] = m; assert.ok(!Object.hasOwn(target,key), `duplicate ${key}`);
      if(value === '|') {
        let body=[];
        while(pos<lines.length && (!lines[pos].trim() || indent(lines[pos])>keyLevel)) {
          const line=lines[pos++]; if(line.trim()) assert.ok(indent(line)>=keyLevel+2);
          body.push(line.slice(keyLevel+2));
        }
        target[key]=body.join('\n').trimEnd()+'\n';
      } else if(value) target[key]=scalar(value);
      else { skip(); target[key]=pos<lines.length && indent(lines[pos])>keyLevel ? block(indent(lines[pos])) : null; }
    }
    while(true) {
      skip(); if(pos>=lines.length || indent(lines[pos])<level) break;
      assert.equal(indent(lines[pos]),level,'unexpected YAML indentation');
      const raw=lines[pos++].slice(level);
      if(array) {
        assert.ok(raw.startsWith('- ')); const item={}; pair(item,raw.slice(2),level+2);
        skip();
        while(pos<lines.length && indent(lines[pos])>level) {
          assert.equal(indent(lines[pos]),level+2); pair(item,lines[pos++].slice(level+2),level+2); skip();
        }
        out.push(item);
      } else pair(out,raw,level);
    }
    return out;
  }
  assert.ok(!text.includes('\t')); return block(0);
}
const tokenEnv = {
  CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
  CLOUDFLARE_ACCOUNT_ID: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
};
const install = 'npm ci --no-audit --no-fund';
const build = './node_modules/.bin/wrangler deploy --dry-run --outdir .deploy-build\nfind .deploy-build public -type f -print0 | sort -z | xargs -0 sha256sum > .deploy-build.sha256\nsha256sum wrangler.jsonc >> .deploy-build.sha256\n';
function policy(text, config = JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'))) {
  const w=parseYaml(text);
  assert.deepEqual(Object.keys(w).sort(),['jobs','name','on','permissions']);
  assert.deepEqual(w.on,{workflow_dispatch:null,push:{branches:['main']}});
  assert.deepEqual(w.permissions,{contents:'read'});
  assert.deepEqual(Object.keys(w.jobs),['safety','deploy']);
  const {safety,deploy}=w.jobs;
  assert.deepEqual(Object.keys(safety).sort(),['runs-on','steps']);
  assert.deepEqual(Object.keys(deploy).sort(),['needs','runs-on','steps']);
  assert.equal(deploy.needs,'safety');
  for(const job of [safety,deploy]) {
    assert.equal(job['runs-on'],'ubuntu-latest');
    for(const step of job.steps) {
      for(const key of Object.keys(step)) assert.ok(['name','uses','with','run','shell','env','id'].includes(key),`unsafe step field: ${key}`);
      if(step.uses) assert.ok(['actions/checkout@v4','actions/setup-node@v4'].includes(step.uses));
    }
    assert.deepEqual(job.steps[0],{uses:'actions/checkout@v4'});
    assert.deepEqual(job.steps[1],{uses:'actions/setup-node@v4',with:{'node-version':'22'}});
    assert.equal(job.steps[2].run,install);
  }
  assert.equal(safety.steps.length,5); assert.equal(deploy.steps.length,7);
  assert.equal(safety.steps[3].run,'npm test');
  assert.equal(safety.steps[4].run,'node --check src/index.js\nnode --check ygg-vault-android/www/app.js\n');
  assert.equal(deploy.steps[3].run,build);
  const upload=deploy.steps[4], resolve=deploy.steps[5], smoke=deploy.steps[6];
  assert.deepEqual(upload.env,{...tokenEnv,WRANGLER_SEND_METRICS:'false'});
  assert.deepEqual(resolve.env,tokenEnv);
  assert.equal(resolve.id,'smoke_origin');
  assert.deepEqual(smoke.env,{SMOKE_ORIGIN:'${{ steps.smoke_origin.outputs.origin }}'});
  for(const step of [...safety.steps,...deploy.steps]) {
    if(step===upload || step===resolve) continue;
    assert.doesNotMatch(JSON.stringify(step),/CLOUDFLARE|secrets\./i,'no deployment credential access');
    if(step!==smoke) assert.deepEqual(step.env || {},step===deploy.steps[3]?{WRANGLER_SEND_METRICS:'false'}:{});
  }
  assert.equal(upload.run, 'test -n "${CLOUDFLARE_API_TOKEN}" || { echo "::error::CLOUDFLARE_API_TOKEN is not available to yggmetro-web"; exit 1; }\n' +
    'test -n "${CLOUDFLARE_ACCOUNT_ID}" || { echo "::error::CLOUDFLARE_ACCOUNT_ID is not available to yggmetro-web"; exit 1; }\n' +
    'sha256sum --check .deploy-build.sha256\n./node_modules/.bin/wrangler deploy .deploy-build/index.js --no-bundle\n');
  for(const step of [upload,resolve,smoke]) assert.equal(step.shell,'bash');
  assert.match(resolve.run,/appendFileSync\(process.env.GITHUB_OUTPUT, `origin=\$\{origin\}\\n`\)/);
  assert.doesNotMatch(smoke.run,/api\.cloudflare\.com|authorization|process\.env\.(?!SMOKE_ORIGIN)/);
  for(const required of ['healthRes.ok','health?.ok !== true','health?.service !== "yggmetro-web"','health?.spectrumSaleConfigured !== true','clientRes.ok','client?.provider !== "openai"','typeof client?.intent !== "string"','/health','/api/v1/interpret','surface:"SPECTRUMSALE", stage:"SALES"']) assert.ok(smoke.run.includes(required),required);
  // Wrangler getEntry() invokes custom builds even with --no-bundle. Fail closed
  // on future build configuration requiring a new isolated deployment design.
  assert.equal(config.build,undefined,'custom build would run with token');
  assert.equal(config.main,'src/index.js');
  assert.equal(config.name,'yggmetro-web');
  assert.deepEqual(config.assets,{directory:'./public',binding:'ASSETS',run_worker_first:true});
  assert.equal(config.compatibility_flags,undefined,'review compatibility transformations');
  assert.equal(config.find_additional_modules,undefined,'review extra module packaging');
  return w;
}
test('deployment policy: validation gates, scoped credentials, prebuilt bytes and smoke contract',()=>policy(workflow));
const fixtures = [
  ['workflow secrets',s=>s.replace('jobs:','env:\n  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\njobs:')],
  ['job secrets',s=>s.replace('    needs: safety','    env:\n      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n    needs: safety')],
  ...['Install dependencies','Run regression tests before deployment','Prebuild Worker without credentials'].map(name=>[`${name} token`,s=>s.replace(`- name: ${name}`,`- name: ${name}\n        env:\n          CLOUDFLARE_API_TOKEN: \u0024{{ secrets.CLOUDFLARE_API_TOKEN }}`)]),
  ['public smoke token',s=>s.replace('          SMOKE_ORIGIN:', '          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}\n          SMOKE_ORIGIN:')],
  ['dependency bypass',s=>s.replace('needs: safety','needs: []')],
  ['always bypass',s=>s.replace('    needs: safety','    if: always()\n    needs: safety')],
  ['ignored test failure',s=>s.replace('run: npm test','continue-on-error: true\n        run: npm test')],
  ['removed tests',s=>s.replace('run: npm test','run: echo skipped')],
  ['bundling with token',s=>s.replace(' --no-bundle','')],
  ['wrong entry',s=>s.replace('deploy .deploy-build/index.js','deploy src/index.js')],
  ['missing identity verification',s=>s.replace('sha256sum --check .deploy-build.sha256','true')],
  ['asset omission',s=>s.replace('find .deploy-build public','find .deploy-build')],
  ['extra deployment work',s=>s.replace(' --no-bundle\n',' --no-bundle\n          npm test\n')],
  ['trigger loss',s=>s.replace('branches: [main]','branches: [other]')],
  ['permission escalation',s=>s.replace('contents: read','contents: write')],
  ['Node version loss',s=>s.replace('node-version: 22','node-version: 20')],
  ...['healthRes.ok','health?.ok !== true','health?.service !== "yggmetro-web"','health?.spectrumSaleConfigured !== true','clientRes.ok','client?.provider !== "openai"','typeof client?.intent !== "string"'].map(condition=>[condition,s=>s.replace(condition,'false')]),
];
for(const [name,mutate] of fixtures) test(`reject negative fixture: ${name}`,()=>{
  const changed=mutate(workflow);assert.notEqual(changed,workflow);assert.throws(()=>policy(changed));
});
test('reject future custom build and packaging changes',()=>{
  const c=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
  for(const extra of [{build:{command:'npm run build'}},{compatibility_flags:['nodejs_compat']},{find_additional_modules:true},{assets:{directory:'elsewhere'}}]) assert.throws(()=>policy(workflow,{...c,...extra}));
});

function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ygg-workflow-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dir,'bin'));fs.mkdirSync(path.join(dir,'node_modules/.bin'),{recursive:true});fs.mkdirSync(path.join(dir,'public'));
  fs.writeFileSync(path.join(dir,'public/asset.txt'),'synthetic asset');fs.writeFileSync(path.join(dir,'wrangler.jsonc'),'{}');
  const log=path.join(dir,'log.jsonl');
  const stub=`#!${process.execPath}\nconst fs=require('node:fs'); const args=process.argv.slice(2); const command=require('node:path').basename(process.argv[1]);\nfs.appendFileSync(process.env.STUB_LOG,JSON.stringify({command,args,token:process.env.CLOUDFLARE_API_TOKEN,account:process.env.CLOUDFLARE_ACCOUNT_ID})+'\\n');\nif(command==='wrangler' && args.includes('--dry-run')){fs.mkdirSync('.deploy-build',{recursive:true});fs.writeFileSync('.deploy-build/index.js','export default {};\\n');}\n`;
  for(const file of ['bin/npm','bin/node','node_modules/.bin/wrangler']) fs.writeFileSync(path.join(dir,file),stub,{mode:0o755});
  const env={PATH:path.join(dir,'bin')+':'+process.env.PATH,HOME:dir,STUB_LOG:log,GITHUB_OUTPUT:path.join(dir,'output')};
  function run(step,extra={}) {
    const values=Object.fromEntries(Object.entries(step.env||{}).map(([key,value])=>[key,value===tokenEnv[key]?(key==='CLOUDFLARE_API_TOKEN'?'synthetic-token':'synthetic-account'):value]));
    return spawnSync('bash',['--noprofile','--norc','-e','-o','pipefail','-c',step.run],{cwd:dir,env:{...env,...values,...extra},encoding:'utf8'});
  }
  return {dir,env,run,records:()=>fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse)};
}
test('execute install/test/build/deploy commands with synthetic environments and stub Wrangler',t=>{
  const f=fixture(t),w=policy(workflow);
  for(const job of Object.values(w.jobs)) for(const step of job.steps.filter(s=>s.run).slice(0,job===w.jobs.deploy?3:undefined)) {
    const r=f.run(step);assert.equal(r.status,0,r.stderr);
  }
  const records=f.records();assert.ok(records.some(r=>r.command==='npm'&&r.args[0]==='test'));
  const uploads=records.filter(r=>r.command==='wrangler'&&!r.args.includes('--dry-run'));
  assert.equal(uploads.length,1);assert.deepEqual(uploads[0].args,['deploy','.deploy-build/index.js','--no-bundle']);
  for(const r of records) {
    assert.equal(r.token,uploads.includes(r)?'synthetic-token':undefined);
    assert.equal(r.account,uploads.includes(r)?'synthetic-account':undefined);
  }
  for(const file of ['.deploy-build/index.js','public/asset.txt','wrangler.jsonc']) {
    const target=path.join(f.dir,file),original=fs.readFileSync(target);
    fs.appendFileSync(target,'tampered');
    assert.notEqual(f.run(w.jobs.deploy.steps[4]).status,0,`${file} tamper must fail`);
    fs.writeFileSync(target,original);
  }
  for(const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID']) {
    assert.notEqual(f.run(w.jobs.deploy.steps[4],{[key]:''}).status,0,'missing credential must fail');
  }
  assert.equal(f.records().filter(r=>r.command==='wrangler'&&!r.args.includes('--dry-run')).length,1,'hash failure must prevent upload');
});

// Run the exact embedded Node scripts in subprocesses; all fetches are mocked.
// Unexpected endpoints or authorization on public smoke fail, never use network.
function runNetworkStep(t,step,scenario) {
  const f=fixture(t);
  const preload=path.join(f.dir,'fetch.mjs');
  fs.writeFileSync(preload,`import assert from 'node:assert/strict';
const scenario=JSON.parse(process.env.SCENARIO);let calls=0;
globalThis.fetch=async(url,options={})=>{
 calls++;
 if(url.includes('api.cloudflare.com')) {
  assert.equal(url,'https://api.cloudflare.com/client/v4/accounts/synthetic-account/workers/subdomain');
  assert.equal(options.headers.authorization,'Bearer synthetic-token');
  return {ok:scenario.http!==false,json:async()=>({success:scenario.success!==false,result:{subdomain:scenario.subdomain??'fixture'}})};
 }
 assert.equal(process.env.CLOUDFLARE_API_TOKEN,undefined);assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,undefined);
 assert.equal(options.headers?.authorization,undefined);
 assert.ok(url.startsWith('https://yggmetro-web.fixture.workers.dev/'));
 if(url.endsWith('/health'))return {ok:scenario.healthHttp!==false,json:async()=>({ok:true,service:'yggmetro-web',spectrumSaleConfigured:true,...scenario.health})};
 assert.equal(url,'https://yggmetro-web.fixture.workers.dev/api/v1/interpret');assert.equal(options.method,'POST');
 assert.deepEqual(JSON.parse(options.body),{version:'1',text:'อยากทำ company profile ประมาณ 12 หน้า',context:{surface:'SPECTRUMSALE',stage:'SALES'}});
 return {ok:scenario.clientHttp!==false,json:async()=>({provider:'openai',intent:'fixture',...scenario.client})};
};
process.on('exit',code=>{if(code===0)assert.equal(calls,scenario.lookup?1:2)});
`);
  // Replace only the executable in the harness, preserving the workflow script.
  const result=f.run({...step,run:step.run.replace("node --input-type",`'${process.execPath}' --input-type`)},{NODE_OPTIONS:`--import=${preload}`,SCENARIO:JSON.stringify(scenario),SMOKE_ORIGIN:'https://yggmetro-web.fixture.workers.dev'});
  return {result,output:fs.existsSync(f.env.GITHUB_OUTPUT)?fs.readFileSync(f.env.GITHUB_OUTPUT,'utf8'):''};
}
test('lookup passes only a validated nonsecret origin to public smoke',t=>{
  const steps=policy(workflow).jobs.deploy.steps;
  const r=runNetworkStep(t,steps[5],{lookup:true});assert.equal(r.result.status,0,r.result.stderr);
  assert.equal(r.output,'origin=https://yggmetro-web.fixture.workers.dev\n');
  const smoke=runNetworkStep(t,steps[6],{});assert.equal(smoke.result.status,0,smoke.result.stderr);assert.equal(smoke.output,'');
});
for(const scenario of [{http:false},{success:false},{subdomain:''},{subdomain:'fixture\nleaked=value'},{subdomain:'evil.example/path'}]) test(`lookup rejects ${JSON.stringify(scenario)}`,t=>{
  const r=runNetworkStep(t,policy(workflow).jobs.deploy.steps[5],{lookup:true,...scenario});assert.notEqual(r.result.status,0);assert.equal(r.output,'');
});
for(const scenario of [{healthHttp:false},{health:{ok:false}},{health:{service:'other'}},{health:{spectrumSaleConfigured:false}},{clientHttp:false},{client:{provider:'fallback'}},{client:{intent:null}}]) test(`smoke rejects ${JSON.stringify(scenario)}`,t=>{
  assert.notEqual(runNetworkStep(t,policy(workflow).jobs.deploy.steps[6],scenario).result.status,0);
});
