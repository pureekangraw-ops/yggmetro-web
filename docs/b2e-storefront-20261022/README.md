# B2E storefront revision — 22 October 2026

Owner instruction: adjust the real website using the new B2E (Begin to End) rule.
Rule source: GO Brain principle 4adb40bd-e257-4048-a184-b1c8c2e13064 revision 1.

## Scope and acceptance
Start: BIG's instruction and the observed production homepage / SHOP HOME gaps.
Deliverable: reviewable repository patch, rendered pages and screenshots for homepage product discovery, SHOP HOME explanation and customer-facing GO naming.
End: requester can inspect the actual rendered result and source; production remains a separate approval/deployment boundary.

## Changes
- Homepage now names concrete uses, links directly to the catalog and free Land Planner, and features three existing products before portfolio navigation.
- SHOP HOME uses a semantic HTML workflow illustration explicitly labelled as an illustration, not a product screenshot. Warm workbench styling draws on the Space Image Bank reference; no unapproved image was copied.
- SHOP HOME adds a start/use/return guide, Notion requirement, manual Quick Tools handoff and a second marketplace CTA. Existing price and marketplace destination are preserved.
- GO launcher now says GO and describes catalog help without exposing infrastructure terminology.
- Narrow-screen purchase links stack to avoid a three-line label observed in the first browser pass.

## Verification
- Local regression: 93/93 PASS after changes. Existing tests updated for intentional copy and two SHOP HOME CTAs; each CTA must preserve target and noopener/noreferrer protections.
- Syntax checks and git diff --check: PASS.
- Browser: rendered static output from the same source and existing assets; navigated homepage product card to SHOP HOME.
- Browser: SHOP HOME and homepage checked in 390px/708px iframe containers (actual content widths 375/693px after scrollbar); document scrollWidth equals clientWidth. This is responsive layout inspection, not physical-device testing.
- Browser: mobile 'สิ่งที่ได้รับ' click reaches #included, heading read back, top 89.8125px.
- Screenshot: shop-home.jpg (desktop page) and responsive.jpg (after mobile button fix).
- Earlier two local failures were expected content contract changes (catalog-mode wording and single-CTA count), repaired without weakening link security checks.

## Boundaries
No merge or production deployment. Preview uses exported HTML, so it is not runtime API acceptance. No new real payment test is claimed. Finance listing remains pending source reconciliation. Real SHOP HOME product screenshots and product-version QA remain separate work; illustration is not evidence of the delivered template interface. No price, secret, storage or checkout logic changes.

## Browser CI repair
Initial browser run 39718797526 failed because the existing collision guard hid the floating GO launcher over the new product content. Add an inline homepage GO opener, preserve collision hiding, synchronize expanded state, and restore focus to the opener on close. Update the homepage browser journey to use this stable visible entry and include SHOP HOME in the responsive route sweep. This repairs discoverability rather than disabling the obstruction guard. Follow-up CI is required.
