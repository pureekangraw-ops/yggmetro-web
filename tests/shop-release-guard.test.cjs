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
  const changedId=active();changedId.result.deployments.unshift({id:'direct-api-new',versions:lock.expectedVersions});
  const changedVersion=active();changedVersion.result.deployments[0].versions=[{version_id:'new',percentage:100}];
  const split=active();split.result.deployments[0].versions=[{...lock.expectedVersions[0],percentage:50},{version_id:'new',percentage:50}];
  for(const payload of [null,{}, {success:false}, {success:true,result:{deployments:[]}},changedId,changedVersion,split]) {
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
