# Office Extraction Implementation Plan

> Execution authorization: the owner explicitly approved the `main`/`office` branch split and requested uninterrupted implementation.

## Task 1: Lock the Office worker contract with failing tests

- Add `tests/office-worker.test.cjs` for health identity, root redirect, session gate, authority outage, static assets, API pass-through, and payment response preservation.
- Run the new test and confirm it fails before implementation.

## Task 2: Implement the boundary worker

- Add `src/office-index.js` with dependency-injected routing.
- Keep original request URL, headers, cookie, method, and body when forwarding to GO Hub.
- Render Office-owned pages only after GO Hub session confirmation.
- Return explicit non-authoritative error states.

## Task 3: Move the Office presentation

- Add `src/office-shell.mjs` from the current verified Office Home v2 surface.
- Move CSS and browser JS into `office-public/`.
- Add a local login page; login/passkey actions continue to GO Hub.

## Task 4: Separate configuration and release lanes

- Add `wrangler.office.jsonc` for `yggmetro-office`, `GO_HUB`, and static assets.
- Add Office-specific pull-request safety and branch deployment workflows.
- Leave existing Shop workflow and `wrangler.jsonc` unchanged.

## Task 5: Verify and release

- Run full tests and syntax checks.
- Request an independent code review and resolve findings.
- Create long-lived `office` and feature branches, open a PR targeting `office`, and require exact-head CI.
- Merge only with green exact-head evidence.
- Deploy from `office`, verify health/assets/auth guard on workers.dev, and record Centre readback.
- Do not change the custom domain route in this run.

