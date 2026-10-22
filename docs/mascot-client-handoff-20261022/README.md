# GO mascot → GO Client

Depends on PR #66, head df3a5da396bbb6c565a4997b5502b1c6b0ed56ee (and #65).

## Behavior
- Catalog chat remains the local catalog assistant. An explicit button saves a new owned draft with the latest conversation (up to 8 messages / 8,000 characters), last customer question and source path, then opens GO Client.
- Unsent input is included. An independent “open existing request” link resumes previous work instead of creating a new draft.
- Imported context is labelled customer-supplied reference data, visible to customer and Admin, and passed through the existing server AI adapter. It cannot set sender roles, confirm orders or start Factory work.
- Browser session storage retains the exact handoff ID/snapshot on an uncertain response. Creation retries read the owned record without overwriting later edits or submitted work. Destination readback clears the pending transfer. There is no age-based abandonment of uncertain IDs.
- A direct request link is ownership-checked and removed after successful selection, so later selections survive reload. No conversation text appears in URLs.
- No schema migration: the existing brief JSON gains bounded shopContext. Storage/cookie loss remains a recovery boundary; cross-device recovery is not added.

## Verification
- Unit regression: 94/94, including actual SQLite context persistence, server adapter input, and no overwrite after confirmation.
- Handoff browser cases: 6/6 covering 390/1440px, catalog → persisted draft → message → reload, lost creation response, old uncertain transfer, customer isolation, literal untrusted text, Admin context and later-selection reload.
- Existing storefront browser flow: 1440/708/390px PASS; recovery suite 4/4 PASS. Existing journey suite updated only for the new draft versus existing-request entry paths.
- Independent review found three issues (Admin context visibility, stale request URL, uncertain-ID expiry); all fixed and covered by browser cases.
- Screenshot is local fixture evidence. Real OpenAI/provider and deployed Cloudflare acceptance remain unverified. No merge/deployment performed.
