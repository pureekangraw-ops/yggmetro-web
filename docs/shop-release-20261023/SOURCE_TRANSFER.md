# Source transfer checklist for parent / GO

Transfer into a new evidence directory outside `src/` and `public/`; do not overlay the checkout. No tokens, `.env` files, secret bindings, customer records or browser cookies are needed. Preserve raw bytes before inspection. The parent can bridge files through Library if direct source access is unavailable.

## Known immutable identifiers

| Item | Expected identity |
| --- | --- |
| Sites project | `appgprj_6ad80383a3f081919cf04e2e175e3ca7` |
| Sites saved version | `appgprj_6ad80383a3f081919cf04e2e175e3ca7~appgver_5d2c6b0a63bc8191a9818bd3683a57d8` (19) |
| Authored source commit reported by Sites | `30e6813106aed2bb8e7a17b73cb9dfd7c5db21dc` |
| Sites archive file ID | `file_0000000060e881f79f2690f1c6ac491b` |
| Original Sites archive | TAR, 9,308,160 bytes, 32 files; SHA256 `169a2ed93503cd0c58c4597ee4d036ab35fdb121f1155dd58a57a37387a516d9` |
| Earlier Drive rollout ZIP, parent-reported | SHA256 `1be815646c1d0fb782df9598432827f9b4ae5d519af29f542bc7f2577ae95bcb`; version67 input, **not** exact version68 source |
| Current captured deployment | `a2a34c6d-67da-49aa-9541-a0993aec53ff` |
| Current captured Worker version | `ccd6faa9-dbee-406f-b0e1-c12a2c666268` (68), 100% |
| Captured Worker module bytes | 564,730 UTF-8 bytes; SHA256 `1d2f1f8bd15e0f4b3ebec9e0850736bd32ffc1345f38d08d8a42eccf481f9436` |
| Cloudflare script ETag | `01acc5762da3d842ad8ea4e2c02e75096baa3ab38aff3201bbc84e3982663684` — distinct from module SHA256 |

The archive metadata alone does not prove that its contents are authored source or that they reproduce production. Retain that distinction on transfer.

## Required files / facts

1. **Original archive unchanged**, preferably the Sites TAR above, and a separate original source export or repository archive pinned to the reported commit if the Sites TAR contains only built artifacts. Include a full relative-path inventory with per-file SHA256 and byte sizes. Original authored filenames are not yet known: do not invent `App.tsx`, source folders or build configuration.
2. **Authored UI and shared catalog**, covering home, gallery, product detail, hamburger/navigation, assistant/mascot, and relevant styles; include original owned raster assets. Include actual build scripts, package manifest and lockfile, entry points, configuration, runtime versions and exact build commands. Clearly label generated files and source maps. Keep one canonical product dataset.
3. **Production integration / Worker source**, based on the exact source used for version68, plus the complete opener-fix patch. Supply the base revision, changed relative paths, before/after hashes, build command and resulting Worker hash. Preserve the existing Finance catalog override. The opener-fix patch hash and authored-file hashes are currently unknown and must be supplied, not guessed.
4. **Complete deployed asset manifest**, mapping public URL path to artifact path, SHA256, bytes and content type, including all static assets, not just root dependencies. At minimum the deployed bundle references `/assets/shop/studio/content.js`, `/assets/shop/studio/content.json`, `/assets/shop/studio/editor.js`, `/assets/shop/studio/theme.css`, `/assets/shop/studio/widget.css` and an assets subdirectory; their exact hashes are unknown here. Include the entry HTML/adapter, dynamic imports, images and fonts. Distinguish observed public downloads from deployment inventory.
5. **Parent before screenshots and measurements**, with exact URL/hash route, CSS viewport width/height, DPR, browser, capture time, and whether physical-device, emulated viewport, or resized/zoomed desktop. Preserve original screenshot bytes/hashes. The existing 400×606 narrow audit must not be relabeled a 390px physical mobile test. Include baseline CTA destinations and product-specific guidance without submitting purchases/chat/forms.
6. **Fresh deployment readback around export**, identifying version, deployment ID and full traffic split. If GO changes production, retain both versions and report the change; do not silently update the expected baseline.

## Library text bridge, when binary transfer is unavailable

Prefer binary attachment for TAR/ZIP/images. If source text must be bridged, send a manifest and each file separately with exact relative path, original UTF-8 byte count, SHA256, encoding and newline convention. Preserve trailing newlines. Do not wrap a file in explanatory prose, reformat minified code, normalize whitespace or substitute rendered Markdown for source.

For chunked transfer, use numbered base64 chunks of the original file bytes, with total chunk count, per-chunk SHA256 and complete decoded-file SHA256/size. Use standard base64 with no transformation other than permitted line breaks. Reassemble in a new staging directory, verify the whole-file hash, then inspect. A truncated tool response is not a complete file. Unknown hashes remain explicitly pending until supplied and independently verified.

## Receipt / readiness checks

- Verify original archive SHA256 and size before extraction; reject unsafe archive paths, traversal and symlinks escaping staging.
- Verify every manifest entry and ensure no omitted/extra file is silently accepted; record received bytes in a new content-addressed snapshot.
- Read repository instructions before running build commands. Inspect scripts and configuration; build without production credentials and without deployment.
- Compare generated Worker and full static outputs with captured deployment. Explain any nondeterministic build difference with concrete evidence rather than declaring parity by filename or visual similarity.
- Reproduce the visual defect locally against the reconciled baseline, save baseline screenshots, then apply approved responsive/copy/image/launcher fixes. The release freeze remains in force; source receipt does not authorize merge or deployment.
