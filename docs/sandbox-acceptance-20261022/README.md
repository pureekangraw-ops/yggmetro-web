# Sandbox acceptance follow-up — 2026-10-22

## Source and scope

Refreshed main `cf53e4166da2f192150192860ab50ff3ab8f44aa` and PR64 `105d6651a8f2c18ef1652e9005f6e6ad91a35f14`. Local merge `ff0cd70` preserves main's product story, GO mascot and owned-client handoff, and PR63/64 sandbox recovery. Conflicts resolved by retaining both imports, the product-story markup/styles, the sandbox product catalog and both browser suites. No AGENTS.md was present in the repository or workspace instructions directory.

No provider calls, purchases, customer-data reads, secret reads/changes, remote database writes, deployments, tracker mutations or external messages were performed. All new payment-shaped actions use synthetic local fixtures. Do not merge until parent reviews the exact final patch and the outstanding GO test requirement.

## Fresh local proof

Node 24.19.0, installed `/usr/bin/chromium`, real app handlers + SQLite + real Stripe SDK signature verification, mocked provider and synthetic ZIP.

- `npm test`: **108/108 pass** (`unit.log`). Existing tests cover ownership, concurrent duplicate checkout, duplicate signed webhooks, unpaid/live/amount/product rejection, wrong origin, timeout, D1 failure, expiry and reconciliation. These tests were retained rather than duplicated.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`: storefront **1440/708/390px**, recovery **4/4**, journey **9/9**, GO handoff **6/6**, checkout **11/11** pass (`browser.log`).
- Final expanded `npm run test:checkout`: **13/13 pass** (`checkout.log`). Adds desktop checkout, repeat signed fixture webhook (one order), and local resource/image/overflow checks on six sandbox routes at 390/1440. Resource checks block external requests and assert zero checkout calls/orders.
- Screenshots reviewed: checkout at 390/1440 and owned paid download at 390. Thai text and THB40 are readable; no horizontal overflow. **Visual limitation:** the existing floating GO mascot overlaps part of the sandbox notice at 390px. Preserve GO's owner changes; coordinate checkout-specific placement with GO before full mobile visual acceptance. Functional checkout/ownership tests pass; this is not blanket visual approval.
- `node scripts/build-sandbox-bundle.mjs /workspace/sandbox-acceptance-bundle`: Wrangler sandbox dry-run succeeds (`dry-run.log`). Initial run could not write the default home config directory; the preparation script uses an output-local XDG config path. No access denial bypass or escalation.
- `git diff --check` and source syntax checks pass.

## Prepared bundle, deployment held

The reproducible preparation script copies the entire public directory, emits the bundled Worker and a SHA256 manifest, and writes a sandbox-only config with existing dedicated SHOP_ORDERS/SHOP_DOWNLOADS/ASSETS bindings. It never invokes a real deploy or migration. There are no secret values in the package. `manifest.json` records source SHA and tracked working-tree diff checksum. Rebuild from the committed revision for immutable source evidence.

**Do not deploy this as an asset-only change.** It includes main's newer application code and the merged checkout code. Wrangler deployment also applies configuration; unchanged runtime settings and exclusive deployment ownership have not been established. The existing sandbox has enabled checkout and a paid receipt, which must remain untouched. Deployment is deliberately **held, not attempted or denied**. Parent/GO must compare deployed code/settings, confirm ownership and agree the exact asset upload/version operation before any remote mutation. Never use the production root wrangler config for sandbox.

## Runtime evidence reconciliation handoff (no tracker write)

The following is supplied by the parent audit at **06:05 UTC**, not independently re-read in this task:

- Worker `yggmetro-shop-sandbox`, version `477d4fa5-fae8-4031-9c20-241f8580702b`, deployed 03:06:40 UTC.
- Both required secret names already present; do not ask for/read values or modify credentials.
- Dedicated sandbox D1/R2, enabled test checkout and enabled webhook.
- Existing THB40 happy path: one paid order and one attempt verified against Stripe+D1. GO Brain WEB record `dc25ce51-1831-40da-b67d-b8acb85bab23` revision 9 / 03:12:40 checkpoint additionally reports owned ZIP checksum.
- Full deployed static asset bundle still absent. Do not repeat the successful purchase or alter its order/receipt.

PR64 body, `docs/checkout-40thb-20261022/README.md`, `docs/stripe-provider-20261022/README.md`, its historical `evidence.json`, and GO's top/body status fields contain older missing-secrets/disabled-webhook claims. GO should reconcile those current-status fields against the above checkpoint while retaining dated historical evidence. This follow-up does not rewrite historical evidence or mutate GO's tracker.

Remaining acceptance: deployed complete assets; deployed mobile visual review; GO's explicitly outstanding test requirement; real runtime negative/isolation/retry matrix (local proof is not hosted acceptance). No new transaction is needed for this handoff. Refund/dispute and lost-cookie recovery remain outside this task.
