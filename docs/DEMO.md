# DEMO — Astro & Qwik against live aljazeera.com

This guide walks a fresh contributor from `git clone` to both PoC apps
serving content sourced from production aljazeera.com.

For perf-harness comparison runs, see `README.md` — perf still targets
the mock API by design (deterministic fixtures gate the CWV budgets).

## Prerequisites

| Tool     | Min version | Notes                                                                              |
| -------- | ----------- | ---------------------------------------------------------------------------------- |
| **bun**  | 1.3.13      | `packageManager` pinned in `package.json`. Used for installs + dev + Qwik runtime. |
| **deno** | 2.x         | Production SSR runtime for the Astro app via `@deno/astro-adapter`.                |
| **git**  | any         | For clone.                                                                         |

```bash
git clone <this repo> aje-poc && cd aje-poc
bun install
```

## Quick start

Export the live endpoint and invoke either demo script:

```bash
export PUBLIC_API_BASE=https://www.aljazeera.com

# Astro — built with Astro 6, served by Deno on http://localhost:8080
bun run demo:astro

# Qwik — built with Qwik 2 beta, served by bun on http://localhost:4173
bun run demo:qwik
```

Each script chains `build:` (with `PUBLIC_API_BASE` baked into CSP +
the same-origin uploads proxy target) then launches the production
runtime. Open the printed URL — the homepage, sections, and articles
render from live data.

To go back to mock data, unset the env (or set it to
`http://localhost:4455`) and re-run; in mock mode you also need to
boot the mock API in another shell:

```bash
bun run mock-api
```

## Runtime permissions (Astro Deno SSR)

Astro's production runtime under Deno needs explicit `--allow-*`
flags. The launcher at `scripts/demo-launch-astro.ts` derives them at
boot from `PUBLIC_API_BASE`:

- `--allow-net=0.0.0.0:8080,<host>:<port>` — listener + the live
  GraphQL host on its scheme port. The host comes from
  `URL(PUBLIC_API_BASE).hostname`; the port defaults to 443 for
  `https:` and 80 for `http:` if absent. Validation runs through
  `assertSafeApiBase` in `@aje-poc/shared-csp` before the URL parses.
- `--allow-read=apps/astro/dist` — only the built bundle.
- `--allow-env=<audited list>` — see
  `packages/perf-harness/spawn.ts:ASTRO_ALLOWED_ENV` for the JSDoc
  explaining each key (Astro/Vite core, picocolors color detection,
  sharp probe).

Qwik's runtime is plain `bun apps/qwik/server.ts` — no sandboxing
flags; bun reads `PUBLIC_API_BASE` from the parent env directly.

## Known issues

### Article slug rotation

The aljazeera.com homepage rotates featured articles every ~week. If
the article route 404s, refresh the slug from a current homepage link
in the browser. The `/wp-content/uploads/*` proxy and section/liveblog
routes are stable across rotations; only the date-pathed article slugs
are volatile. See `docs/bug-reports/m11-live-endpoint-smoke.md` §F3.

### Liveblog availability

Liveblog routes (`/news/liveblog/<date>/<slug>`) exist only when
aljazeera is actively running a live event. If no current liveblog is
linked from the homepage, the route may 404 — that's a content gap on
the upstream side, not a PoC bug. The mock-api fixtures always include
a liveblog so demos work regardless.

(The Qwik liveblog 404 originally documented in §F1 of the smoke
report is fixed — see commit `2c6882d`. Mock-api strictness on
`postType` was tightened separately so the drift can't recur silently
in CI; see commit `8553029`.)

## CORS

Live aljazeera.com does not need to allow the PoC origin because no
client-side cross-origin fetches exist in either app:

- All GraphQL requests fire from the SSR runtime (Astro Deno / Qwik
  bun `server.ts`). Server-to-server has no preflight or origin
  restriction.
- Image URLs under `/wp-content/uploads/*` route through a same-origin
  proxy in each app (`apps/astro/src/pages/wp-content/uploads/[...path].ts`,
  `apps/qwik/server.ts:tryProxyUploads`); the browser only ever talks
  to `localhost:8080` or `:4173`.

See the smoke report § CORS for the full risk-mitigation context.

## Demo vs perf

The demo and the perf-harness intentionally use different data
sources:

- **Demo** (`bun run demo:*`) — live aljazeera.com, real-world content,
  one operator-driven manual session.
- **Perf** (`bun run perf:*`) — mock API on `localhost:4455` (Astro)
  and `:4456` (Qwik), deterministic fixtures, scripted CWV runs that
  gate sprint budgets. Repeat-run variance from a live endpoint would
  blow the LCP ≤1.5s / INP ≤100ms / LH ≥98 stretch budgets within
  measurement noise.

Don't conflate the two. If you want to verify a perf hypothesis
against live, the live-endpoint acceptance suite (story-005,
`bun --filter aje-poc-* test:acceptance:live`) is the supported
boundary — and it asserts render correctness, not CWV thresholds.
