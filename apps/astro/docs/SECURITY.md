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
