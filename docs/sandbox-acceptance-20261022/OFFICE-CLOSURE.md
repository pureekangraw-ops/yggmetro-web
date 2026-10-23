# Office commerce closure — code prepared, runtime not activated

PR68 extends the existing Office/admin surface with `/admin/shop` and a read-only
`GET /api/v1/admin/shop/orders`. `/admin/requests` and its response schema remain
unchanged. Navigation links the existing request admin and commerce view.

The same canonical `SHOP_ORDERS.shop_orders` rows used by checkout, verified
webhooks and customer downloads supply order ID, currency, integer minor-unit
amount, payment status and timestamps. No duplicate database, catalog editor,
customer PII, owner cookies, artifact keys or checkout-attempt parameters are
exposed. Test/live histories and currency totals stay separate. Totals are gross
confirmed payments, not net revenue or refund accounting. Keyset pagination avoids
repeating rows when new orders arrive; each refresh reads current state, not a
historical snapshot. Totals cover all matching paid orders, not just the page.

The existing hashed `YGG_ADMIN_CREDENTIALS` verifier is reused. Authentication
alone does NOT grant commerce access: `SHOP_OFFICE_READ_ACTORS` must explicitly
list approved existing actor IDs as JSON. It defaults to no grants. Routes accept
only the Office HTTPS origin or the configured isolated sandbox origin, reject
cross-origin requests, and use no-store responses. Credentials stay in page
memory and are cleared on logout; late responses cannot restore logged-out data.
No runtime grants, credentials, bindings or migrations were changed.

## Truthful delivery evidence

`download_authorized` means the canonical order is paid. It is not a claim of
current R2 availability. `download_evidence: not_recorded` and
`customer_receipt: unknown` describe the existing schema accurately. Successful
response preparation, serving bytes, client receipt and opening the file are
separate facts. This patch does not manufacture delivered status, change original
receipts or add speculative storage. Existing test evidence of an owned ZIP is
historical proof for that particular test only. Unpaid and failed-download tests
verify Office never promotes either into customer receipt evidence.

## Verification

New unit cases cover missing/invalid admin authentication, explicit actor grants,
customer cookie denial, host/origin restrictions, same-order webhook/readback,
duplicate webhook stability, cross-owner download denial, unpaid/missing-file
responses, currency/mode separation, live insertion during pagination, and no
changes to request routes. Browser fixture tests extend the existing 390/1440px
checkout → signed fixture webhook → owned ZIP path into Office readback, invalid
login, logout and stale-response suppression. Fixtures make no Stripe transaction.
Screenshots are generated locally in `test-results/office-commerce-{390,1440}.png`.

## Runtime gates and historical evidence

- Parent cancelled upload elicitation `manager:edd44f006db349ef93f82c8222ab23bd:1`
  at 09:16:21 UTC. Only asset-upload-session manifest creation is confirmed.
  No byte-upload completion token or candidate version/promotion succeeded.
- Last readback 09:16:56: sandbox active/latest version
  `477d4fa5-fae8-4031-9c20-241f8580702b` at 100%; ASSETS absent.
- 09:19:26 sandbox GET `/products/checkout-test` returned 403:
  `Forbidden: requests to yggmetro-shop-sandbox.pureekangraw.workers.dev are not allowed`.
  No alternate route or direct retry was attempted.
- Historical real 40 THB sandbox purchase + paid Stripe/D1 + owned ZIP checksum:
  GO Brain record `dc25ce51-1831-40da-b67d-b8acb85bab23`, revision 9,
  checkpoint 03:12:40 UTC; application source `5c13ae3`. This does not prove the
  current candidate or Office deployment. Original order/artifact remain intact.

Minimum owner gate: approve specific Office actor IDs and the existing canonical
shop D1 read access for the target runtime; sandbox currently has neither admin
credentials nor the grant. Do not copy production credentials into sandbox.
An approved existing identity/transport must be supplied by the owner before
hosted Office acceptance. This code does not configure that authority.

Release separately requires approval for the exact new candidate and its 40 public
assets in `yggmetro-shop-sandbox`, preserving all existing bindings/settings. Do not
upload the prepared Wrangler configuration verbatim. Inspect inactive version
metadata before promotion. Forbidden host access must be resolved through the
approved access path before hosted browser proof. Main merge triggers production
CI deployment and remains held. No production mutations, new transactions or
Library uploads were performed. Overall B2E remains BLOCKED until current-version
sandbox purchase/delivery and approved Office readback are verified together.

Final local results for this patch: 112 unit tests PASS; storefront screenshots
at 1440/708/390 PASS; request recovery 4, journey 9, GO handoff 6 and checkout/Office
18 browser cases PASS. Logs and the two synthetic Office screenshots are adjacent
to this document. Independent review found and verified the keyset pagination fix;
no remaining blocking code findings. These are local fixture results, not hosted
Office or current-candidate Stripe acceptance.
