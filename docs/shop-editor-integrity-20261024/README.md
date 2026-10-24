# Shop continuation: protect editable storefront drafts

Why this: Office accepted malformed advanced JSON/file imports that could replace an edited draft with incomplete product guides or invalid routing/link data. Such a draft could be exported for a later content PR even though it cannot correctly drive the storefront. This closes that local editing gap without changing GO's catalog or live site.

Based on merged main 43c32c9ff06e76ceadae4b4f35441678619effeb. Remote main was fetched on 2026-10-24; no newer Shop commits or channel updates were found. Direct Cloudflare GET at 04:56:32 UTC still reported deployment a2a34c6d-67da-49aa-9541-a0993aec53ff at 100% v68 ccd6faa9-dbee-406f-b0e1-c12a2c666268. Existing Brain handoff 1e2e51fd-6cff-410c-8cd5-b093358f36fb was recovered and its outcome updated with the editor/test-only work partition; this is not proof GO received the update. Existing browser-receipt request remains pending.

## Change and evidence

Only public/assets/shop/studio/editor.js application bytes change. Validation now requires complete guides, unique/stable routing identifiers, valid category relationships, usable HTTPS URLs without embedded credentials, supported image names, and the string/array shapes used by the storefront. Invalid imports leave the edited draft intact. Valid draft import/export remains local and unchanged in purpose. Product IDs are mapping keys; content copy remains editable. File existence still needs source/PR asset validation; this browser check cannot certify unpublished image files or external URL availability.

- Red evidence: old editor accepted missing guides; the expected rejection assertion failed (red.log).
- Green: five Office browser cases pass, including malformed advanced JSON/file imports, draft preservation and valid import/export at 390/768/1440, no overflow and no non-GET/HEAD browser requests (office.log).
- Existing Sites content/asset/routing tests: 4/4 pass (mapping.log). Syntax and diff checks pass.
- Screenshots: test-results/editor-integrity/editor-{390,768,1440}.png; uploaded by existing browser CI. No repeated unchanged full local suite or live browser audit.
- inventory.json lists the local candidate's public-asset hashes and all six unchanged product destinations/images. It is not a live asset-manifest or rollback certification.

## Preserved completed checklist

- [x] Canonical Sites19 source reconciliation, 135-entry original verification and baseline Worker reproduction.
- [x] Responsive storefront fixes, GO-owned content/prices/URLs, product/asset mappings and prior viewport acceptance retained.
- [x] PR72→71 merged as complete package; exact main/reviewed tree equality recorded previously.
- [x] Credential isolation and unconditional release freeze retained; original main-push guard blocked deploy.
- [x] Direct live identity/traffic/hash and deployable v68 rollback baseline previously verified; latest identity unchanged above.
- [x] Existing GO-reported live Browser Rendering coverage credited, not relabeled as independently inspected receipts.
- [x] Historical sandbox happy-path/order/ZIP evidence retained; no repeat purchase or credential setup.
- [x] Office draft-integrity gap reproduced and fixed in this continuation.

## Smallest remaining release blockers

1. Receive existing GO Browser Rendering receipts/screenshots from the pending handoff and reconcile actual route/viewport/time coverage. No need to repeat the unchanged reported audit. Observatory owner-invitation restriction and prior environment tunnel failure are separate access limits, not storefront outages.
2. Complete version-bound assets/configuration rollback evidence and explicit release/rollback package review. Current v68 is the proposed rollback baseline; v66 is historical and must not silently replace it. Cloudflare versions include static assets/configuration, but independent full asset-byte parity is not established here; storage data is not restored by Worker rollback.
3. Keep full commerce/Office acceptance separate: local fixtures and historical sandbox happy path do not certify the hosted negative/isolation/retry matrix, marketplace fulfillment or buyer receipt/opening. No new payment or customer write is authorized.
4. Branch protection remains unresolved from GO's reported protected:false/no ruleset and denied protection-endpoint 403. No retry, bypass or settings change in this task.
5. Production release requires a reviewed follow-up release path binding approved source/build/assets to fresh active deployment/full traffic, fail-closed readback, and GO's exclusive deployment window plus explicit rollout/rollback authorization. The guard protects repository entrypoints, not all direct Cloudflare API/dashboard deployers. Do not remove it or dispatch production deployment for this continuation.

This PR is reviewable source only. No merge, deployment, release-lock removal, product-content publication, transaction, secret or customer-data change. A request to deploy this website must name the final assembled revision/assets and approved release mechanism; a generic green-test result is not that approval.

## Independent review correction: asynchronous import ordering

The reviewer reproduced a second inherited defect: an older delayed file read replaced a later successful import. The focused regression reproduced it (race-red.log). Imports now capture a selection sequence and draft revision; a newer file selection, cancellation, empty selection, field edit, raw-JSON edit or successful raw apply invalidates the pending read. Stale successes/errors cannot replace content or notices. File selection while initial data is unavailable is rejected without changing drafts.

The affected Office suite passes 5/5: delayed out-of-order completion, editing during reads, incomplete raw JSON preservation, empty selection, chooser cancel event, malformed imports, valid imports and complete export→reimport→export equality at 390/768/1440. Existing local-only behavior and GO catalog remain unchanged. No broad unchanged local suite was rerun; normal PR CI remains required.
