# YGGMETRO Web

Official public website runtime for YGGMETRO.

## Routes

- `GET /` — public YGGMETRO landing page
- `GET /health` — deployment health and GO Client route readback
- `GET /client` — GO Client public app migrated from `pureekangraw-ops/ygph-metropolis`
- `POST /client/api/v1/interpret` — GO Client intent and manager interpretation API

## Runtime

Cloudflare Worker: `yggmetro-web`

The GO Client frontend is served from `public/client/`; its API stays on the same origin. AI interpretation requires the `OPENAI_API_KEY` Worker secret and the rate-limit binding declared in `wrangler.jsonc`.

This migration preserves `ygph-metropolis` as the source until the new route is verified and accepted; source deletion is intentionally not part of this first move.
