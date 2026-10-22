// Offline preparation only: never deploys, migrates, or reads remote settings/secrets.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),out=path.resolve(process.argv[2]||'test-results/sandbox-bundle');
await fs.mkdir(out,{recursive:true});
const config=JSON.parse(await fs.readFile('docs/stripe-provider-20261022/wrangler.sandbox.jsonc','utf8'));
if(config.name!=='yggmetro-shop-sandbox'||config.vars.SHOP_ENVIRONMENT!=='sandbox'||config.vars.STRIPE_CHECKOUT_MODE!=='test'||config.d1_databases.some(x=>x.binding!=='SHOP_ORDERS')||config.r2_buckets.some(x=>x.bucket_name!=='yggmetro-shop-sandbox-downloads'))throw Error('Unexpected sandbox scope');
execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','docs/stripe-provider-20261022/wrangler.sandbox.jsonc','--outdir',path.join(out,'worker')],{stdio:'inherit',env:{...process.env,XDG_CONFIG_HOME:path.join(out,'.config'),WRANGLER_SEND_METRICS:'false'}});
await fs.cp('public',path.join(out,'public'),{recursive:true});
config.main='./worker/index.js';config.assets.directory='./public';
// No migration command is included. Apply no migrations to the existing acceptance database.
for(const db of config.d1_databases)delete db.migrations_dir;
await fs.writeFile(path.join(out,'wrangler.sandbox.json'),JSON.stringify(config,null,2)+'\n');
const files=[];
async function walk(dir){for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(entry.name==='.config'||entry.name==='manifest.json')continue;const name=path.join(dir,entry.name);if(entry.isDirectory())await walk(name);else{const data=await fs.readFile(name);files.push({path:path.relative(out,name),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')})}}}
await walk(out);
const manifest={source_commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),working_tree_diff_sha256:createHash('sha256').update(execFileSync('git',['diff','HEAD'])).digest('hex'),scope:'PREPARED ONLY; deployment held; no secrets included',files};
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${files.length} files at ${out}; no deployment performed.`);
