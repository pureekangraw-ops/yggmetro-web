# PANTHEON routing proposal

Built on Draft PR #52; defaults retain GO Hub. Operational brief/event/budget calls can use the named StorefrontBridge entrypoint after an owner-approved data migration. Payment calls continue to GO Hub, so decommissioning is blocked.

Run `npm ci && npm test`. For the real local workerd integration, clone Pantheon-WorkHub at branch `feat/storefront-brief-ingress-20261017` beside this repository, and clone Go-Together, LIGHT-BOOKMARK and Factory-District under sibling `callers/` at the hashes in the receiver's `docs/infrastructure-20261017/caller-revisions.json`. Run `npm run test:pantheon`. No production credentials required. Results identify local identity fixtures and production limitations.

Full inventory, before/after diagrams, migration/rollback gates, billing limitations and evidence are in the companion receiver PR under `docs/infrastructure-20261017/README.md`. Do not enable BRIEF_REGISTRY_BACKEND=pantheon before old customer identity/data reconciliation, signed-session key provisioning and production acceptance. A flag rollback alone does not migrate records written to PANTHEON back to the old registry. No automatic write fallback is used.
