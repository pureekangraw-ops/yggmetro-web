import fs from 'node:fs';

const files=['src/office-index.js','src/office-shell.mjs','office-public/go-hub-office-surface.js','office-public/go-hub-office-login.js','office-public/office-payment-monitor.mjs'];
const sources=files.map(file=>[file,fs.readFileSync(file,'utf8')]);
const worker=sources.find(([file])=>file==='src/office-index.js')[1];

if(!worker.includes("authorityOwner:'go-hub'"))throw new Error('GO Hub authority declaration missing');
if(!worker.includes('env.GO_HUB.fetch'))throw new Error('GO_HUB service boundary missing');

const forbidden=[
 [/\bcard(Number|Cvc|Cvv)\b/i,'card data field'],
 [/\b(secretKey|clientSecret)\b/i,'provider secret field'],
 [/\bsk-[A-Za-z0-9_-]{12,}\b/,'secret-like literal'],
 [/\b(setPaymentStatus|confirmPaymentLocally)\b/,'local payment authority'],
];
for(const [file,source] of sources){
 for(const [pattern,label] of forbidden)if(pattern.test(source))throw new Error(`${label} detected in ${file}`);
}
console.log('Office authority boundary checks passed.');
