# mock-api

Shared Deno 2 mock GraphQL server for the AJE PoCs. Mirrors the production aljazeera.com GraphQL interface (GET-only, `wp-site` header required, resolution by `operationName`) and serves recorded fixture JSON.

**Runtime:** Deno 2 (not part of the bun workspace — invoked via `deno task mock-api` from the repo root, or `bun run mock-api`).

**Port:** `4455` (override with `PORT` env var).

## Status

Not implemented yet. Scaffolding lands in **M1** of either app — see `apps/astro/docs/MILESTONES.md` or `apps/qwik/docs/MILESTONES.md`. Both apps' `ARCHITECTURE.md` files describe the expected server behavior and fixture layout.
