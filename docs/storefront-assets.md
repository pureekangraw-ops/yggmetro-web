# YGG METRO storefront asset slots

The storefront keeps backgrounds, the home key visual, product artwork, portfolio artwork, and icons in separate folders. Replace files at the same path and dimensions to keep the layout intact. Do not use a background/cloud asset as a product or portfolio image.

| Role | Stable path | Recommended source size / ratio | Display behavior |
|---|---|---:|---|
| Website cloud background | `public/assets/shop/backgrounds/blue-smoke.jpg` | 1536 × 864 px, 16:9 or wider | Fixed cover background with a dark contrast overlay behind all page content |
| Home key visual | `public/assets/shop/brand-hero.jpg` | 1536 × 864 px, 16:9 | Separate home hero image; cropped with `object-fit: cover` |
| Product artwork | `public/assets/shop/products/<existing-product-name>.jpg` | 1240 × 1008 px, about 1.23:1 (or 2×) | Shop cards crop to a consistent 1.23:1 frame; do not replace with the cloud background |
| Portfolio artwork | `public/assets/shop/portfolio/aurora-cityscape.svg`, `cloudport-metropolis.svg`, `digital-planner-series.svg`, `notion-workspace.svg`, `creative-illustration.svg`, `product-design.svg` | 820 × 584 px, 1.404:1 (2× for a 410 × 292 px slot) | Home featured-work carousel and Portfolio gallery share these replaceable files |
| UI icons | `public/assets/shop/icons/<name>.svg` | SVG, `viewBox="0 0 24 24"` | Keep transparent background and the existing filename; scale to 24 × 24 CSS px |

The current portfolio images are visual placeholders marked `ARTWORK SLOT`, not published work. Replace each SVG at the stable path above with approved artwork at a 820 × 584 `viewBox` (1.404:1). Raster artwork can be embedded inside the SVG wrapper. The home key visual and cloud background are independent assets, so replacing one will not alter the other. For transparent icons, keep SVG files and their `viewBox` unchanged.
