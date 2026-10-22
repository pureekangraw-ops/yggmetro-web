# Stripe testmode acceptance — 22 October 2026 (Asia/Bangkok)

## Result
**Real provider decline and successful THB 40 payment passed. The deployed application's checkout → webhook → D1 → owned download acceptance remains BLOCKED.**

This probe created its Checkout Session through the Stripe MCP API, not the web application's checkout handler. It deliberately has no app owner cookie or D1 order. Do not treat the successful Stripe payment as storefront fulfillment acceptance.

## Correlated evidence
- Source: PR64 commit `5c13ae3148505255a818d75cb1774466f72a9f4c`; tracked application code unchanged.
- Account: `acct_1UPfntLUh1BviBSH`, named Sandbox connection, `livemode=false`.
- Product `prod_yggmetro_checkout_test_40thb`; Price `price_1UTAV6LUh1BviBSHAwjISA4N`: active, one-time, 4000 satang / THB.
- Session `cs_test_a1cNwXwKa4uE6YKynEZjZ6zDgTvALtUrEHlxgnEbkk0IykOMopM0QPvrd0`: `complete / paid`, 4000 THB minor units.
- PaymentIntent `pi_3UTAgDLUh1BviBSH1KayFSPV`: `succeeded`, amount_received=4000, currency=thb.
- First submission used Stripe's documented generic-decline test card: `card_declined / generic_decline`; received=0; event `evt_3UTAgDLUh1BviBSH1os87fF9`.
- Second submission used Stripe's documented success test card in the **same Session/PaymentIntent**. Actual provider completion events: `evt_1UTAieLUh1BviBSHvdUgVMVE` (checkout.session.completed); `evt_3UTAgDLUh1BviBSH1TOydw5l` (payment_intent.succeeded).
- Dummy customer data only; no live funds or real card data.
- Hosted Checkout initially offered USD via Adaptive Pricing; THB was explicitly selected before both submissions. Presentment conversion is observed behavior, not a demonstrated application defect. No currency logic was changed.
- See [sanitized readbacks](evidence.json) and [declined-card screenshot](stripe-declined.jpg).

## Isolated runtime prepared
- Worker: `yggmetro-shop-sandbox`; [sample product](https://yggmetro-shop-sandbox.pureekangraw.workers.dev/products/checkout-test) visibly renders THB40 in Cloud Browser.
- Deployment: `b8fbcf997b3b4763b60603734f178e04`; minified bundle SHA256 `68cd23492fd5687daa399f5f0d89859918e54d794a00aa4d9f25896667345f85`.
- D1: `yggmetro-shop-sandbox-orders` / `cb4c8a75-779e-44cb-a994-63153eed9b09`; migrations0001 and0003 applied, schema read back.
- Private R2: `yggmetro-shop-sandbox-downloads`; r2.dev disabled, no custom domains. Synthetic ZIP is188bytes; uploaded object ETag equals local MD5. No customer deliverables.
- No production REQUESTS_DB, secrets, routes or customer storage were bound.
- The current API-uploaded Worker has **no static asset bundle**. Sample/checkout/order HTML was observed; complete catalog visual acceptance and asset upload are pending. The provided Wrangler config includes assets for the eventual full sandbox build.
- CLI HTTP probes returned Cloudflare403/code1010; Cloud Browser rendered sample/checkout/order successfully. Do not report the CLI responses as application-handler results.
- After provider success, D1 readback still showed orders=0 and attempts=0. The return page said it could not locate the order and did not show a download link. This is expected for this provider-only probe, not E2E success.

## First blocked boundary and next steps
The Worker has neither `STRIPE_TEST_KEY` nor `STRIPE_TEST_WEBHOOK_SECRET` (fresh secret-list readback: empty).

A test webhook endpoint `we_1UTAbMLUh1BviBSH9AyP1Eea` was created for `https://yggmetro-shop-sandbox.pureekangraw.workers.dev/api/v1/stripe/webhook`, with `checkout.session.completed` and `checkout.session.async_payment_succeeded`. It is now **disabled** until runtime credentials are ready.

Automatic approval review rejected sending its signing secret from Stripe to Cloudflare, citing missing explicit approval for the credential transfer. The rejected call did not bind the secret; no alternate transfer route was attempted. The secret is not included in this repository or report.

1. Obtain BIG's explicit approval to store the Stripe test webhook signing secret in Cloudflare Worker `yggmetro-shop-sandbox` as `STRIPE_TEST_WEBHOOK_SECRET`.
2. Configure this account's test key directly through Cloudflare's Secret UI as `STRIPE_TEST_KEY`; never paste it in chat or source. The Dashboard browser was at sign-in and no key was accessed. A restricted key needs the application's price-read and checkout-session create/read capabilities.
3. Read back secret names, re-enable this test webhook and start a **new order from the web application** (do not promote this provider-only probe into D1).
4. Verify cookie bootstrap, stable request ID, provider checkout, correlated webhook delivery, D1 pending→paid, exact ZIP bytes and foreign-owner rejection. Then test retries/declines against the same deployed path.

Production merge/deploy is still pending acceptance. Existing CI107/107 + browser10/10 belongs to source commit5c13ae3 and fixture scope; these new provider observations are separate evidence.

Official test data: https://docs.stripe.com/testing

