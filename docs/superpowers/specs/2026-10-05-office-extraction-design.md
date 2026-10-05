# Office Extraction Design

**Status:** Approved for execution by the owner on 2026-10-05.

## Goal

Move the YGG METRO Office presentation and release lifecycle out of `prytaneion-workspace` and into the `office` branch of `pureekangraw-ops/yggmetro-web`. The storefront remains on `main`. GO Hub remains the authority and control plane for identity, Work, sales, payment evidence, and operational APIs.

## Boundaries

- `yggmetro-web/main` owns and deploys the public Shop worker.
- `yggmetro-web/office` owns and deploys the Office worker and Office static assets.
- `go-hub` remains the source of truth for authentication, Centre Work, quotes, provider-confirmed payment events, assets, and Office API responses.
- The Office worker may render presentation and proxy same-origin requests, but may not invent or promote financial state.
- No card data or provider secret is stored or logged by the Office worker.
- This delivery deploys and proves the new worker on `workers.dev`. Changing `office.yggmetro.com` DNS/routes is an owner-only provider-account action and is explicitly outside this run.
- The old Hub-hosted Office surface is not maintained for compatibility. Its removal is deferred until after custom-domain cutover and readback so this run does not perform a destructive production action.

## Request flow

1. Browser requests an Office page from the dedicated Office worker.
2. Office worker asks GO Hub `/office/session` through the existing service binding using the original URL and cookie.
3. Authenticated page requests receive the Office-owned HTML shell and assets.
4. Office API, login, logout, passkey, upload, and action requests are forwarded unchanged to GO Hub.
5. GO Hub remains responsible for authorization and owner-source responses. Payment truth remains `GO_REVIEW_REQUIRED` unless provider/owner evidence satisfies the existing authority rules.

## Failure behavior

- An unauthenticated session redirects to `/office/login`.
- An unavailable authority returns a visible `503 OFFICE_AUTHORITY_UNAVAILABLE`; it never falls back to a locally trusted session.
- Unknown routes return `404 OFFICE_ROUTE_NOT_FOUND`.
- Proxy responses, including payment and refund-related statuses, are relayed without reinterpretation.

## Release contract

- Pull requests for Office target the long-lived `office` branch.
- Office CI runs the full repository test suite plus syntax checks.
- A push to `office` deploys only the `yggmetro-office` worker and performs workers.dev smoke tests.
- Shop deployment remains bound to `main` and is unchanged.

