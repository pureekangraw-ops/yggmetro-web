# Stripe test checkout (isolated fixture only)

This code path is deliberately separate from the storefront catalog. It sells only `stripe-test-digital-fixture` for **US$1.00 (100 cents)** in Stripe Test mode. It never accepts a product, amount, or Stripe Price ID from the browser. No real product is eligible for this checkout.

## Required test-only Worker configuration

Use a separate Cloudflare Worker/environment, D1 database, and Stripe test webhook endpoint. Do not bind these settings to the production Worker. The existing production bindings named `STRIP_SECRET` / `STRIP_PRODUCTION` are intentionally not read by this code.

- `SHOP_MODE=test`
- Secret `STRIPE_SECRET_KEY_TEST` beginning `sk_test_`
- Secret `STRIPE_WEBHOOK_SECRET_TEST` beginning `whsec_`
- D1 binding `SHOP_DB`, pointing only to the test database
- Apply `migrations/0001_shop_test_orders.sql` to that database

The D1 database was not provisioned from this build because the Cloudflare API write was rejected by the connected account authorization. Create a dedicated test database, bind it to the test Worker, and apply the migration before running hosted E2E tests.

## Test flow

1. `POST /api/test/checkout` with an empty body creates the fixed-price Checkout Session and a pending order.
2. Return paths are `/test/checkout/success` and `/test/checkout/cancel`. Success only displays a pending state; it never marks an order paid.
3. Configure a Stripe Test-mode webhook to `POST /api/test/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
4. Webhook handling verifies the raw request body, timestamp (300-second tolerance), and `Stripe-Signature` with the test signing secret. It only moves the matching fixed fixture order to `paid` when Checkout reports `payment_status=paid`, the USD 100-cent amount, and the expected fixture SKU.
5. `GET /api/test/orders/{orderToken}` returns the order state. `GET /api/test/orders/{orderToken}/delivery` serves the fixture file only after the verified webhook transition. Repeated valid downloads remain available and are recorded in `delivered_at`.
6. `POST /api/test/orders/{orderToken}/cancel` expires an open test Checkout Session through Stripe before changing its order state.

Run local automated tests with `npm test`. Hosted end-to-end coverage still needs an isolated test Worker + D1 binding, test secret key, webhook signing secret, and a successful test payment/cancel run. Never use a live key or enable real charges for this workflow.
