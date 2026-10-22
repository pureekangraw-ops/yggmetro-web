# Request recovery and marketplace readiness — 2026-10-21

## Result

Four request-UI regressions reproduced before the fix, then passed:

1. Starting a new request silently discarded an unsaved brief.
2. Importing a legacy draft silently discarded the current unsaved brief.
3. Failed request creation changed the internal selected ID; a later save created an unintended request.
4. Failed navigation to another request changed the selected ID while showing the old brief; a later save could overwrite the other owned request.

The fix asks before discarding a dirty draft and changes the selected ID only after the server returns the requested record. Failed selection restores the picker and preserves current edits. Confirmed new/import success paths are also covered. No request ownership, authentication, backend, payment or price logic changes.

## Reproduce

```sh
npm ci --no-audit --no-fund
npm test
node --check src/request-pages.js
git diff --check
npx wrangler deploy --dry-run --outdir .wrangler/atlas-readiness-bundle
# On a host with supported local browser/network access:
CHROMIUM_PATH=/usr/bin/chromium npm run test:request-recovery
# Existing storefront checks followed by recovery browser checks:
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

`npm test`: **68/68 passed** (59 baseline + six recovery cases + three marketplace cases). Recovery tests execute the actual rendered inline UI script against a minimal DOM fixture and the real request workflow backed by in-memory SQLite. They verify state, record identity and persisted contents; **they do not establish layout/browser rendering**. Marketplace tests verify the existing four external CTAs on catalog/detail pages, safe new-tab attributes, exclusion from the rendered native-cart catalog even with synthetic mappings, and fail-closed unconfigured checkout. They do not visit marketplace pages or verify purchases/delivery.

Syntax, whitespace and Wrangler dry-run passed. Dry-run had existing proxy-environment warnings; no deployment occurred. Independent focused review found no Critical/Important regression; its fresh 66/66 run preceded the two added success-path tests. Final full suite is 68/68.

Evidence: `recovery-red.log`, `selection-red.log`, `unit-tests.log`, `wrangler-dry-run.log`. All records and credentials used in tests are synthetic. No real customer data or secret values were read.

## Browser verification limit

The four-case Playwright suite and isolated Node/SQLite preview are included. Local browser launch was blocked before tests by Chromium socket permissions. One supported escalation retry failed in the sandbox runner; no security settings were changed. Separate existing-browser inspection could not reach workspace-local staging. No rendered UI pass or screenshots are claimed here.

The existing `test:e2e` command now also runs recovery checks, so the existing PR browser workflow can verify them without workflow changes. Screenshot paths, when a browser run passes: `test-results/request-recovery/unsaved-brief-mobile.png` and `test-results/request-recovery/recovered-selection-desktop.png`. The browser harness blocks all non-local requests and uses no production configuration, model inference or payment calls.

## Source, publication boundary and owner handoff

- Based on current `main` **2ca6f7df7f31257ebc113eccf932aa41ea6f6708**, after PR #60. Existing open PRs were inspected; none addresses these request-recovery bugs. Older storefront/bridge PRs were not merged or duplicated.
- Branch: `atlas/shop-request-readiness-20261021` in `pureekangraw-ops/yggmetro-web`.
- GitHub deployment workflow runs only on `main` or manual dispatch. Read-only Cloudflare Builds inspection confirmed the connected `yggmetro-web` trigger includes only `main`. PR workflows run tests, not deployment. No workflow/binding/credential changes, merge, deploy, payment activation or real transaction is part of this patch.
- WEB owns acceptance and any release decision. Keep the PR draft until its browser checks and normal owner review are accepted. This handoff is not a duplicate source of truth or a change to another team's work status.
- Native checkout remains intentionally gated. External marketplace destination availability, customer duplicate/delivery versions, staffing/response expectations, expired-cookie and cross-device recovery remain separate verification/owner-policy gates. This patch does **not** add account recovery or claim the whole storefront production-ready.
