# SECURITY — apps/astro

Security-relevant decisions for the Astro PoC. M9's audit milestone consumes this file as input; new decisions land here as they're made, not as an end-of-story sweep.

## Same-origin proxy for `/wp-content/uploads/*`

### Decision (sprint-007)

The Astro app serves `/wp-content/uploads/*` from its own origin via a same-origin proxy that forwards to the configured API base (mock-api in dev/perf, `aljazeera.com` in M11 demo). Implemented as an Astro page endpoint at `src/pages/wp-content/uploads/[...path].ts` so the Deno SSR adapter handles it under the same runtime as the rest of the site — no bespoke Deno wrapper around `dist/server/entry.mjs`.

### Why a proxy at all

Fixture image URLs come from the WordPress CMS as relative paths (`/wp-content/uploads/2026/04/foo.jpg`). Browsers resolve them against the page origin (Astro :8080), not against the API origin (mock-api :4455). Without a proxy these requests 404 — and the prior fix (a `resolveImageUrl()` helper that rewrites to absolute URLs) only covers components that opt in. Anything emitting a raw relative URL (HTML embeds, future M11 paths, components added later that miss the helper import) still 404s. The acceptance probe added in this sprint (`packages/perf-harness/acceptance.ts`) made the gap loud and fail-fast.

The proxy fixes the gap once for any code path. The `resolveImageUrl()` helper continues to short-circuit known component paths to mock-api directly, but the proxy is the safety net.

### Why a page endpoint, not `vite.server.proxy`

Three runtimes serve traffic: `astro dev` (Vite middleware), `astro preview` (Vite middleware), and `deno run dist/server/entry.mjs` (the production runtime the perf-harness boots). `vite.server.proxy` only covers the first two. A page endpoint at `src/pages/wp-content/uploads/[...path].ts` is part of the SSR bundle — it works in all three under the same code path, and stays inside Astro's idiomatic routing rather than adding a parallel Vite-config concern.

### Security implications

- **No SSRF**: the upstream URL is `${resolveApiBase()}/wp-content/uploads/${params.path}`. The path segment is user-controllable but the host is not — `resolveApiBase()` reads `import.meta.env.PUBLIC_API_BASE` (build-time replacement) with a hardcoded fallback. Operators control the upstream host via env at build time; client requests cannot redirect the proxy to an arbitrary host.
- **No path traversal into mock-api**: mock-api's handler at `packages/mock-api/lib/handler.ts` matches any `/wp-content/uploads/*` path and returns a fixed 1×1 PNG; no filesystem lookup, no traversal vector. M11's switch to `aljazeera.com` upstream relies on the upstream itself rejecting traversal.
- **Header passthrough**: `new Response(response.body, response)` forwards all upstream headers including `Cache-Control`, `ETag`, `Last-Modified` — desirable for M11's CDN caching. Astro/Deno will strip hop-by-hop headers at the response boundary.
- **CSP**: current CSP allows `img-src 'self' https: data: http://localhost:4455` because `resolveImageUrl()` still emits absolute URLs for known components. Once components are migrated to relative URLs and the helper is removed, `http://localhost:4455` can come out of `img-src` (the proxy makes it `'self'`). Recorded as follow-up.

### Deno permission caveat (M11)

`packages/perf-harness/spawn.ts:spawnAstro()` hardcodes `--allow-net=...,localhost:4455`. The proxy's outbound `fetch()` will be denied by Deno's permission system if `PUBLIC_API_BASE` is repointed at `https://www.aljazeera.com` for the M11 demo. Either derive `--allow-net` from `PUBLIC_API_BASE` or document the spawn-config change required for M11. Recorded as a medium-severity concern.

> **M11 follow-up landed.** `packages/perf-harness/spawn.ts:deriveAllowNet` now maps `PUBLIC_API_BASE` to a comma-joined `--allow-net` value at boot — both the perf-harness and `scripts/demo-launch-astro.ts` consume `buildAstroDenoArgv` so the M11 demo and the perf path stay byte-identical. The original concern is resolved.

## M12 Audit

End-of-M11 audit consolidated for M-13 input. All evidence below comes from sprint-012 story-003's n=10 measurement matrix (`packages/perf-harness/reports/`) and the live source-of-truth files cited inline.

### Final CSP directive set (end of M11)

`packages/shared-csp/index.ts:buildAstroCspConfig` is the single source of truth — both `apps/astro/astro.config.mjs` and the M11 demo path import it, so directive drift between the perf path and the production-equivalent demo is structurally impossible. Astro 6 auto-emits per-bundle script + style hashes via the `scriptDirective` field, so inline content is allowed by hash, never `'unsafe-inline'`.

The full directive set as it stands at end-of-M11:

| Directive                                | Origins                                                                                                                                         | Justification                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default-src 'self'`                     | self only                                                                                                                                       | Baseline — every fetch defaults to same-origin unless an explicit override below applies.                                                                                                                                                                                                 |
| `script-src 'self'`                      | self, `platform.twitter.com`, `www.instagram.com`, `players.brightcove.net` (auto-hashed for inline via Astro `scriptDirective`)                | Self plus the three social/video providers whose embed scripts are required to render their respective iframes. YouTube is iframe-only and intentionally excluded from script-src.                                                                                                        |
| `img-src 'self' https: data: ${apiBase}` | self, any HTTPS, inline data URIs, the GraphQL API host                                                                                         | `https:` covers third-party CDN-hosted images referenced from CMS fixtures; `data:` covers inline placeholders; `${apiBase}` is needed because `resolveImageUrl()` still emits absolute mock-api URLs for known components (the same-origin proxy is the safety net for everything else). |
| `font-src 'self' data:`                  | self, inline data URIs                                                                                                                          | Self-hosted fonts via the Astro 6 Fonts API; `data:` covers the API's auto-generated fallback metric `@font-face` rules.                                                                                                                                                                  |
| `connect-src 'self' ${apiBase}`          | self, the GraphQL API host                                                                                                                      | The Apollo/fetch path to the GraphQL endpoint — same-origin proxy is for `/wp-content/uploads/*` only, GraphQL goes direct.                                                                                                                                                               |
| `frame-src`                              | `platform.twitter.com`, `syndication.twitter.com`, `www.instagram.com`, `players.brightcove.net`, `www.youtube.com`, `www.youtube-nocookie.com` | The six iframe origins our embed components emit. Both YouTube variants are listed because the article-shell heuristic chooses `nocookie` when configured.                                                                                                                                |

The directive list is locked at compile time by the `_CspDirectivePrefixIsExact` type-equality check in `packages/shared-csp/index.ts:72-85` — adding or removing a directive without updating `CspDirectivePrefix` breaks `tsc`. This is the gate against silent CSP widening.

**Zero CSP violations observed across the n=10 sweep.** All 5 Astro page types, both Lighthouse audit and the real-browser web-vitals collector. The collector at `packages/perf-harness/web_vitals_collector.ts` attaches a `securitypolicyviolation` listener via `page.evaluateOnNewDocument` BEFORE every navigation; per-run violation arrays land in `reports/astro-${page}.json:cspViolations`. Evidence: the `cspViolations: []` field on every `packages/perf-harness/reports/astro-{index,article,section-geo,section-topic,liveblog}.json`, plus the per-page CSP-violations column in `RUN_NOTES.md` "Measured outcomes" table.

The first n=10 sweep with the collector active surfaced 53 real `style-src-attr ← inline` violations from CMS-rendered `style="..."` attributes on WordPress wp-caption divs and Brightcove embed containers (per-page breakdown in `RUN_NOTES.md` "Honest-failure inventory"). The audit-deliverable fix shipped in this same sprint: `packages/shared-csp/strip-inline-styles.ts` strips inline-style attributes from CMS HTML, and every `dangerouslySetInnerHTML` site in the Astro app routes through `apps/astro/src/lib/safe-inner-html.ts` to make the sanitizer non-skippable. The follow-up sweep returned 0 violations across all 5 pages × n=10 runs, validating the fix and the collector together.

**Collector positive control.** The collector itself is regression-tested at `packages/perf-harness/tests/web_vitals_collector_smoke_test.ts` — a PERF_SMOKE-gated real-Chrome smoke that serves a page with strict `img-src 'self'` CSP plus a deliberately-blocked external image and asserts the violation lands in `cspViolations`. If that smoke test ever goes silent, the "zero violations observed" claim above is unprovable and must be re-validated.

### Fonts API CLS validation

The Astro 6 Fonts API (`apps/astro/astro.config.mjs:25-36`) auto-emits size-adjusted fallback `@font-face` rules at build time — each loaded font ships with a paired fallback declaration carrying `size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override` values calibrated to match the web font's metrics. The browser swaps from system fallback to web font with no observable layout shift.

Sprint-012 story-003 measured CLS = 0 (median and p95) across all 5 Astro page types at n=10 — well under the stretch ceiling of `≤ 0.05`. Per-page numbers live in `packages/perf-harness/reports/RUN_NOTES.md` (Measured outcomes table); single source of truth for the n=10 sweep. The Fonts API approach categorically eliminated the CLS risk that manual `<link rel="preload">` + `font-display: swap` chains produce on news layouts.

### Deno `--allow` audit

`packages/perf-harness/spawn.ts:buildAstroDenoArgv` is the single source of truth for the argv that boots the Deno SSR runtime in both the perf-harness and `scripts/demo-launch-astro.ts` (M11 demo). Final flag set:

| Flag                           | Value                                                                                                                                                                                                     | Purpose                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--allow-net=<derived>`        | `0.0.0.0:8080,${apiBaseHost}:${apiBasePort}` (computed by `deriveAllowNet` at boot)                                                                                                                       | Inbound: bind the Astro listener on the configured app port. Outbound: reach exactly the GraphQL API host the operator pointed `PUBLIC_API_BASE` at — derived from the URL, not hardcoded. M11 production switch (`https://www.aljazeera.com`) requires no spawn-config change; the M11 follow-up above resolves the original M11 concern.                                |
| `--allow-read=apps/astro/dist` | bundle directory only                                                                                                                                                                                     | Read access scoped to the compiled SSR bundle; no source, no config files, no traversal vector into the rest of the repo or filesystem.                                                                                                                                                                                                                                   |
| `--allow-env=<11 vars>`        | `NODE_ENV, NODE_DEBUG, ASTRO_INTERNAL_TEST_DISABLE_CONSOLE_FILTER, CI, NO_COLOR, FORCE_COLOR, TERM, PKG_CONFIG_PATH, SHARP_FORCE_GLOBAL_LIBVIPS, SHARP_IGNORE_GLOBAL_LIBVIPS, npm_package_config_libvips` | Audited whitelist (see `ASTRO_ALLOWED_ENV` at `packages/perf-harness/spawn.ts:57-69` for per-var rationale). Every variable was confirmed referenced by the compiled SSR bundle (`grep -rh 'env\.[A-Za-z_]' apps/astro/dist/server/`). `HOST`/`PORT` are not in the list because the Deno adapter binds at build time via `options.port`/`options.hostname`, not at boot. |

**Why `-A` (allow-all) is rejected.** Deno's permission model is the strongest production-runtime defense in the Astro PoC. `-A` would grant the SSR process unconstrained access to: every network interface (not just the listener and the upstream GraphQL host), the entire filesystem (not just the `dist/` bundle), and every environment variable in the parent process (including any operator-set secrets). The principle of least privilege is the single biggest win Deno offers over the Node/Bun/Vite path — `-A` would surrender it. See `apps/astro/docs/ARCHITECTURE.md:71-74,91` for the originating rationale.
