# Mission 3 continuation: isolated checkout origin

## Result

Mission 2 documented that the production-only host and redirect constants prevented an isolated payment sandbox. This branch introduces an explicit, test-only sandbox origin used consistently by the storefront router, Checkout redirects, webhook receiver and owned downloads. Missing or invalid sandbox configuration fails closed without falling back to the live shop. Existing production configuration remains the default.

Base: PR #62 at `f633f1531ef3013738fe7f9717cbcdf9f36a8994`, stacked on PR #61 at `f659186f1d5b2d1e2340f515c560126c297d09b2`. Neither existing branch is changed. The new branch remains a draft; no merge or deployment is authorized by this checkpoint.

## Verification

- Baseline: 93/93 local regression tests pass.
- Four sandbox routing regressions fail against the baseline (`origin-red.log`).
- Updated suite: **99/99 pass**, including a synthetic checkout → pending download denial → signed-event fixture → owner-only download path on the sandbox origin.
- Cross-origin, production-host, HTTP, spoofed forwarded-host and live-mode misuse are denied. Malformed origin configuration is denied without provider calls or new order records.
- Syntax, `git diff --check`, and Wrangler dry-run pass. Dry-run uses the unchanged repository configuration and performs no deployment or database operation.
- No actual Stripe Session, webhook registration, payment, refund, price, credential or persistent resource was created. The signed-event fixture mocks the provider; the existing real-SDK signature test also remains passing. CI/browser results are separate and must be read from the new PR.

## Isolated runtime configuration

On an independently provisioned nonproduction Worker only:

- `SHOP_ENVIRONMENT=sandbox`
- `SHOP_SANDBOX_ORIGIN=https://<exact-dedicated-host>`
- `STRIPE_CHECKOUT_MODE=test` (or omitted)
- Existing test-only checkout configuration, dedicated `SHOP_ORDERS` D1 and private `SHOP_DOWNLOADS` R2, plus isolated `REQUESTS_DB` if customer-request flows are tested.

The origin must be an exact HTTPS origin without a path, query, fragment, userinfo, port, wildcard or IP address. Production `yggmetro.com` and its subdomains are intentionally excluded; use a dedicated nonproduction workers.dev hostname. Sandbox settings cannot enable live mode. Catalog pages carry `X-Robots-Tag: noindex, nofollow`; production canonical/OG links remain canonical metadata, not checkout redirects.

This code cannot prove the account, host, bindings or storage are isolated. Inspect those resources before configuring any sandbox. Do not deploy the repository's production `wrangler.jsonc` as a sandbox: it contains the existing production request database binding. No example file with guessed resource IDs is supplied.

## External blockers and remaining work

The Stripe connector on 21 October 2026 exposed only the Yggmetro live account, with `livemode=true`. No sandbox is available through that connection, so hosted Checkout and real provider-webhook acceptance remain blocked. The account/credentials and isolated resource setup must be resolved before online acceptance; live mode is not a fallback.

The broader payment findings in `../mission2-readiness-20261021/STRIPE-PLAN.md` remain open: durable pre-provider attempt/recovery, response-loss ownership recovery, cancellation/expiration and refund/dispute policy, and complete provider E2E. This patch addresses only the origin prerequisite and does not certify revenue readiness.

## Release review of existing missions

Fresh GitHub readback found both PRs Open/Draft, unmerged and mergeable, with main still at `2ca6f7df7f31257ebc113eccf932aa41ea6f6708`.

- PR61: Safety run 39600766750 and Browser run 39600766758 succeeded; job 119224377521 logs show 68/68 regression, storefront 1440/708/390px and 4/4 recovery.
- PR62: Safety run 39618421927 and Browser run 39618421924 succeeded; job 119285159017 logs show 93/93 regression, storefront 1440/708/390px, 4/4 recovery and 9/9 journey.

Review/merge order is #61 → #62 → this draft, preserving their ancestry and rechecking the next base after each merge. Main triggers production deployment; merge approval is therefore a release decision, not merely source housekeeping. Production/customer acceptance and payment readiness are separate from passing branch CI.
