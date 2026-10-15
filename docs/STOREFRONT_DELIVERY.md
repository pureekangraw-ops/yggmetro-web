# YGG METRO storefront — 2026-10-15

## Agreed customer experience

The homepage is a visual entrance: cloud hero, three-slide showcase, and links to the shop, portfolio and project intake. Catalog, services and buying guidance have their own pages. The intake is named HERMES for visitors; SPECTRUMSALE remains the existing machine-facing identifier. HERMES is a surface name, not a claim that the HERMES local model powers the chat.

Routes: `/`, `/shop`, `/products/:slug`, `/portfolio`, `/portfolio/cloud-stories`, `/services`, `/how-to-buy`, `/client`.

## Content and source boundaries

Product descriptions/status/prices were checked against Notion LAUNCHED PRODUCT (`f2576b1dd5954fd8a5e2f87dddaf393d`), last edited 2026-10-12. SHOP HOME is listed live at US$9 but no verified public marketplace purchase URL was found in that source or the underlying SHOP HOME page, so it retains an inquiry CTA. ROOT CAUSE and Adaptive Lens keep their existing public PromptBase routes. Finance has no confirmed price; Lost Era is pending approval. Neither receives a fabricated checkout.

Cloud Stories comes from the existing `feature/figma-product-assets-20261015` branch, five actual 1536×864 JPEGs. It is presented as portfolio preview with inquiry, not as an available 4K download or priced product. Studio and aurora visuals are existing repository assets. The studio image is labeled concept art, not a client case study. No paid Notion templates, customer records, signed Notion image URLs or credentials are published.

## Stripe sandbox implementation

Uses the existing connected Yggmetro test account. A real sandbox product was created:

- Product: `yggmetro_shop_home_test_20261015`
- Price: `price_1UQj3hLUh1BviBSHNR6JPxR3`
- Amount: 900 USD cents (US$9), from the existing SHOP HOME launch record
- Test mode only; not a new public direct-sale offer

Checkout uses server-side configured Stripe prices, verifies current amount/currency and delivery availability, and stores a pending order. Signed paid Checkout events (including asynchronous success) grant a durable order entitlement. Duplicate events cannot grant duplicate entitlements. Success-page navigation alone never unlocks a file. Downloads require the HttpOnly owner cookie, paid database state and a private R2 object. Access expires after 24 hours; recovery is through the existing contact path.

The integration remains disabled until all required sandbox resources are ready:

1. A dedicated test Worker environment and D1 `SHOP_ORDERS` binding. Apply `migrations/0001_shop_orders.sql`.
2. A private R2 `SHOP_DOWNLOADS` binding containing the authorized deliverable. Do not put paid deliverables in `public/`.
3. Restricted server-side `STRIPE_TEST_KEY` and `STRIPE_TEST_WEBHOOK_SECRET` secrets. Use a restricted test key with Price read and Checkout Session read/write permissions. Never paste secrets into source or the browser.
4. Configure the webhook at `/api/v1/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
5. Set `STRIPE_TEST_CATALOG` to the exact reviewed price/delivery configuration, for example below; enable only in the dedicated test environment after attaching the real authorized package.
6. Set `STRIPE_TEST_CHECKOUT_ENABLED=true` only for that test environment. Public deployment does not set this flag or add storage resources.
7. Verify an actual Stripe test Checkout → webhook → authorized download. Automated SDK fixtures are regression tests, not evidence of a real provider transaction.

Example configuration (non-secret, deliberately disabled):

```json
{"shop-home":{"enabled":false,"priceId":"price_1UQj3hLUh1BviBSHNR6JPxR3","amount":900,"currency":"usd","deliveryKey":"shop-home.zip"}}
```

No live keys are accepted and no production payment is enabled. Existing quote checkout through GO_HUB is unchanged. Marketplace listings remain the public sales channel until direct-sale licensing and delivery have been checked.

## Validation

Run `npm ci`, `npm test`, `npx wrangler deploy --dry-run`. Tests use SQLite for actual schema/order state and mocked Stripe boundaries. Browser acceptance at desktop/mobile and an actual Stripe sandbox transaction are separate checks; report their results only when executed.

## Execution evidence

- Automated regression suite: 44/44 passing, including actual SQLite order storage and real Stripe SDK webhook signature verification. Provider transaction calls in regression tests remain mocked.
- DOM interaction checks: carousel previous/next/dot/wrap/keyboard, catalog filter and GO launcher passed using JSDOM. This does not verify visual layout.
- Worker dry-run bundle and 11 static assets built successfully.
- Local browser preview could not connect to the local development port from the separate cloud browser, so no desktop/mobile visual acceptance is claimed.
- A preview workflow is prepared to upload an inactive Worker version when the PR is opened; it has not run.
- GitHub publication was rejected by automatic approval review because explicit authorization for the external repository destination was required. No branch publication, PR, merge or production deploy is claimed.

## Publication and preview follow-up

The user explicitly authorized GitHub publication and preview on 2026-10-15. PR #48 is open. The Safety Gate was fixed to install dependencies from the lockfile and passed on GitHub. The preview workflow runs all 44 tests successfully, then fails with Cloudflare authentication errors 10000/9109 from the existing GitHub token. An inactive, read-only visual preview was therefore uploaded through the connected Cloudflare API. It uses the same compiled pages, proxies only public repository images pinned to a commit, and blocks mutating API requests except the zero-provider-cost product assistant. It does not test real intake submission or payment. The active production deployment remains unchanged. Desktop browser checks covered the hero image, carousel interaction, catalog page, portfolio and HERMES intake. Mobile viewport acceptance is still pending.
