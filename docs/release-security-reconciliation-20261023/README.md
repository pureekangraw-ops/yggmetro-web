# PR70 / PR71 workflow reconciliation — 2026-10-23 (Asia/Bangkok)

This change is stacked on PR71 commit `21f3a84a54dd9952a551a2ad57df1bb5c6ce8c82`. It adapts PR70's existing workflow and security tests from `b7f02dc6e881023d7991f173a00d09569e936246`; no replacement deployment system is introduced. Main remains `6e24fb3fe8453fe269b853848c002fba394affd9` at inspection.

| Source | Release freeze | Deploy credentials |
| --- | --- | --- |
| main | No guard; push/main and dispatch can deploy | Job-wide, including install/tests |
| PR70 | No release guard | Step-scoped; credential-free safety/build; checksummed prebuild and no-bundle upload |
| PR71 | Unconditional release guard | Existing job-wide scope |
| This integration | Preserves PR71 guard, gates deploy on both release-integrity and safety | Preserves PR70 isolation/checksums/no-bundle/public smoke contract |

## Behavior and preservation

`deploy.needs: [release-integrity, safety]` requires both jobs to succeed. The unchanged real guard unconditionally fails, so deploy is skipped for both main push and workflow_dispatch. No override, release input, continue-on-error or always condition is introduced. The guard runs again at the start of the credential-free prebuild step, before Wrangler. The original second guard was moved out of the credential-bearing upload step; the dependency gate still blocks the entire deploy job.

Safety runs without credentials. Install/build receive none. Only the existing upload and account-subdomain lookup steps receive Cloudflare credentials; public smoke receives the resolved origin. PR70's exact checksum, no-bundle and public smoke commands remain intact. Its policy tests are adapted to the combined graph, not removed or weakened. The positive upload harness uses a synthetic successful guard and stub Wrangler solely to exercise the otherwise unreachable credential/checksum contract; a separate test executes the real frozen guard and proves zero Wrangler calls.

No application, assets, package/lockfile, Wrangler configuration, release lock, guard implementation or Sites19 evidence changes. Git object identities are recorded in receipt.json. This preserves PR71's responsive candidate and its baseline provenance; it does not claim this candidate is byte-equal to the live baseline or reverify current production.

## Verification

- Targeted guard/security tests: 54/54 (targeted.log).
- Entire unit/regression suite: 172/172 (regression.log), Node 24.19.0.
- Combined security policy rejects each unreconciled main, PR70 and PR71 workflow; restores candidate afterwards.
- Independent PyYAML parse checks the dependency array and absence of workflow/job-level credentials.
- Real credential-free Wrangler 4.151.1 prebuild and no-bundle dry-run: entry bytes equal; 86 assets and ASSETS/REQUESTS_DB bindings retained. Syntax checks and git diff --check pass.
- Reproduction: `npm ci --no-audit --no-fund`; `npm test`; `node --test tests/deploy-workflow-security.test.cjs tests/shop-release-guard.test.cjs`.
- Build-only reproduction: `./node_modules/.bin/wrangler deploy --dry-run --outdir .deploy-build`, then `./node_modules/.bin/wrangler deploy .deploy-build/index.js --no-bundle --dry-run --outdir .deploy-verify`; compare index.js. These are local dry-runs, not the frozen npm deployment route. Use project-local output: an initial /tmp output probe could not discover project config on the second invocation; project-local paths matching the workflow succeeded.
- GitHub Node22 Safety and browser results must be read against the new PR head; this document records local evidence only. PR workflows are unchanged and will exercise the combined tests normally; the intentionally failing release gate belongs to deploy.yml, not PR CI.

## Release boundary and integration order

This is a reviewable integration PR targeting PR71's branch. Neither PR70 nor PR71 was merged or altered. Do not independently overwrite deploy.yml with either older workflow. If approved later, incorporate this integration into PR71 and reconcile PR70's remaining history deliberately; do not blindly apply its old exact-shape tests afterwards. PR42's broader overlapping changes still require separate review.

**Main is still unprotected by this branch.** Release Freeze remains in effect, but no repository settings or live workflow were changed. Do not push to main or manually dispatch deploy.yml. No merge, production deployment, unlock, credentials change, live smoke request or live deployment comparison was performed. Future release requires separate owner authorization and the fresh active deployment/full-traffic comparison already specified by PR71; its comparator remains inactive.
