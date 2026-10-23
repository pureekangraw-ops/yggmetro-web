# Shop release integrity — source reconciliation pending

This branch prevents its deployment workflow and `npm run deploy` from replacing the approved direct release with stale repository source. **It is not deployed or merged, so it does not yet protect main.** No application, price, payment, secret or permission change is included. The existing checkout was clean; no worktree was created and no existing branch was merged.

## Verified provenance

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

This gate is scoped to these repository entrypoints. Direct `wrangler`, Cloudflare API, other checkouts and GO's outside deployments are not fenced by GitHub code or concurrency. No new credentials or permissions are requested. Existing main remains unsafe until an authorized workflow change is accepted. Do not merge this branch as part of this task.

### Compatibility with PR70

PR70 head `b7f02dc6e881023d7991f173a00d09569e936246` was fetched and its exact patch inspected. It isolates tokens to upload/account lookup, runs credential-free safety/build jobs, and deploys checksummed prebuilt bytes with `--no-bundle`. Those properties must be retained. This branch does not copy or overwrite PR70. Both touch deploy.yml and need deliberate reconciliation: retain `release-integrity`, make deployment depend on both safety and integrity, keep builds credential-free, and retain the lock check before any upload. PR70's exact workflow-shape test currently accepts only two jobs and an exact upload command; update that test explicitly when combining the patches. Do not silently relax its credential or artifact checks. PR42 also overlaps deploy.yml.

## Evidence and responsive verification

`npm test`: **118/118 passed**, including four new release tests. Those verify blocked release even with overrides, invalid lock rejection, detection of direct deployment/version/traffic changes, local npm deployment stopping before Wrangler, and workflow dependency placement. This is infrastructure regression evidence, not proof of current-live layout parity.

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
