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
