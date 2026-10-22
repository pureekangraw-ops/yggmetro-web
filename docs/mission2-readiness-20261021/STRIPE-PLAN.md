# Mission 2 — Stripe sandbox integration plan (read-only)

**Verified:** 2026-10-21, 14:00–14:02 UTC; authority wording clarified at 14:13 UTC
**Decision:** Keep production native checkout unactivated. The connected Stripe session currently exposes **Yggmetro, `livemode=true`, only**. No test-mode/sandbox context is available through this connector. Do not substitute live access for sandbox access.

**Existing authority:** Mission 2 already permits isolated branch/staging work and synthetic Stripe sandbox testing without real transactions or real customer data. These actions do not require another approval merely because they involve nonproduction code or a simulated payment. Action-time approval remains necessary for creating/configuring credentials, OAuth or persistent permissions, secrets, and the user-reserved actions: price changes (including a new fixture price), merge, production deployment, DNS and live activation. This plan neither expands nor narrows that authority.

## 1. Result and authority boundary

| Status | Finding |
|---|---|
| **Done** | Fresh `stripe_list_available_accounts_or_orgs({})` returned one live Yggmetro context and zero `livemode=false` contexts. Only account-selection metadata was read. |
| **Done** | Read the existing native checkout implementation, schema, routing and tests; ran its 13 local fixture tests successfully. No Stripe API requests occur in these tests. |
| **Done** | Prepared this integration contract and execution/test plan with the existing authority and reserved-action boundaries using current official Stripe documentation. |
| **Blocked — access absent, not an API denial** | Account-specific sandbox reads and the account-bound Stripe implementation planner require an explicitly available `livemode=false` context. No such context was returned. Neither was called using live credentials. |
| **Unknown** | Whether a sandbox exists outside this session; current sandbox price/product IDs, webhook configuration, permissions, API version and account settings. |
| **Unknown / not revalidated** | Earlier live charges/payouts-ready and zero-webhook observations. Current live account objects were not read because this task authorizes test-mode/sandbox inspection only. |
| **Unknown / not revalidated** | Current deployed Worker secret/binding configuration. Repository configuration is not proof of deployed configuration. |

**Actions not performed:** no account authorization/permission change, OAuth, keys or secret-value retrieval, customer listing, new customer data, transaction/session/payment creation, event triggering, webhook registration, database/storage provisioning, configuration/code modification, merge, deploy, DNS or price change. GO Brain was not used.

The older `docs/storefront-launch.md` statement that the connection exposes test mode and an existing $9 SHOP HOME test price is historical, **not current evidence**. It must not authorize an activation or supply an assumed sandbox price.

### Exact access unblock for BIG (not executed)

1. Identify **a specifically named Yggmetro sandbox** and make that context available. If connecting it requires new OAuth, credentials or persistent permissions, obtain action-time approval for those exact changes; request only the access needed for the next operation. Sandbox inspection itself is already within Mission 2 scope.
2. If a new authorization flow is necessary, BIG/owner completes it after approving the required access change. Do not share secret keys in chat or documents. Refresh the available-account list and select the verified intended `livemode=false` context.
3. For the initial read-only check, read minimal sandbox account/price/webhook metadata, not customer lists, payment records, emails, webhook payloads or secrets. Report the exact target, operation and permission error if any read is denied. Later in-scope synthetic tests may inspect their own synthetic results, never unrelated or real customer data.
4. Re-run the account-bound integration planner with the confirmed context and the already-known requirement: one-time digital product, existing Cloudflare Worker storefront, Stripe-hosted Checkout, private download after verified payment. Do not change integration type or create Stripe objects merely because a planner recommends them.

This is **blocked by unavailable sandbox context**, not evidence of account failure and not a lack of user authority for sandbox testing. This subtask performed read-only inspection and planning only. Once the intended sandbox context and existing isolated configuration are verified, in-scope synthetic sandbox testing may proceed under Mission 2 without reapproval solely for a test transaction. Any needed credential, persistent-access, secret or reserved change still requires its own action-time approval. This document creates no additional authority.

## 2. Source baseline and existing flow

Read-only code baseline: `pureekangraw-ops/yggmetro-web` commit `f659186f1d5b2d1e2340f515c560126c297d09b2` (PR #61 baseline, also used by Mission 2's stacked branch). No files in the web agent's workspace were changed.

| Source / existing behavior | Sandbox contract |
|---|---|
| [`src/commerce-pages.js`](https://github.com/pureekangraw-ops/yggmetro-web/blob/f659186f1d5b2d1e2340f515c560126c297d09b2/src/commerce-pages.js): excludes external HTTPS products from native cart; one item per checkout | Preserve external PromptBase/Notion purchase/access routes. Sandbox testing should use a native synthetic fixture with a verified existing sandbox price; do not repurpose an externally sold product or create/change a price without BIG approval. |
| [`src/index.js` lines 419–427](https://github.com/pureekangraw-ops/yggmetro-web/blob/f659186f1d5b2d1e2340f515c560126c297d09b2/src/index.js#L419-L427): shop-host checkout/webhook/order routes | `/api/v1/shop/checkout`, `/api/v1/stripe/webhook`, `/api/v1/shop/order`, `/api/v1/shop/order/download`, `/order`. Current host gate is `shop.yggmetro.com`. |
| [`src/stripe-checkout.js` lines 12–27](https://github.com/pureekangraw-ops/yggmetro-web/blob/f659186f1d5b2d1e2340f515c560126c297d09b2/src/stripe-checkout.js#L12-L27): test configuration unless mode is exactly `live`; requires enable flag, matching key prefix, catalog, webhook secret, D1 and private storage methods | Fail closed until all **isolated sandbox-only** components are validated. Prefix checks distinguish test/live, not one sandbox from another. |
| Checkout handler lines 37–58: POST, exact same-origin, JSON only; accepts `slug`, 64-hex `requestId`, optional validated `email`; no browser amount/file input | Preserve server-owned one-time price, quantity 1, integer minor-unit amount/currency and delivery mapping. Retain origin, size and rate-limit safeguards. |
| Checkout verifies private object presence and retrieves Stripe Price before Session creation | Verify `livemode=false`, active, `one_time`, exact approved amount/currency; never invent a price ID or amount. A fixture ID in a unit test is not a real Stripe ID. |
| Hosted Session uses payment mode, slug reference, `yggmetro-test-store` metadata and owner-cookie order record | Browser receives only provider checkout URL or owner-bound order URL, never a key, private storage key or unrestricted entitlement. Successful creation alone remains `pending`. |
| [`migrations/0001_shop_orders.sql`](https://github.com/pureekangraw-ops/yggmetro-web/blob/f659186f1d5b2d1e2340f515c560126c297d09b2/migrations/0001_shop_orders.sql): session PK, unique request ID, `pending`/`paid`, token hash | Dedicated sandbox D1 is mandatory with the current schema: rows have no explicit account/sandbox field. Do not share the live D1. |
| [`wrangler.jsonc`](https://github.com/pureekangraw-ops/yggmetro-web/blob/f659186f1d5b2d1e2340f515c560126c297d09b2/wrangler.jsonc): no `SHOP_ORDERS` or `SHOP_DOWNLOADS` declaration | This is source evidence only, not a fresh deployed-bindings inspection. Native payment readiness cannot be inferred from the presence of payment code. |

## 3. Isolation and runtime contract (proposal only)

Stripe recommends isolated general sandboxes for new development; do not assume that access to live means access to a sandbox. [Stripe test environments](https://docs.stripe.com/testing/overview).

Use an isolated nonproduction Worker and host, dedicated sandbox D1, dedicated private sandbox R2, and a sandbox-specific event destination within Mission 2 scope. Creating/configuring credentials, signing secrets or persistent webhook access still requires action-time approval. Keep production bindings and secrets untouched. Use synthetic ZIP bytes and fabricated non-customer metadata; no real customer records, card details, paid deliverables or outbound customer emails.

The existing configuration names are `STRIPE_TEST_CHECKOUT_ENABLED`, `STRIPE_TEST_KEY`, `STRIPE_TEST_WEBHOOK_SECRET`, `STRIPE_TEST_CATALOG`, `SHOP_ORDERS`, `SHOP_DOWNLOADS`. They are **names only**, not instructions to set values now. Keep test checkout disabled until the isolated setup and sandbox identity are validated; existing valid sandbox configuration does not itself require reapproval. Live enablement must remain disabled; do not toggle `STRIPE_CHECKOUT_MODE` to `live`.

**Implementation prerequisite:** `src/stripe-checkout.js` hard-codes the production origin/redirect URL, while `src/index.js` hard-codes the shop host. A separate deployed sandbox host will not work by switching test keys alone. An isolated branch/staging change can introduce a strict nonproduction origin/host contract with tests under Mission 2 authority; this does not authorize credential changes or production rollout. Do not work around this using production DNS, a shared live Worker or relaxed origin checks.

Do not reuse sandbox credentials, secrets, catalogs, D1/R2 objects or browser sessions between independent sandboxes. The current schema, cookie name and browser `test` key do not distinguish multiple sandboxes, so dedicated hosts and stores are required. Confirm the selected account identity and returned objects' `livemode=false`; key prefixes alone are not sufficient identity verification.

## 4. Event, entitlement and download contract

1. Verify the raw bounded request body with the official Stripe SDK, `Stripe-Signature`, the **same destination's** signing secret, and timestamp tolerance before accessing order state. Current code uses `constructEventAsync`, a 300-second tolerance and a 256 KiB body cap. Dashboard and CLI signing secrets are different; never interchange or reveal them. [Signature troubleshooting](https://docs.stripe.com/events/manage-webhook-endpoints#signature-errors).
2. Require the correct event mode and session mode prefix. Existing entitlement events are `checkout.session.completed` and `checkout.session.async_payment_succeeded`; completion alone is insufficient when `payment_status` is not `paid`. The return URL and query string confer no payment authority. [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment?payment-ui=checkout-form).
3. Match existing order, payment mode, amount, currency, slug, metadata surface, and exactly one retrieved line item with matching price and quantity 1. Proposed refinement: retrieve canonical Session/payment state through the matching sandbox client before fulfillment, following Stripe's fulfillment guidance; test API failures and outdated event snapshots explicitly.
4. Current durable entitlement is a conditional D1 update `pending → paid`. Repeated events, including different event IDs for the same Session, must never issue another entitlement. Future notifications or side effects need a transactional outbox/unique ledger rather than relying only on this status update. Stripe may send duplicates, and event arrival order must not be assumed. [Webhook duplicate handling](https://docs.stripe.com/webhooks).
5. Return success only after the durable decision, or after an intentionally ignored verified event. Current missing-order race and transient store/provider failures return 503 to request retry. Mismatch/signature failures never grant access. Record only redacted technical outcomes and internal IDs needed for diagnosis, not customer details or raw payloads.
6. Download requires a same-browser `__Host-ygg-order` HttpOnly/Secure/SameSite=Lax cookie, its SHA-256 hash matching the order, a same-mode Session ID, `status=paid`, and the private R2 object. Session ID or email alone is not authorization. Pending orders return 409; wrong/missing ownership returns 404; missing delivery returns 503. Keep `no-store`; never expose a public storage URL.
7. **Explicit gap:** schema and UI only model `pending`/`paid`. Async failure, expiration, refunds/disputes and entitlement revocation have no complete lifecycle here. Define and test these states in isolation under Mission 2; any resulting production payment policy remains part of BIG's live-activation decision. A failure must not accidentally override a later valid payment. Recovery after cookie loss is currently seller-assisted; email-based recovery is not implemented.

## 5. Idempotency and failure/recovery contract

Existing Session creation uses `yggmetro-shop-<requestId>`; local D1 enforces unique request IDs. A retry of an existing order requires its owner cookie; a mismatched owner or mode returns 409. The Session status determines reuse, completed-order redirect, or expiration conflict. Keep identical provider parameters for an unresolved creation retry.

Stripe retains v1 idempotency keys for at least 24 hours, after which the same key may create a new operation. A lost response must therefore be reconciled before creating again; do not blindly retry old unknown operations with either an old or new key. [Stripe advanced error handling](https://docs.stripe.com/error-low-level).

**Gaps to prove/fix in the authorized isolated branch/staging scope; production rollout remains reserved:**

- No persistent pre-provider attempt record/age currently exists. Test concurrent double-clicks, restart, provider success plus D1 failure, and an unresolved retry beyond 24 hours; establish one recoverable owner-bound Session, not a second purchase.
- Owner cookie is returned only after insert succeeds. Response loss after persistence can leave a browser unable to recover the old order. Preserve authorization while designing recovery; never grant access merely for knowing a request ID.
- Generic checkout errors currently do not prove whether the provider accepted an earlier call. The browser message must avoid claiming a definitive charge outcome when the state is unknown. Separate safe retry, reconciliation-needed, and owner-contact states.
- Validate actual Session-creation parameters/API version against the confirmed sandbox before execution; mocked SDK success is not provider acceptance.
- Decide a documented policy for tax/discount/currency changes. Current fulfillment demands `amount_total` exactly equal the approved catalog amount; enabling additional price-affecting features without redesign would produce a mismatch.

These are design/readiness findings, not claims that a live failure or charge occurred.

## 6. Verification stages and stopping gates

### Completed now — no network payment writes

Ran `node --test tests/stripe-checkout.test.cjs` in `/workspace/shared/atlas-shop-readiness`, which was at the same baseline commit. **13 passed, 0 failed.** SDK payment methods and D1/R2 are synthetic local fixtures; one signature test uses the real SDK locally. Log: `/workspace/shared/atlas-mission2-stripe-fixture-tests.log`.

Coverage includes fail-closed config/origin/client price rejection, pending order/cookie, delivery/price mismatch, paid signed webhook and duplicate handling, unpaid/wrong-mode/mismatched payment rejection, async success and missing-order retry, signed-payload tampering, stable retry parameters, explicit live gate, email validation, test/live isolation, delayed success after 24 hours and cross-mode stale requests. This does **not** establish hosted Checkout, a deployed webhook, sandbox access or production readiness.

### Next stages — proceed within Mission 2; obtain approval only for reserved changes

| Stage | Existing authority / required evidence or approval | Stop if |
|---|---|---|
| A: read-only sandbox access | Already authorized. Confirm named sandbox identity and `livemode=false`; new credentials/OAuth/persistent permissions require action-time approval | Missing/ambiguous context, denied permission, live context, or unexpected real customer data |
| B: isolated implementation | Branch/staging code and offline fixture tests are within Mission 2. Keep production and credential configuration unchanged | Safety/ownership test failure, production target, or a reserved change is needed |
| C: sandbox readiness | Verify existing isolated resources and existing price mapping. Obtain action-time approval before creating/configuring credentials, secrets, persistent permissions/webhook access, or creating/changing prices | Missing approval for one of those reserved actions; unexpected shared/live resource |
| D: synthetic sandbox tests | Already authorized within Mission 2 once verified context and isolated configuration exist. Use fabricated identity/test data only; no real transactions/customer data or customer emails | Unexpected live flag, account mismatch, real data, uncertain prior outcome, or a new reserved configuration action is required |
| E: production | BIG approval remains required for merge, production deployment, secrets, DNS, prices and live activation; none follows automatically from sandbox success | Any required approval/readiness item missing |

For Stage D, in-scope sandbox acceptance evidence must show: immediate success, decline, delayed success/failure, cancellation/expiration, duplicate and out-of-order events, bad signature, wrong mode/account/price, retry after transient API/D1 failure, simultaneous creation, stolen/absent cookie, no entitlement before paid, one entitlement after paid, and missing-file recovery. Use local fixture replay where it answers the question; do not assume a Stripe CLI trigger is read-only. Record redacted synthetic event/session IDs, observed responses, D1 transitions and download checks; do not read unrelated customer data. A return-page screenshot alone does not prove fulfillment.

**Completion condition for this read-only subtask:** fresh access visibility check, source-grounded contract, offline fixture proof, exact blocker and authority handoff. Met. **Not complete:** sandbox integration verification (blocked by missing context) or production payment activation (reserved for BIG). Mission 2 may continue authorized isolated work without inventing another sandbox-test approval requirement.

## Evidence links

- [Baseline native checkout code](https://github.com/pureekangraw-ops/yggmetro-web/blob/f659186f1d5b2d1e2340f515c560126c297d09b2/src/stripe-checkout.js)
- [Baseline fixture tests](https://github.com/pureekangraw-ops/yggmetro-web/blob/f659186f1d5b2d1e2340f515c560126c297d09b2/tests/stripe-checkout.test.cjs)
- [Historical launch notes — not current account access proof](https://github.com/pureekangraw-ops/yggmetro-web/blob/f659186f1d5b2d1e2340f515c560126c297d09b2/docs/storefront-launch.md)
- [Stripe sandbox/testing documentation](https://docs.stripe.com/testing/overview)
- [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment?payment-ui=checkout-form), [webhooks](https://docs.stripe.com/webhooks), [signature troubleshooting](https://docs.stripe.com/events/manage-webhook-endpoints#signature-errors), [idempotency and errors](https://docs.stripe.com/error-low-level)

Account visibility is a time-stamped connector observation in this task, not a public document or proof of all account resources. No public evidence URL is invented for that observation.
