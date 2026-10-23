# Sandbox platform read contract

The sandbox-only entry module `src/sandbox/index.js` exports `ShopCommerceRead`.
`shopOrdersRead({cursor?})` reuses the Office canonical projection and pagination.
It requires sandbox + explicit test configuration, returns only approved commerce
fields and pagination metadata, and excludes live orders. A named Cloudflare
service binding supplies authority. HTTP fetch on this entrypoint returns 404;
public Office authentication and existing admin workflows remain unchanged.
The root production entry module does not export this capability.

No AI account, caller-name/header authorization, copied credential, database
migration, financial operation or new transaction is introduced. PANTHEON's
isolated `ShopSandboxBridge.shop_orders_read` consumes this capability and filters
responses again. Existing production platform callers are not changed.

Hosted team acceptance is separate from deploying these modules: current platform
callers point to production PANTHEON. The isolated staging Worker has no existing
authentication/bindings. An approved platform caller addition is required, without
repointing existing task/Drive/Factory bindings or bypassing the denied sandbox
public host. No hosted readback is claimed by these source or local RPC tests.

Rollback reference before any approved sandbox upload: active/latest
477d4fa5-fae8-4031-9c20-241f8580702b, deployment
03c4cf32-4106-4b4c-8d01-40d8e07bf146 at 100%. Preserve all nine existing bindings,
compatibility 2026-10-01, flags [], observability, tags, placement, logpush, tails
and routing. Only reviewed public ASSETS and candidate code may be added.
