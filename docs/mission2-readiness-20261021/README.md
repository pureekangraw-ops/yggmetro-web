# ATLAS Mission 2 — customer journey and support readiness

## Source and ownership checkpoint

- Repository: `pureekangraw-ops/yggmetro-web`.
- Current main verified: `2ca6f7df7f31257ebc113eccf932aa41ea6f6708`.
- PR #61 is still Draft/unmerged at `f659186f1d5b2d1e2340f515c560126c297d09b2`.
- This branch `atlas/mission2-journey-readiness-20261021` is **stacked on PR #61's branch**, `atlas/shop-request-readiness-20261021`. Its patch is preserved as ancestry, not duplicated in the new PR diff. Do not merge either without BIG/WEB approval. No rebase or changes to other branches.
- Other open storefront/bridge PRs (including #53, #52, #51, #50, #48) were inspected, not merged or repurposed.

## Bounded fixes

The real rendered UI, real request workflow and isolated in-memory SQLite reproduce these failure groups before the fixes (`journey-red.log`):

1. Transport errors, invalid JSON and unknown server error codes exposed internal exception text. All failed UI operations now use an explicit allowlist or a safe generic Thai message.
2. Unsent chat text followed the selected request and could be sent to the wrong conversation. Chat drafts are now scoped to request IDs in page memory.
3. A committed message whose response was lost retried its old ID with edited text, causing conflict. An uncertain send now retries the **same immutable ID and text**, retaining newer composition for the next send.
4. Late replies could clear newly typed text. Responses only clear the exact sent composition and cannot change another request's composer.
5. Refresh chose the latest request instead of the explicitly selected older request. Same-tab selection (ID only) now survives reload and is reauthorized server-side, including foreign-ID rejection.
6. Refresh/back could silently discard unsaved state. A browser-controlled before-unload warning covers unsaved brief/chat/delivery/pending send; no contents or Admin credentials are written to browser storage.
7. Admin delivery text/link/status followed selection and could be applied to another customer's request. Drafts are now request-scoped; reauthentication/logout clears the privileged view, and session-generation guards suppress stale responses.

The actual visible Custom Order entry had a separate confirmed blocker: fresh browsers received `SESSION_REQUIRED`; bootstrapped browsers received `REQUEST_NOT_FOUND`, because it confirmed an unsaved ID. The adapter now bootstraps the owned session, reads/creates the same draft, then confirms. Lost save/confirmation responses retry the same immutable request; expired/foreign sessions cannot replace ownership. Newer form edits survive retry; an owned readback link opens the resulting request. A browser navigation warning covers pending/edited form state. Ten real-script regression tests cover entry, response loss, repeated send, expired session, navigation and refresh/revisit recovery, including edits after recovery, authoritative progressed-status copy and accurate dirty-state after disabled-control recovery. Red/green logs record each confirmed failure before its fix.

Additional hostile-model-output fixtures reproduced unverified payment/accepted/started/delivered claims on neutral customer input. A bounded deterministic guard replaces recognized claims with neutral **System** copy; this is a known-phrase mitigation, **not proof that every model paraphrase is verified**. No payment implementation, prices or secrets changed.

## Truthful capability, not launch approval

The request path persists a local owned request, records `SUBMITTED`, supports verified Admin takeover/reply, sequential status changes, and owned text-delivery/hash readback. It does **not** invoke HERMES/Factory or verify commercial acceptance. `WORK-SPECTRUM-*` / `workCreated:true` are local identifiers, not evidence that a downstream team accepted/started work. Customer copy explicitly distinguishes intake from accepted work/payment.

Read-only Cloudflare metadata links active version `1b6458a8-c673-42e7-8896-a33d12d1cdec` (100% traffic) to main `2ca6f7df…`; PR #61 and Mission2 are not deployed. See `production-metadata.json`. No customer requests, orders or submissions were read or created in production. `/health` READY is not used as capability evidence.

## Reproduction and evidence

```sh
npm ci --no-audit --no-fund
npm test
node --check src/index.js
node --check src/request-pages.js
git diff --check
XDG_CONFIG_HOME="$PWD/.wrangler/local-config" WRANGLER_LOG_PATH="$PWD/.wrangler/logs" \
  npx wrangler deploy --dry-run --outdir .wrangler/mission2-bundle
npm run test:e2e # supported Chromium host / isolated PR CI
```

- Baseline: 68/68 tests; final local suite: **93/93 passed**. Eleven new assertions failed on preserved PR61 source (see `baseline-reproduction.log`) and pass on the patch. New regression tests execute real rendered JavaScript against the actual workflow/SQLite, not mock-only assertions. DOM fixtures establish logic, **not browser layout**.
- `tests/request-isolation.test.cjs` runs the independent **56-check** matrix: 31 request/customer/Admin checks and 25 owned-order/download checks using synthetic SQLite/blob fixtures. An additional two-valid-Admin test verifies replies cannot impersonate another conversation owner.
- Customer B is denied A's request read/write/confirm/chat/status/handoff; unauthorized Admin list/read/write is denied; delivery text stays owner-protected. Order download GET/HEAD requires the corresponding owner capability and does not read a file on denial. **Payment provider calls are not made.**
- Existing PR #61 regression/browser tests remain part of the aggregate suite. Nine new browser cases cover the real Shop catalog-chat CTA and Custom Order form, extended journey at 390/1440px, uncertain replies, request switching and navigation/network recovery, with nonlocal requests blocked. GitHub run/artifact URLs and exact head SHA will be recorded in the Draft PR after terminal readback.
- Independent production-diff review, syntax, whitespace, secret-isolation and Wrangler dry-run passed. Dry-run initially lacked a global config directory; rerunning with an isolated workspace-local XDG config/log directory succeeded without credentials or deployment.
- Local Chromium launch/CUA loopback are known blocked paths; they were not retried. Browser acceptance must come from isolated GitHub CI, not local or production.

## Limitations and owner handoff

- A cookie is the customer capability. Clearing/expiry/replacing it or switching devices has no account-recovery flow; no broad authentication redesign is included.
- Unsaved bodies and message retry payloads are in page memory only. Server-saved Custom Order content can be recovered using its ID locator, not a browser-persisted body. Before-unload is browser-dependent (especially mobile) and is not crash/offline persistence. Accepting navigation can discard unsaved work. Only selected/pending request IDs are stored in sessionStorage. Custom Order saves a pending ID before writes; after reload, it reauthorizes a GET under the current owner cookie, restores an owned draft or resolves an already submitted request without another mutation. Tests cover lost-save and lost-confirm responses followed by actual reload. If sessionStorage is unavailable or the owner cookie is lost, recovery cannot be guaranteed; no raw PII or token is persisted to compensate.
- Request ownership protects delivery text and disclosure of an external delivery URL, **not the external host's file access control**. No external delivery host, marketplace purchase or provider sandbox checkout was exercised. The separate existing private-download route passed synthetic isolation tests only.
- Admin online availability, staffing/response expectations, external delivery/customer acceptance and downstream HERMES/Factory execution remain UNKNOWN.
- Stripe test context is BLOCKED in the connected session (live-only visibility); see `STRIPE-PLAN.md`. The plan is separate from implemented nonpayment fixes. No payment secrets, mode switches, prices or live enablement changed.
- GitHub deployment workflow is main-only/manual; read-only Cloudflare Builds trigger is main-only. This stacked Draft PR runs tests, not production deployment. No workflow, binding, permission, DNS or Notion change; no merge/deploy.

**Next step:** WEB/BIG review the exact-head evidence and stacked dependency #61; approve any release separately. Broader payment/sandbox/host permissions and external delivery policy are separate approval gates, not reasons to weaken this patch's safety boundary.
