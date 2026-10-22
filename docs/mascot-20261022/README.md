# GO storefront mascot

Based on PR #65 (`c630421ca76c0fc7be150487244a223232976ab3`). Replaces the existing catalog assistant launcher with BIG's approved GO character, adapted with built-in image generation into a transparent welcoming pose. WebP export is ~23 KB. Prompt: preserve white helmet, purple hair, cyan lights, blue eyes and white/navy/orange suit; one welcoming hand and tablet; single full-body character; transparent background without panels or decorative props.

The mascot gently bobs three times, respects reduced motion, opens the existing catalog assistant, and has a minimize button persisted in sessionStorage. It moves upward when overlapping controls and hides only if no tested position is clear. The existing inline GO entry point remains available. Image failure falls back to the text launcher.

Verification: 93/93 unit regression tests. Browser checks at 390 and 1440px: asset loads, reduced motion, real local assistant request produces Land Planner link, close, minimize and reload persistence. Storefront regression at 1440/708/390px checks navigation, asset loading, overflow and control collisions. Local preview uses the existing fixture server, not deployed Cloudflare or real payment providers.

No production merge/deployment. This PR depends on #65; inspect CI and release together or rebase once #65 merges. Animation is a single raster bob, not rigged hand waving or blinking.
