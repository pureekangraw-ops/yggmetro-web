# Local acceptance — 23 October 2026

- Regression: 117/117 PASS.
- Presentation: Home, Shop, Gallery, Custom Order, product stories and retained
  commerce routes at 1440/768/390 pixels; no horizontal overflow, broken images,
  or uncaught browser errors. Product selection, modal, search, usage steps and GO open/close checked.
- Existing request recovery 4/4, full customer/Admin journey 9/9,
  conversation handoff 6/6, sandbox checkout/Office fixtures 18/18 PASS.
- New guided request + Office editing 5/5 PASS: successful submit, lost save
  response, lost confirmation response, no-write-before-server loss/refill using
  the same request ID, and JSON export readback without a server write.
- All 15 source bitmap assets are byte-identical to Sites v19 (manifest attached).
- Wrangler dry-run PASS with existing REQUESTS_DB and ASSETS; no extra binding.
- Browser runner: Playwright 1.62, local Chromium 153 with Thai font installed.
  Browser output is local fixture evidence, not production payment acceptance.
- Production/CI evidence belongs to the release PR and associated Actions runs.
