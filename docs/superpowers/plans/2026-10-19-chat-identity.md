# Chat Identity and Brief Workflow Implementation Plan

> Implementation: native execution in this session under the user's explicit code/test/PR authorization; no merge, deployment, paid checkout or Factory execution.

**Goal:** Persist customer-owned requests and truthful sender history with authenticated Admin handoff and delivery tracking.

**Architecture:** Reuse the existing storefront Worker and existing PANTHEON D1 resource via an explicit REQUESTS_DB binding and additive ygg_* tables. A scoped request API replaces anonymous public OwnerBridge task listing/creation. Admin credentials map to server-verified actor IDs; customer sessions use HttpOnly opaque tokens whose hashes are persisted. No new Worker, Hub, database or runtime agent.

**Tech stack:** Worker fetch, D1 transactions, browser JavaScript, existing OpenAI interpretation function, Node SQLite tests, Playwright and local workerd.

**Spec:** User order “Standardize Chat Identity & Brief Workflow”, 2026-10-19.

## Constraints and review focus

- AI - GO / Admin / System label actual server sender types; Customer is the customer's own sender.
- Never copy owner credentials, trust client sender roles, auto-dispatch Factory, merge or deploy.
- Cookie theft/recovery is separate from cross-device account identity; disclose browser-session scope.
- Confirm races, Admin-vs-AI races, stale status writes and retries must not duplicate or misattribute events.
- Delivered requires actual delivery reference; untrusted text renders through textContent.
- PR11 supplies ownership/idempotency patterns only; PR59 is stale against main and is not merged.

## Tasks

- [x] Add additive migration, request API and failing SQLite workflow tests: customer sessions/isolation, draft reload, duplicate confirm, role spoof rejection, Admin auth/handoff/status history and AI outage/races.
- [x] Implement scoped API in src/request-workflow.js. Retain legacy brief paths and identifiers as adapters; expose no public owner operations.
- [x] Implement customer and Admin views in src/request-pages.js with sender labels/timestamps, manual request submission independent of AI, draft editing, status history and delivery readback.
- [x] Integrate routes and server-generated AI identity; label deterministic shop responses System rather than AI. Keep commerce and provider interfaces intact.
- [x] Run full regression, real SQLite workflow, browser end-to-end customer→Admin→customer, local workerd and Wrangler dry-run; correct regressions.
- [x] Publish isolated branch PR with reproducible evidence, migration/credential steps and production limits. Verify remote commit/PR readback.
