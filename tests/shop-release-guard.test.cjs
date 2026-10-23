const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const lock = JSON.parse(fs.readFileSync('releases/shop-production-lock.json'));
const active = () => ({success:true,result:{deployments:[{id:lock.expectedDeploymentId,versions:lock.expectedVersions}]}});

test('unreconciled source cannot release, even with status or environment overrides',async()=>{
  const {assertReleaseReady}=await import('../scripts/shop-release-guard.mjs');
  for(const state of ['blocked-source-unreconciled','reconciled','approved']) {
    assert.throws(()=>assertReleaseReady({...lock,state}),/blocked/);
  }
  for(const invalid of [null,{}, {...lock,schemaVersion:2},{...lock,worker:'other'}]) {
    assert.throws(()=>assertReleaseReady(invalid),/invalid/);
  }
  const r=spawnSync(process.execPath,['scripts/shop-release-guard.mjs','--force'],{
    encoding:'utf8',env:{...process.env,ALLOW_DEPLOY:'true',RECONCILED:'true'},
  });
  assert.equal(r.status,1);assert.match(r.stderr,/Production release blocked/);
});

test('active comparison accepts only the pinned current deployment and traffic split',async()=>{
  const {assertActiveDeployment}=await import('../scripts/shop-release-guard.mjs');
  assert.equal(assertActiveDeployment(lock,active()).id,lock.expectedDeploymentId);
  const otherId='05b18642-03c7-4ffe-86b2-080775ef0baa';
  const changedId=active();changedId.result.deployments.unshift({id:otherId,versions:lock.expectedVersions});
  const changedVersion=active();changedVersion.result.deployments[0].versions=[{version_id:otherId,percentage:100}];
  const split=active();split.result.deployments[0].versions=[{...lock.expectedVersions[0],percentage:50},{version_id:otherId,percentage:50}];
  for(const payload of [null,{}, {success:false}, {success:true,result:{deployments:[]}},changedId,changedVersion,split]) {
    assert.throws(()=>assertActiveDeployment(lock,payload));
  }
});

test('active comparison rejects malformed baseline and provider schemas',async()=>{
  const {assertActiveDeployment}=await import('../scripts/shop-release-guard.mjs');
  assert.throws(()=>assertActiveDeployment({}, {success:true,result:{deployments:[{}]}}));
  for(const invalid of [null,{},[],{...lock,schemaVersion:'1'},{...lock,schemaVersion:2},
    {...lock,worker:'other'},{...lock,expectedDeploymentId:undefined},
    {...lock,expectedDeploymentId:''},{...lock,expectedDeploymentId:'not-a-uuid'},
    {...lock,expectedVersions:undefined}]) assert.throws(()=>assertActiveDeployment(invalid,active()));
  for(const success of [undefined,null,false,1,'true',{},[]]) {
    assert.throws(()=>assertActiveDeployment(lock,{...active(),success}));
  }
  for(const result of [null,{},[],{deployments:null},{deployments:{}},{deployments:[{}]},
    {deployments:[{id:'invalid',versions:lock.expectedVersions}]}]) {
    assert.throws(()=>assertActiveDeployment(lock,{success:true,result}));
  }
});

test('traffic comparison ignores object key order and version ordering',async()=>{
  const {assertActiveDeployment}=await import('../scripts/shop-release-guard.mjs');
  const second='05b18642-03c7-4ffe-86b2-080775ef0baa';
  const baseline={...lock,expectedVersions:[{version_id:lock.expectedVersions[0].version_id,percentage:33.33},{version_id:second,percentage:66.67}]};
  const payload=active();
  payload.result.deployments[0].versions=[{percentage:66.67,version_id:second},{percentage:33.33,version_id:lock.expectedVersions[0].version_id}];
  assert.equal(assertActiveDeployment(baseline,payload),payload.result.deployments[0]);
  payload.result.deployments[0].versions[0].percentage=66.66;
  payload.result.deployments[0].versions[1].percentage=33.34;
  assert.throws(()=>assertActiveDeployment(baseline,payload),/Production changed/);
});

test('invalid traffic distributions fail on either side even when identical',async()=>{
  const {assertActiveDeployment}=await import('../scripts/shop-release-guard.mjs');
  const id=lock.expectedVersions[0].version_id;
  const invalid=[undefined,null,{},[],[null],[{}],
    [{percentage:100}],[{version_id:'invalid',percentage:100}],
    ...[undefined,null,'100',0,-1,100.01,NaN,Infinity].map(percentage=>[{version_id:id,percentage}]),
    [{version_id:id,percentage:99}],[{version_id:id,percentage:50},{version_id:id,percentage:50}]];
  for(const versions of invalid) {
    const baseline={...lock,expectedVersions:versions};
    const payload=active();payload.result.deployments[0].versions=versions;
    assert.throws(()=>assertActiveDeployment(baseline,payload));
    assert.throws(()=>assertActiveDeployment(baseline,active()));
    assert.throws(()=>assertActiveDeployment(lock,payload));
  }
});

test('local deploy aborts before spawning Wrangler',()=>{
  const r=spawnSync('npm',['run','deploy','--','--dry-run'],{encoding:'utf8'});
  assert.equal(r.status,1);assert.match(r.stderr,/Production release blocked/);
  assert.doesNotMatch(r.stdout,/wrangler \d|Total Upload|Uploaded yggmetro/);
});

test('workflow dependency blocks both main push and dispatch before credential job',()=>{
  const w=fs.readFileSync('.github/workflows/deploy.yml','utf8');
  assert.match(w,/workflow_dispatch:/);assert.match(w,/branches: \[main\]/);
  assert.match(w,/  deploy:\n    needs: release-integrity\n/);
  const gate=w.split('  release-integrity:\n')[1].split('\n  deploy:')[0];
  assert.match(gate,/run: node scripts\/shop-release-guard.mjs/);
  assert.doesNotMatch(gate,/secrets\.|CLOUDFLARE|continue-on-error|if:|npm ci/);
  assert.match(w,/node scripts\/shop-release-guard.mjs\n          npx wrangler deploy/);
  assert.doesNotMatch(w,/continue-on-error|if: always/);
});
