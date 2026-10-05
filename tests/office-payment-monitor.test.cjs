const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path'),fs=require('node:fs');

const load=()=>import(pathToFileURL(path.resolve(__dirname,'../office-public/office-payment-monitor.mjs')).href+'?t='+Date.now());

test('payment monitor projects the complete safe lifecycle without sensitive fields',async()=>{
 const {paymentMonitorLines}=await load();
 const payment={
  paymentId:'PAY-1',quoteId:'QUOTE-1',customerId:'CUSTOMER-1',workId:'WORK-1',
  amount:12500,currency:'THB',status:'REFUNDED',providerReference:'PROVIDER-REF-1',
  providerEventId:'EVENT-1',ownerSource:'PAYMENT_PROVIDER',providerObservedAt:'2026-10-05T10:00:00.000Z',
  paidAt:'2026-10-05T09:00:00.000Z',failedAt:null,refundPendingAt:'2026-10-05T09:30:00.000Z',
  refundedAt:'2026-10-05T09:45:00.000Z',disputedAt:null,fulfillmentReadiness:'BLOCKED',
  evidenceFreshness:{state:'FRESH',ageSeconds:20},nextAction:'GO_REVIEW',
  cardNumber:'4111111111111111',clientSecret:'must-not-render'
 };
 const text=paymentMonitorLines(payment,value=>value||'—').join('\n');
 for(const expected of ['PAY-1','QUOTE-1','CUSTOMER-1','WORK-1','12500 THB','PROVIDER-REF-1','EVENT-1','PAYMENT_PROVIDER','2026-10-05T10:00:00.000Z','2026-10-05T09:00:00.000Z','2026-10-05T09:30:00.000Z','2026-10-05T09:45:00.000Z','BLOCKED','FRESH','GO_REVIEW'])assert.match(text,new RegExp(expected));
 assert.match(text,/Failed —/);
 assert.match(text,/Disputed —/);
 assert.doesNotMatch(text,/4111111111111111|must-not-render/);
});

test('GO review gate covers material money states and stale evidence',async()=>{
 const {paymentNeedsGoReview}=await load();
 const fresh={evidenceFreshness:{state:'FRESH'}};
 for(const status of ['QUOTE_DRAFT','QUOTE_SENT','PAYMENT_PENDING'])assert.equal(paymentNeedsGoReview({...fresh,status}),false,status);
 for(const status of ['PAYMENT_CONFIRMED','PAYMENT_FAILED','REFUND_PENDING','REFUNDED','DISPUTED','UNKNOWN'])assert.equal(paymentNeedsGoReview({...fresh,status}),true,status);
 for(const status of [undefined,'','PAYMENT_CONFIRME','PAID','CAPTURED'])assert.equal(paymentNeedsGoReview({...fresh,status}),true,String(status));
 assert.equal(paymentNeedsGoReview({status:'PAYMENT_PENDING',evidenceFreshness:{state:'STALE'}}),true);
 assert.equal(paymentNeedsGoReview({status:'PAYMENT_PENDING'}),true);
});

test('Office sales surface uses the safe payment monitor projection',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../office-public/go-hub-office-surface.js'),'utf8');
 assert.match(source,/from ["']\/office-payment-monitor\.mjs["']/);
 assert.match(source,/paymentMonitorLines\(p,displayTime\)/);
 assert.match(source,/paymentNeedsGoReview\(p\)/);
});
