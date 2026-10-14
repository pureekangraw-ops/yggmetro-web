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

Website image URL after deployment: `/assets/shop/<filename>` **only if** the site's hosting build publishes the public directory. Verify the current Worker/static-asset configuration before wiring this URL into customer-facing pages.

Figma does not automatically sync from GitHub. Use Figma's connected tools to place the reviewed image into an existing Figma node; verify the image hash/render after insertion. Do not persist expiring Figma upload URLs in repository secrets.

This PR provides the versioned image source, manifest and CI checks. It does NOT yet provide automatic GitHub-to-Figma sync, public deployment, or payment changes.
