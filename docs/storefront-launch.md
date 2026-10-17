# Storefront delivery and launch

The branch extends the separated storefront from PR #51. BIG directed on 2026-10-17 that products already sold on another storefront should link directly there. Shop cards and details therefore open their existing external purchase/use URL; those products are excluded from local cart checkout even if a native mapping exists. Home, Shop, Portfolio and Custom Order stay on their own routes. Product pages offer native cart checkout only when a server-side product mapping, Stripe key, signed webhook secret, D1 orders and private R2 downloads are configured. External PromptBase and free Notion links retain their existing purchase/access channels.

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
- The connected Stripe account exposes test mode with an existing $9 SHOP HOME test price. Live merchant/price readiness and real deliverable files remain unverified for any future native checkout. This does not block the four externally hosted product storefronts supplied by BIG: ROOT CAUSE and Adaptive Lens on PromptBase, SHOP HOME and Lost Era on Notion; payment/delivery stay on their platforms.
- Figma: `https://www.figma.com/design/84JSuYNGgnuB4jvMJ7RBZq`. Recovered the five previously approved transparent heading PNG originals from `YGG-METRO-headings-transparent.zip` (Library libfile_797badeed5488191889cb6da36677df8). All files fully decode with genuine alpha; the source PNGs replace the corrupt repository copies without recompression. The user-provided 6031.png repairs the portfolio icon sheet as icons.jpg. The 10 newly supplied files fully decode as JPEG despite their .png names; they are used unchanged as promotional/display assets, not assumed paid deliverables. Exact Blue Mist composite raster remains unavailable, but readable placeholders are no longer used for the approved heading set.
- No production merge, deployment, live charge, database provisioning, or paid-file publication is part of this draft.
