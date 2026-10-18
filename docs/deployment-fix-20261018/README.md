# Retired service deployment blocker — 2026-10-18

Status: deployment configuration fixed locally; registry migration BLOCKED. This is not a completed customer-brief migration and is not approved for production deployment.

Branch: fix/cloudflare-go-hub-binding-20261018. Inspected head b0d30de (includes failed ab95f3b and later chat-widget fix). Run 39112027015 / job 117630004033 failed at deployment; production smoke was skipped. No Actions rerun, merge or deployment performed.

The only production service binding referenced deleted `go-hub`, causing Cloudflare 10143. Remove that binding, rather than pointing its legacy HTTP calls at an incompatible Worker. Public routes and existing fail-closed behavior remain unchanged. No credential values read or modified. Storefront chat, Stripe checkout/webhook and security code are unchanged.

Read-only Cloudflare source/settings inspection of existing `phatheon-workhub` found OwnerBridge.ownerCall and LightBridge.lightCall, not a StorefrontBridge or the five legacy endpoints. See live-contract.json for extracted evidence. Default WorkHub task HTTP APIs require owner bearer authorization; named OwnerBridge.fetch returns 404. Giving public customer input OwnerBridge capabilities is not a safe compatibility adapter. Existing unmerged adapter branches/PRs are not proof of a deployed contract. This patch deliberately stops that integration change rather than guessing or changing another repository.

## Caller inventory and production impact

All runtime references are in src/index.js callBriefRegistry: GO_HUB.fetch POST to https://go-hub.internal plus one of:

| Legacy path | Public behavior with missing backend |
|---|---|
| /internal/brief/upsert | Brief save returns 503 BRIEF_BRIDGE_NOT_CONFIGURED |
| /internal/brief/confirm | Confirmation/handoff returns same 503; no work claimed created |
| /internal/spectrum/event | Observation returns same 503; not claimed saved |
| /internal/spectrum/go-budget | GO whisper/takeover remains unavailable; budget cannot be bypassed |
| /internal/payment/checkout | Legacy quoted-payment route returns same 503; never claims paid |

Payloads remain version 1 / SPECTRUMSALE: brief IDs + client/conversation + normalized fields; budget identity/request/kind; event ID/type/sanitized page/source; payment customer/quote/work/idempotency IDs (no client-supplied price/status/card authority). Existing successful transport fixtures remain regression-only, not live contract evidence.

Direct OpenAI interpretation/chat is independent. `/api/v1/shop/checkout` and `/api/v1/stripe/webhook` on shop.yggmetro.com are independent Stripe handlers; their environment bindings/secrets were not added or changed. Local smoke intentionally lacks Stripe configuration and verifies fail-closed responses, not successful paid checkout. Existing SQLite + injected Stripe SDK tests cover checkout/webhook security, delivery, duplicate events and mode boundaries; these are not production payment verification.

## Reproduce

Node v24.19.0; installed versions recorded in unchanged package-lock.json.

```sh
npm ci --no-audit --no-fund
npm test
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
npx wrangler deploy --dry-run --outdir .wrangler/deploy-fix
node scripts/deployment-local-smoke.mjs
```

Local results: 60/60 unit/regression tests; browser flows at 1440/708/390px; dry-run succeeded with only ASSETS binding; actual local workerd bundle smoke passed public pages/health plus six unavailable backend/config paths. Attached logs distinguish fixtures from runtime. Dry-run does not prove Cloudflare accepts a production upload or that every remote resource is available.

## Remaining blockers

A scoped customer-ingress contract must be implemented/deployed in PANTHEON under separate authorization, then tested with identity ownership, persistence, replay/idempotency, errors, budgets and expected receipt responses before storefront integration can be completed. Legacy quoted payments need a separately authorized compatible provider route; they cannot be translated to general owner tasks. Until those exist, this PR is a reviewable deployment-unblocking subset, not the full integration Definition of Done. Owner must assess existing 503 behavior before approving any production release.
