# YGG METRO — GitHub-first media

Source of truth: this repository. Do not use Google Drive as a required intermediary for new storefront images.

## Upload images

1. Open GitHub repository > public/assets/shop > Add file > Upload files.
2. Upload a PNG, JPEG, or WebP image (max 8 MiB; PNG max 8192px per side). Prefer descriptive lowercase filenames.
3. Edit public/assets/shop/manifest.json and add an entry, e.g.:
   `{"file":"cloud-stories-cover.png","alt":"Cloud Stories artwork","category":"portfolio"}`
4. Commit to a feature branch and open a PR. The Shop media validation workflow checks that all manifest images exist and pass basic validation.
5. After review and merge, deploy the existing site via its established deployment pipeline. Merely uploading to GitHub does not make an image appear on the website.

## Website and Figma

Wrangler publishes `public` with the ASSETS binding. Website image URL after deployment: `/assets/shop/<filename>`. Missing shop assets return 404 rather than homepage HTML. Preview configuration is enabled; sales backend bindings are not inherited into previews.

Portfolio entries (`category: "portfolio"`) appear in the homepage gallery. For a product cover, add `product` matching its existing slug, for example `{"file":"land-planner.png","alt":"Land Planner screenshot","category":"product","product":"land-planner"}`. The same image appears in the collection and detail page without cropping. Products without images keep their original cards.

Figma does not automatically sync from GitHub. Use Figma's connected tools to place the reviewed image into an existing Figma node; verify the image hash/render after insertion. Do not persist expiring Figma upload URLs in repository secrets.

This PR provides the versioned image source, manifest, Worker asset serving, gallery/product rendering and regression checks. Real PNG placement and Figma readback are still required before end-to-end verification. It does not provide automatic GitHub-to-Figma sync or production publication.
