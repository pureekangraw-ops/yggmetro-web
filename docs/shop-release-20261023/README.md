# Shop release integrity — source reconciliation pending

## Final implementation and acceptance

GO's final source archive is identified by SHA256 `42fa4c8b9292ecf1a5b68732f1a7fb1ab08585fb9ee5798168378b6f5800279a`. Parent verified the complete 24,806,084-byte archive. This executor independently verified **all 135 original manifest entries** after lossless Library transfer: 93 UTF-8 files, 41 hash-matched local binaries, and the four remaining original PNGs received in 34 base64 chunks. No original archive bytes were downloaded into this executor. Three extra transfer records are separately retained. See `evidence/source-transfer-receipt.json` and `go-TRANSFER-MANIFEST.json`.

Baseline commit `e2ab67a` integrates the authored Sites19 text, production adapter and delegated opener fix; the four original PNGs were added later unchanged. Original source is preserved in the staged receipt and Git history. Workflows and the unconditional release freeze are retained. The shared `content.json` (including every price and external URL), checkout implementation, bindings and configuration remain byte-identical to GO's baseline. Only native cart explanatory prose changes.

The responsive changes retain the desktop hero layout, reduce mobile/tablet hero spacing and wordmark size, place the closed mascot in normal page flow after the footer, and keep header/product buttons connected to the same dialog. The duplicate floating launcher is removed. Product openings now expose the correct external CTA; platform/delivery guidance uses each product's existing shared guide rather than generic Notion/Web App copy. Header buying guidance and `/how-to-buy` lead to actual catalog destinations; native cart copy explains that external products are purchased at their platform.

Four display-sized WebP derivatives reduce their combined bytes from **5,429,172 to 214,060 (96.1%)**. Originals are retained, and `docs/sites19/optimized-assets.json` records input/output hashes, dimensions, bytes and generator version. Reproduce with `python scripts/optimize-shop-images.py` using Pillow. This is byte reduction, not a measured LCP claim.

Validation: **125/125 unit tests**, storefront navigation at **390/768/1440**, request recovery **4/4**, customer/Admin journey **9/9**, handoff **6/6**, checkout/Office **18/18**, Sites workflows **5/5**, new responsive checks **3/3**. All pass on local synthetic fixtures; no production submissions or provider transactions. Old tests targeting the intentionally removed duplicate launcher now use the retained GO launcher, without removing journey assertions. New checks enforce image completeness, semantic product CTA destinations, product-specific guidance, menus/Escape, dialog bounds, and no horizontal overflow. Wrangler dry-run and whitespace/syntax checks pass. Initial red tests and intermediate incomplete-asset failures remain historical evidence.

### Before / after screenshots

Captures are a local replay of the fully verified GO baseline and the candidate, not fresh production screenshots. DPR1; mobile/touch emulation at 390/768; desktop at 1440. Heights: 844/1024/1024 respectively. The parent separately owns native production audit screenshots. Home, Adaptive and buying-guide screenshots at all sizes are under `evidence/browser/{before,after}/`; hashes are in `evidence/SHA256SUMS.json`.

| Viewport | Home showcase top before | After | Broken images / horizontal overflow |
| --- | --- | --- | --- |
| 390×844 | 650.41px | 531.06px | None / none |
| 768×1024 | 681.95px | 493.92px | None / none |
| 1440×1024 | 202px | 202px | None / none |

[Mobile before](evidence/browser/before/home-390.png) · [Mobile after](evidence/browser/after/home-390.png) · [Tablet after](evidence/browser/after/home-768.png) · [Desktop after](evidence/browser/after/home-1440.png) · [Product after](evidence/browser/after/adaptive-390.png) · [Buying guidance](evidence/browser/after/buying-390.png).

### Remaining release limitation

A minified Wrangler 4.151.1 build of the unmodified source baseline succeeds with existing bindings, but its Worker SHA256 `9f50ca43a034df4d105cf20b752a3fff888a1f65bc55eb5d6b903f19bf1d1b3c` (564,825 bytes) differs from the captured runtime module (564,730 bytes). Different minified symbols/statement formatting and a sourceMappingURL are observed. Exact reproduction still needs GO's original build command/toolchain and comparison; byte-for-byte compiled parity is not claimed. Source/archive/asset provenance is verified independently. The release freeze remains unconditional, and nothing is merged or deployed.

The sections below retain the initial investigation and release requirements. Historical source/image access blockers have been resolved as described above; the exact compiled-output reproduction limitation remains.

This branch prevents its deployment workflow and `npm run deploy` from replacing the approved direct release with stale repository source. **It is not deployed or merged, so it does not yet protect main.** The initial guard-only commit changed no application code; subsequent source reconciliation and presentation changes are documented above. No new price, payment, secret or permission change is included. The existing checkout was clean; no worktree was created and no existing branch was merged.

## Initial verified provenance

- Repository main/initial checkout: `6e24fb3fe8453fe269b853848c002fba394affd9` (PR68), independently checked with `git ls-remote`.
- Cloudflare GET deployment readback: `a2a34c6d-67da-49aa-9541-a0993aec53ff`, created `2026-10-23T06:28:18.65528Z`, source `api`, 100% version `ccd6faa9-dbee-406f-b0e1-c12a2c666268` (version 68).
- Tag: `sites19-drive-fix-20261023`. Annotation: Sites v19 Drive rollout with dynamic product assistant opener fix.
- Script ETag: `01acc5762da3d842ad8ea4e2c02e75096baa3ab38aff3201bbc84e3982663684`.
- `evidence/runtime-worker.mjs.gz` preserves the compiled Worker returned by the authorized Cloudflare GET script endpoint. Multipart framing was removed, without editing worker content. Repeated chunk reads had identical uncompressed SHA256 `1d2f1f8bd15e0f4b3ebec9e0850736bd32ffc1345f38d08d8a42eccf481f9436`. This is compiled runtime evidence, **not original authored source**; it is not connected to a deployment build.
- Sites project `appgprj_6ad80383a3f081919cf04e2e175e3ca7`, saved version 19 identifies source commit `30e6813106aed2bb8e7a17b73cb9dfd7c5db21dc` and archive SHA256 `169a2ed93503cd0c58c4597ee4d036ab35fdb121f1155dd58a57a37387a516d9`. See the exact version and archive IDs in `evidence/provenance.json`. These are tool-reported metadata; archive bytes/authored source have not been retrieved or rebuilt here.
- Parent reports the prior Drive ZIP SHA256 `1be815646c1d0fb782df9598432827f9b4ae5d519af29f542bc7f2577ae95bcb` corresponds to version 67, before the opener fix. It is not exact version 68 parity.
- No AGENTS.md was found in the workspace repository tree. Existing open PRs were inspected, especially #70 and overlapping workflow PR #42. No duplicate release-integrity PR existed at initial inspection.

## Deliberate fail-closed release state

The credential-free `release-integrity` job must succeed before the existing deploy job can start. The guard always exits 1 while reconciliation is pending. It is checked again immediately before Wrangler and in the npm deployment command. Missing/corrupt lock data, an edited state, command flags and environment overrides cannot unlock it. Dependencies are not installed by the gate.

The active-deployment comparator is prepared and regression tested; it compares the **first/current** Cloudflare deployment ID and its complete traffic split, not a matching old deployment in history. It is not an enabled release path. There is deliberately no pretend approval flag or fake source hash to bypass the freeze.

Independent review found two latent comparator defects: malformed matching baseline/provider data could pass, and object/array ordering could reject equivalent traffic distributions. Three new tests reproduced those defects and invalid identical traffic acceptance before the fix. The comparator now validates baseline schema/worker/UUIDs, provider success/result/current-deployment structure, distinct version UUIDs, finite positive percentages bounded by 100 and total traffic of 100 (with floating-point addition tolerance). It compares distributions by version ID independent of key and version ordering. The unconditional release freeze never called this comparator, so the defects did not create a reachable deployment bypass. The comparator remains inactive in the release path.

This gate is scoped to these repository entrypoints. Direct `wrangler`, Cloudflare API, other checkouts and GO's outside deployments are not fenced by GitHub code or concurrency. No new credentials or permissions are requested. Existing main remains unsafe until an authorized workflow change is accepted. Do not merge this branch as part of this task.

### Compatibility with PR70

PR70 head `b7f02dc6e881023d7991f173a00d09569e936246` was fetched and its exact patch inspected. It isolates tokens to upload/account lookup, runs credential-free safety/build jobs, and deploys checksummed prebuilt bytes with `--no-bundle`. Those properties must be retained. This branch does not copy or overwrite PR70. Both touch deploy.yml and need deliberate reconciliation: retain `release-integrity`, make deployment depend on both safety and integrity, keep builds credential-free, and retain the lock check before any upload. PR70's exact workflow-shape test currently accepts only two jobs and an exact upload command; update that test explicitly when combining the patches. Do not silently relax its credential or artifact checks. PR42 also overlaps deploy.yml.

## Initial evidence and responsive preparation

Initial `npm test`: **118/118 passed**, including four release tests; comparator follow-up: **121/121 passed**, including seven release tests. Those verify blocked release even with overrides, invalid lock/schema/distribution rejection, semantic traffic comparison, detection of direct deployment/version/traffic changes, local npm deployment stopping before Wrangler, and workflow dependency placement. This is infrastructure regression evidence, not proof of current-live layout parity.

`tests/e2e/shop-responsive-audit.mjs` prepares read-only capture at 390×844, 768×1024 and 1440×900 CSS pixels (DPR1, mobile/touch enabled at the first two). It blocks non-GET requests, APIs, unknown origins and service workers; it never clicks CTAs, chat or forms. It records response asset bytes under SHA256, viewport dimensions, horizontal overflow, loaded fonts, Thai text presence, images, navigation/CTA bounds and fixed elements; screenshots and HTML are written to a new output directory. These measurements still need visual Thai typography, navigation and mascot/CTA overlap review. Product detail coverage must be extended with exact canonical routes and selectors after source retrieval.

Run only against the approved public origin or isolated localhost:8787:

```sh
CHROMIUM_PATH=/usr/bin/chromium node tests/e2e/shop-responsive-audit.mjs
SHOP_AUDIT_ORIGIN=http://127.0.0.1:8787 CHROMIUM_PATH=/usr/bin/chromium node tests/e2e/shop-responsive-audit.mjs
```

The attempted live browser run failed at the execution proxy, as did curl and the web tool. HTTP403/CONNECT failures are retained; they do not prove a production outage. No valid live screenshots or complete asset snapshot were obtained here. Do not represent error pages or the stale main UI as before/after screenshots. Parent's separate native audit and screenshots are independent evidence.

Parent's confirmed audit findings to apply after reconciliation: preserve desktop design; mobile hero needs less vertical space; mascot can cover home text and desktop product content despite separate assistant launcher; existing narrow sampled views showed no overflow. Cart/help disagree with SPA external-purchase channels. Adaptive needs AI Skill-specific platform/deliverable guidance. Root Cause is 7 credits; Adaptive US$6.99; Finance already has the correct deployed catalog override. Prices/payment logic must remain unchanged. Approximately 6.59 MB eager homepage references are a byte finding, not measured LCP; optimize owned raster sizes with normal asset tooling after originals are available.

## Required reconciliation and rollback

1. Obtain GO's authored export and build instructions, source commit, complete deployed asset manifest and exact opener-fix patch. Preserve the original artifacts by hash. Distinguish original Sites source, production adapter, compiled output and repository source.
2. Reproduce version68 Worker and assets or document every verified intentional difference. Use one shared product dataset and preserve the current desktop design. Do not replace the site with old main or edit minified output as if it were authored source.
3. Capture baseline and after screenshots with the actual 390/768/1440 viewports; test menus, product CTAs, Thai font/line height, spacing, fixed overlays and channel-specific help without production submissions. Store each build/source/asset hash with its results.
4. Only in a reviewed follow-up, replace the unconditional freeze with a release design binding approved source/build/asset hashes to a specific expected active deployment. Use the existing credential scope from PR70 for fresh Cloudflare GET readback immediately before mutation; timeout, malformed response, changed ID, changed split or missing provenance must fail closed. API readback followed by upload is **not atomic**: GO must coordinate an exclusive release window or an actually enforced shared lock. GitHub concurrency alone does not cover direct API deployers.
5. GO owns any future production rollout and rollback. Before release, verify the previous version remains available and its asset set/configuration are retained. If rollback is authorized, restore the exact known-good version and corresponding assets/configuration, then read back active traffic and verify public routes/screenshots. Do not use a stale Git SHA as rollback. This document intentionally provides no executable production mutation.

To abandon these local changes, leave main/production untouched and close the draft PR. Removing the freeze in an accepted branch is itself a release-affecting change and must follow the reconciliation above; reverting it blindly reopens stale deployment risk.
