"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("METRO Android is a separate Capacitor app and does not replace Vault",()=>{
  const cfg=JSON.parse(read("metro-android/capacitor.config.json"));
  assert.equal(cfg.appId,"com.yggmetro.metro");
  assert.equal(cfg.appName,"METRO");
  assert.ok(fs.existsSync(path.join(root,"ygg-vault-android/capacitor.config.json")));
});
test("METRO mobile exposes SHOP OFFICE PRISM and contextual SPECTRUM",()=>{
  const html=read("metro-android/www/index.html"),js=read("metro-android/www/app.js");
  for(const token of ["SHOP","OFFICE","PRISM","SPECTRUM"])assert.match(html,new RegExp(token));
  assert.match(js,/METRO → SPECTRUM → GO HUB/);
});
test("METRO mobile stores only route URLs and no provider secret fields",()=>{
  const html=read("metro-android/www/index.html"),js=read("metro-android/www/app.js");
  assert.doesNotMatch(html,/<input[^>]+(?:id|name)=["'][^"']*(?:key|password|secret|token)[^"']*["']/i);
  assert.doesNotMatch(js,/OPENAI_API_KEY|GOHUB_MASTER_KEY|GOHUB_OWNER_PASSCODE|GOHUB_OFFICE_SESSION_KEY/i);
});

test("METRO Android installs an owner-enabled floating overlay bubble contract",()=>{
  const patch=read("metro-android/scripts/install-bubble.mjs");
  const html=read("metro-android/www/index.html");
  const js=read("metro-android/www/app.js");
  const workflow=read(".github/workflows/metro-android-build.yml");
  assert.match(patch,/SYSTEM_ALERT_WINDOW/);
  assert.match(patch,/TYPE_APPLICATION_OVERLAY/);
  assert.match(patch,/startForeground/);
  assert.match(patch,/registerPlugin\(MetroBubblePlugin\.class\)/);
  assert.match(html,/id="bubbleToggle"/);
  assert.match(js,/MetroBubble/);
  assert.match(workflow,/Patch native floating bubble/);
});

test("PRISM stays inside METRO and never becomes the connection gateway",()=>{
  const html=read("metro-android/www/index.html");
  const js=read("metro-android/www/app.js");
  const patch=read("metro-android/scripts/install-bubble.mjs");
  assert.match(html,/INSIDE METRO/);
  assert.match(html,/ไม่รับ connection โดยตรง/);
  assert.match(js,/api\.openPrism\(\{url\}\)/);
  assert.doesNotMatch(js,/kind==="prism"[\s\S]{0,400}location\.href=url/);
  assert.match(patch,/class PrismActivity/);
  assert.match(patch,/android:name="\.PrismActivity"/);
  assert.match(patch,/PRISM · inside METRO/);
});
