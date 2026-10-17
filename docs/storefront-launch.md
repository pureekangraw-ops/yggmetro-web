# Storefront delivery and launch

The branch extends the separated storefront from PR #51. Home, Shop, Portfolio and Custom Order stay on their own routes. Product pages offer native cart checkout only when a server-side product mapping, Stripe key, signed webhook secret, D1 orders and private R2 downloads are configured. External PromptBase and free Notion links retain their existing purchase/access channels.

## Customer flow

Product details → cart → email and order summary → Stripe-hosted Checkout → verified webhook → private download. One digital product/license per checkout. Browser input contains only the slug, request ID and email; the server verifies the actual Stripe price and delivery object. Test and live sessions are isolated. Unpaid sessions never receive download entitlement.

Downloads use an HttpOnly owner cookie. Clearing that cookie or changing browser requires contacting the seller; email-based recovery is not implemented. Keep the same browser through checkout and delivery. Paid entitlements do not expire merely because payment confirmation took more than 24 hours.

## Required runtime configuration

| Binding | Purpose |
|---|---|
| `SHOP_ORDERS` | D1 binding; apply `migrations/0001_shop_orders.sql` before enabling checkout |
| `SHOP_DOWNLOADS` | Private R2 binding containing the actual ZIP deliverables |
| `STRIPE_CHECKOUT_MODE` | Set explicitly to `live` to select the live configuration; otherwise test mode |
| `STRIPE_CHECKOUT_ENABLED` | Must be `true` for live purchases |
| `STRIPE_SECRET_KEY` | Restricted live key; existing `STRIP_PRODUCTION` is supported as an alias only if its value is an actual `rk_live_` or `sk_live_` key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/v1/stripe/webhook` |
| `STRIPE_CATALOG` | Server-only JSON mapping described below |

Each catalog entry is keyed by the existing product slug and contains `enabled`, `priceId`, integer `amount` in minor currency units, `currency` (`usd` or `thb`), and private `deliveryKey`. Use verified existing prices and real deliverable keys. No live mapping is invented in source control.

The test equivalents remain `STRIPE_TEST_CHECKOUT_ENABLED`, `STRIPE_TEST_KEY`, `STRIPE_TEST_WEBHOOK_SECRET`, and `STRIPE_TEST_CATALOG`. Use separate test and live D1/R2 resources. Configure webhook events `checkout.session.completed` and `checkout.session.async_payment_succeeded`.

## Verified and outstanding

- Local Node regression suite and Wrangler dry-run validate code, not live payment acceptance.
- Browser workflow checks 1440px and 390px, image loading, overflow, search, cart navigation, and a failed checkout preserving the email. It uses test fixtures and never charges a card.
- Production bindings inspected on 2026-10-17 contain the pre-existing `STRIP_PRODUCTION` and `STRIP_SECRET` secret names, but no `SHOP_ORDERS`, `SHOP_DOWNLOADS`, product mapping or webhook binding. Secret values were not retrieved.
- The connected Stripe account exposes test mode with an existing $9 SHOP HOME test price. Live merchant/price readiness and real deliverable files remain unverified.
- Figma: `https://www.figma.com/design/84JSuYNGgnuB4jvMJ7RBZq`. Aurora page layouts and Blue Mist colors inform this branch. Exact Blue Mist raster parity is incomplete: the heading and icon PNGs inherited from PR #51 are corrupt; the original source is 1672×941, 1,807,822 bytes, image hash `aaaf54ac55ee25e6f189d34f20ebaec15c5c3471`. Figma asset URLs were unavailable from the local runtime and API transfer reached the service quota. Headings use readable native text temporarily; the corrupt portfolio icon-sheet entry is omitted. The original files are retained for recovery.
- No production merge, deployment, live charge, database provisioning, or paid-file publication is part of this draft.
