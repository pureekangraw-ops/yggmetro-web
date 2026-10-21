# Independent Mission2 request/Admin/delivery review

Scope: read-only target source inspection and local synthetic in-memory execution. No production endpoint probing, customer records, payment provider calls, credential changes, or publication. Baseline source f659186f. Owner is separately changing request-pages.js; final patch review is pending.

## Results established
- `node --test tests/request-workflow.test.cjs tests/spectrum-conversation-contract.test.cjs tests/stripe-checkout.test.cjs`: **29 passed**, 0 failed after the implementation owner supplied the existing dependency symlink. Before that, 9 direct tests passed and 7 imports were blocked by absent stripe; no code defect was claimed from missing dependencies.
- Independent script `atlas-mission2-isolation-review.mjs`: **31 request/Admin checks +25 download checks passed**. Uses actual handlers plus synthetic SQLite stores. Unauthorized requests never receive private brief/delivery content; unauthorized download never calls object storage. Legitimate owner and Admin control cases remain operational.
- Ownership control: `src/request-workflow.js:56`, `:92-102`; list owner filter `:87`; authenticated Admin bearer hashing `:25-31`; post origin guard `:77`; cookie validation/expiry `:33-42`.
- Shop artifact ownership + paid gate: `src/stripe-checkout.js:89-97`. No payment mode/config/code changed by review.
- Sequential confirmation/message replay, failed-transaction rollback, Admin takeover during AI generation, signed webhook gating and webhook idempotence are covered by existing passing tests. Local proof is not production evidence.

## Confirmed candidate: customer raw-error exposure (medium)
Baseline `src/request-pages.js:16` renders `errors[text] || text`; `:17` can throw JSON/fetch exceptions; `:29`, `:34`, `:40` forward `error.message` to the notice. Unknown API error codes and browser JSON parsing internals therefore become customer text. Expected test: inject unknown API code/invalid JSON/network rejection; customer sees one safe localized fallback, not raw value. Implementation owner acknowledged and is fixing this.

## Confirmed candidate: unsupported model operational/payment claims (medium)
`src/index.js:128-145` applies output filtering only to internal terms/templates and input-pattern policy. It never validates payment/accepted/started/completed assertions against server evidence. Actual Worker local test with neutral input `สถานะล่าสุดเป็นอย่างไร`, fabricated provider output `ได้รับชำระเงินแล้ว ทีมรับงานและเริ่มทำงานแล้วครับ`, and no business-state binding returns HTTP 200 with that reply verbatim and sender `AI`. This establishes absence of the deterministic guard, NOT that any real model emitted this.

Recommended bounded fix: explicitly disallow unsupported model-originated payment/acceptance/start/completion/delivery assertions and replace with safe state-unverified text before sender provenance is computed. Add Thai and English hostile-output fixtures on neutral input; ensure fallback is `System` through full Worker. Add model instruction that only UI/server state is authoritative. Regex-only phrase screening is conservative mitigation, not proof against every paraphrase; do not claim universal prevention.

## Evidence limits / readiness caveats
- `/health` at `src/index.js:430` returns `READY` even when env bindings are absent. It is liveness only, not customer-journey readiness evidence.
- Confirmation at request-workflow `:109-111` persists a local SUBMITTED row and synthetic local `WORK-SPECTRUM-...` correlation. `workCreated:true` does not establish HERMES acceptance, dispatch or started work. No HERMES integration is performed in this path. UI should say saved/awaiting review and not imply external acceptance.
- Delivery text is protected by request ownership. An arbitrary HTTPS `delivery_url` is validated for URL syntax only (`:127`); this service protects URL disclosure, not the target host's file access policy. External link authorization was not probed and cannot be certified.
- No existing internal-notes field is published by the request schema. API includes audit actor IDs, sender IDs and local work correlation, but UI renders labels rather than actor IDs; this is not an authentication token leak.
- Browser-level cross-request composer/delivery-draft leakage is being fixed by owner. Independent final-diff/test review will follow owner readiness message.

## Final production-diff reassessment (2026-10-21 14:09 UTC)
- Independently read the pending `src/request-pages.js` and `src/index.js` diff over f659186f, not merely its added tests.
- Fresh `npm test`: **83/83 PASS**, 0 skipped, 0 failed. Fresh original external reviewer script: **31+25 PASS**; final result stored in `atlas-mission2-isolation-review.final-result.json`.
- Raw customer error candidate closed for original paths: `reportError` maps only own allowlisted codes and otherwise uses a safe localized fallback; no exception message passthrough remains in these UI catches.
- Original unsupported-model-claim reproducer now returns neutral status-unverified text with `sender_type: SYSTEM` and `sender_id: conversation-policy`. Known phrase mitigation works; it remains non-exhaustive and is not a universal semantic truth verifier.
- Inspected new per-request composition maps, immutable uncertain-send payloads, Admin session epoch checks and privileged-view clearing. No new isolation blocker identified in this focused diff. New tests cover late message response vs edited content and cross-request switching, uncertain retries, failed Admin login, logout with in-flight response, foreign sessionStorage request IDs, and delivery composer isolation.
- `git diff --check` passed. Target production source edits were made by implementation owner, not reviewer. Browser agent's E2E execution is separate evidence, not claimed here.
- Verdict: **PASS for the bounded local access-control/customer-state regression review**, retaining all production/HERMES/external-file limitations above. This is not a full repository security audit or an assertion that the deployed service is ready.

## Custom entry and refresh recovery final review

Independent review additionally ran the actual entry script against synthetic handlers/SQLite: forced same ID across two customers is denied without overwrite; replacing owner cookie after a lost-create response cannot claim or confirm; lost-confirm replay commits one submission while retaining newer edits; failed bootstrap produces no writes or internal-error leak. Refresh-specific forged/stale locator, owner-authorized readback and ID-only storage checks passed. The reviewer caught a disabled-controls/FormData dirty-baseline bug; a failing regression was added and the snapshot now reads named controls consistently. Progressed requests display their authoritative status label instead of reverting to awaiting review.

Final reviewer readback: **93/93 full tests**, **31+25 access/download checks**, and **3 independent refresh scenarios** passed. Reviewed `src/storefront-layout.js` SHA-256: `c85b917c34dc2b9c1fafd0001747e76a64963ccc26cda0a6b97e556f8df90dd4`. No blocking finding for the bounded patch. Existing cookie/storage/provider/external-file limitations remain; browser CI is separate evidence. No source changes were made by the reviewer.
