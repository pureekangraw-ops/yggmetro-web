# Sites 19 → production storefront

Design source: YGG METRO Shop Design Preview, project
`appgprj_6ad80383a3f081919cf04e2e175e3ca7`, saved version 19,
source commit `30e6813106aed2bb8e7a17b73cb9dfd7c5db21dc`.
Production base: `6e24fb3fe8453fe269b853848c002fba394affd9`.

The existing Worker serves the imported visual assets and layout for Home, Shop,
Gallery, product stories and Custom Order. Existing `/client`, request/Admin APIs,
Stripe checkout, webhook and owned downloads remain the backend. The standalone
Sites project is a historical design reference; future production edits belong here.

## Editing

Open `https://office.yggmetro.com/admin/storefront`.
1. Edit homepage/product fields or import an earlier content.json.
2. Preview the text and export content.json. This is a local draft, not publication.
3. Follow the GitHub upload link and upload to `public/assets/shop/studio/` under
   the same filename in an isolated review branch with your authorized GitHub account.
   The release-integrity freeze blocks publication pending reconciliation and approval;
   do not upload directly to main to bypass review.
4. For images, choose PNG/JPEG/WebP, preview and download under the desired filename.
   Upload via the image link to `public/assets/shop/studio/assets/`. Use the matching
   filename in content.json. Upload new image names before referencing them.

The editor is a public-data preparation page, not an authenticated write API.
Only GitHub can authorize repository writes. It holds no tokens and has no server
save/publish endpoint. Do not describe its download button as saving the live site.

`content.json` is shared by browser presentation and server catalog/assistant.
It holds reference display prices; actual native checkout prices remain server-owned.
It also contains categories, gallery cards, service descriptions and product guides.
Keep product IDs stable; adding a new product needs its guide and server catalog review.
`theme.css` is the small override file for future colors/spacing. Original Sites CSS
and all 15 bitmap files were copied without image alteration.

## Behavior differences from the prototype

- Preview banner removed. Work links use `/client`; no simulated jobs/invoices shipped.
- GO's existing catalog assistant and owned conversation handoff remain available.
- The guided brief submits to existing request APIs and reads the saved status back.
  Only its request ID is retained across reloads. Unsent personal text stays in page
  memory; leaving warns. An uncertain write retries the same request ID.
- `/custom-order/quick` retains the prior short form and its tested recovery behavior.
- Native `/cart`, `/checkout`, `/order` and sandbox stay on the existing implementation.
- Finance uses its public Notion Marketplace destination and reference US$19 price,
  as documented in PR69; no Stripe price or payment activation is changed.
- Legacy hash routes and existing product URLs still open the matching presentation.

## Verification

`npm test`
`npm run test:e2e`
`npx wrangler deploy --dry-run`

Browser suite covers 1440/768/390 layouts, loaded assets, navigation, product steps,
existing customer/Admin workflows, owned chat handoff, dummy checkout fixtures,
guided submission with lost save/confirm responses, and an Office JSON download
whose edited content is read back from the downloaded file.
Browser payment fixtures are not provider/payment acceptance.

## Rollback

GO owns release and rollback. Preserve and verify the exact known-good Worker version,
assets and configuration before any separately authorized rollback. Do not revert a
GitHub commit and assume that it restores the direct deployment. The unconditional
release guard remains in force; see `docs/shop-release-20261023/README.md`.
No migrations, new bindings, DNS changes, secret changes or customer-data rewrite.
Do not overwrite pending PR69/70; reconcile their overlap with the shared catalog
and deployment workflow against the new main before merging them.
