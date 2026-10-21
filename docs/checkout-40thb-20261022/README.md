# 40 THB sandbox storefront and recoverable checkout

BIG requested that the website pass testing and the product be priced at 40 baht. In the ongoing sandbox task, this is implemented as a distinct **sandbox-only sample**, not a repricing of the six existing products.

Base: PR #63 / Mission 4 starting commit `5a15b781bba384fc0f58d87e8b263ef62e59d63e`.

## Observable result

- `/products/checkout-test` appears only in a valid isolated sandbox. It shows **THB 40.00**; cart and checkout read the same server catalog amount, **4000 satang / `thb`**. Production does not expose this sample.
- The sample refuses any configured amount/currency other than 4000/THB. The actual Stripe Price must match those fields before a Session is created.
- First checkout establishes the HttpOnly/Secure owner cookie with HTTP 428 before any provider Session is created. The browser repeats the same request once to prove cookie retention.
- A durable attempt records owner hash, exact provider parameters and start time **before** Session creation. A retry cannot change email, price, delivery mapping, mode or origin.
- Concurrent retries converge on one order. Provider success followed by a D1 failure can be retried with the same parameters/key. An unresolved attempt aged 23 hours or more stops for reconciliation rather than risking a new purchase after provider key expiry.
- The page preserves request ID and contact through reload, retry and returning to the product. It no longer claims that an uncertain failure proves no charge. Conflict/expired/reconciliation outcomes lead to support, not a new request ID. Damaged or legacy pending browser records fail closed.

## Verification

- Six new regressions failed before the handler fix: `red.log` (16 passed / 6 failed, including the existing tests and new cases).
- Final unit regression: **107/107**. Checkout subset: **22/22**.
- Existing browser checks: storefront at 1440/708/390px; request recovery **4/4**; request journey **9/9**.
- New browser checkout acceptance: **10/10**, including 40 THB display, cookie bootstrap, pending-download denial, real-SDK signed fixture webhook, owner download bytes, foreign-browser denial, provider timeout, gateway loss of a success response, D1 insert failure, blocked retries and damaged recovery storage.
- Local execution: Node 24.19.0; Chromium 153.0.8010.0. Standard Playwright browser download was truncated in this host. A user-space Chromium package supplied the executable; Noto Sans Thai was installed locally for readable screenshots. Neither dependency is added to the project.
- Syntax, `git diff --check` and Wrangler **dry-run** pass. Dry-run did not deploy or apply any migration. CI evidence belongs to the eventual PR/run, separately from these local logs.
- `test-results/checkout-40thb-mobile.png` and `order-40thb-paid.png` were visually reviewed after installing the Thai font. GitHub's browser workflow retains test screenshots as artifacts.

The local browser uses the real app handlers, SQLite and Stripe SDK signature verification, with a **mocked provider and synthetic ZIP**. This is not hosted Stripe Sandbox payment acceptance.

## Runtime configuration still required

Use a dedicated nonproduction Worker/host, `SHOP_ORDERS` D1 and private `SHOP_DOWNLOADS` R2. Do not deploy the production `wrangler.jsonc` as a sandbox. It binds the production request database.

- `SHOP_ENVIRONMENT=sandbox`
- `SHOP_SANDBOX_ORIGIN=https://<verified-dedicated-worker>.workers.dev`
- `STRIPE_CHECKOUT_MODE=test`
- Configure the existing test key/webhook-secret names using the secret channel, never source files.
- Create or verify a test-only one-time Price with `currency=thb`, `unit_amount=4000` in the intended Sandbox. BIG's 40-baht instruction authorizes this test price; no real price ID has been created or guessed in this patch.
- Fill `config/shop-sandbox.catalog.example.json` with that verified test Price ID. Its placeholder is deliberately invalid and cannot enable checkout.
- Apply `0001_shop_orders.sql` and **`0003_shop_checkout_attempts.sql`** to the isolated orders database before enabling checkout. The existing `0002_request_workflow.sql` belongs to the separate request workflow.
- Put a synthetic ZIP at `private/checkout-test.zip`. Do not substitute a customer deliverable or shared live storage.

The Stripe connector in this executing room still returned Yggmetro / `livemode=true`; the other room's reported `false` remains a separate observation. No provider Price, Product, Session, payment, webhook registration, key, secret or runtime resource was created. No production merge/deploy occurred.

## Remaining limits

Provider sandbox HTTP/payment/webhook acceptance still needs the verified test context and isolated runtime. Existing unknown attempts from before this migration cannot have their age reconstructed; reconcile them explicitly. Automatic recovery after browser storage/cookie loss, intentional repurchase/reset, full cancellation/refund/dispute state handling, and production activation remain separate readiness items. The attempt stores contact parameters server-side for exact retries; normal data-retention review is required before live use.

Official references checked: [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) and [currency amounts](https://docs.stripe.com/currencies). The provider may prune v1 keys after at least 24 hours; the 23-hour retry guard deliberately stops earlier. THB uses satang, so 40 THB is 4000 API units.
