# Qwik 2 beta friction notes

Live log of beta-specific workarounds, missing features, and divergences from the architecture doc. Updated as items are encountered.

## M3 scaffolding — 2026-04-21

Installed pins: `@qwik.dev/core ~2.0.0-beta.32`, `@qwik.dev/router 2.0.0-beta.32`, `@qwik.dev/optimizer 2.1.0-beta.2` (transitive).

### Divergences from `apps/qwik/docs/ARCHITECTURE.md`

1. **`QwikCityProvider` is deprecated.** `@qwik.dev/router/lib/index.d.ts` marks it `@deprecated Use useQwikRouter() instead. Will be removed in v3.` The architecture doc's `<QwikCityProvider>` wrapper pattern is replaced by calling `useQwikRouter()` inside `component$` — no provider component needed. `src/root.tsx` follows the new pattern.
2. **`qwikCity` vite plugin renamed to `qwikRouter`.** Imported from `@qwik.dev/router/vite`. `qwikCity` remains as a deprecated alias scheduled for v3 removal.
3. **`allowStale` does not exist on `routeLoader$` / `AsyncSignal` in `beta.32`.** The architecture doc references it for breaking-ticker and live-blog polling (M7, M8). Installed types expose `serializationStrategy: 'never' | 'always' | 'auto'` instead — controls _whether_ loader data is sent to the client, not _staleness_. Polling in M7/M8 will need manual `setInterval` inside `useVisibleTask$` until `allowStale` lands. Will recheck on subsequent beta bumps.
4. **`passive:` event marker syntax not yet verified.** Not needed for M3; will confirm against installed `.d.ts` when the vertical-video carousel lands in M4.
5. **`src/entry.preview.tsx` was missing from the M3 scaffold.** Standard Qwik 2 starter ships it (`createQwikRouter({ render })` from `@qwik.dev/router/middleware/node`), and `vite preview` requires `server/entry.preview` to start. Added in sprint-003 to unblock Qwik perf-harness smoke testing. Build script extended: `vite build --ssr ./src/entry.preview.tsx` (3rd `&&`-chained build).
6. **web-vitals shim load mechanism: `useVisibleTask$` with dynamic import.** Picked over `useOnDocument('qinit', ...)` for two reasons: (a) the inline `import('../lib/web-vitals')` keeps the web-vitals npm package out of the SSR bundle (verified via `bun run build:qwik` — no `web-vitals` chunks in `server/`), and (b) `useVisibleTask$` runs once on visibility, matching when web-vitals starts measuring LCP. eslint-plugin-qwik's `no-use-visible-task` rule fires by default; suppressed locally with rationale (perf-instrumentation is the canonical legitimate use of the hook).

### APIs confirmed present in `beta.32`

- `component$`, `useSignal`, `useVisibleTask$`, `useTask$`, `Slot`, `useSerializer$`, `createSerializer$`, `AsyncSignal`, `isServer`, `isBrowser` (`@qwik.dev/core/public.d.ts`)
- `routeLoader$`, `RouterOutlet`, `useQwikRouter`, `useLocation`, `DocumentHeadTags`, `createRenderer`, `Form`, `globalAction$`, `Link`, `ErrorBoundary` (`@qwik.dev/router/lib/index.d.ts`)
- `qwikVite` (`@qwik.dev/core/optimizer`), `qwikRouter` (`@qwik.dev/router/vite`)

### Tooling

- **Tailwind 4** has no `tailwind.config.ts`. Configured via `@tailwindcss/vite` plugin + `src/styles/global.css` containing `@import "tailwindcss";`. Future tokens live in `@theme` blocks in CSS, not a TS config.
- `vitest 4.1.5` creates a `dummy-non-existing-folder/package.json` sentinel in the cwd at startup (used internally for module-resolution probing). Gitignored under `apps/qwik/.gitignore`.

### Vite version pin — **beta blocker**

- **Pinned `vite` to `^7.3.2`.** Vite 8 (current `latest`) ships rolldown as its bundler. With rolldown, the `vite-plugin-qwik-router-server-fns` SSR pass blows up at module collection: `TypeError: Cannot read properties of undefined (reading 'concat')` (`@qwik.dev/router/lib/vite/index.mjs` `collectServerFnModuleIds`, line ~2045). The rolldown `ModuleInfo` shape doesn't expose `importedIdResolutions` / `dynamicallyImportedIdResolutions` the way rollup does. Vite 7 (rollup-based) builds cleanly. Recheck on subsequent beta bumps.
- **Build script entry path needs the `./` prefix.** `vite build --ssr src/entry.ssr.tsx` is rejected by the Qwik optimizer plugin (`Qwik input "src/entry.ssr.tsx" not found.`) — its `validateSource` calls `this.resolve()` on the raw arg, and bare `src/...` doesn't resolve as a module specifier. `vite build --ssr ./src/entry.ssr.tsx` works.

### Build / dev checks (M3 acceptance)

- `bun install` from the worktree root resolves cleanly with no `@builder.io/qwik` 1.x in `bun.lock`.
- `bun run dev:qwik` starts the dev server on `:5173` and the placeholder route logs `HomePageQuery` data with `homepage.layout === "three-column"` server-side (verified against `packages/mock-api/fixtures/HomePageQuery.json`).
- `bun run build:qwik` produces a `dist/` client bundle (~109 KB largest chunk, gzip ~41 KB) and a `server/entry.ssr.js` SSR bundle (~183 KB) with no errors. Both are local artifacts; `apps/qwik/.gitignore` excludes `server/`.

### Production-equivalent perf-harness path (sprint-004 story-003)

The shared perf-harness (`packages/perf-harness/runner.ts`) initially spawned the Qwik target via `bun run preview` (vite preview), while it spawns Astro via `deno run dist/server/entry.mjs` directly. This methodology asymmetry made cross-framework CWV comparisons dishonest — vite preview's middleware adds layers Astro doesn't have, and bundles are served differently.

**Decision:** spawn Qwik via `node apps/qwik/server.ts` — a hand-rolled Node http wrapper around `server/entry.preview.js`. This matches Astro's "raw runtime spawning the bundled handler" approach.

**Why a wrapper is required.** `apps/qwik/server/entry.preview.js` is one line:

```
import{e as f}from"./build/q-BrI8OpZO.js";export{f as default};
```

The default export is a `QwikRouterNodeMiddleware` object (`router`, `notFound`, `staticFile` handlers per `@qwik.dev/router/middleware/node.d.ts`) — _not_ a listening http server. Spawning the file with `node` directly exits immediately. The wrapper composes:

1. A `node:http` `createServer` listening on `HOST`/`PORT` env (default `127.0.0.1:4173`).
2. Inline static-file serving from `apps/qwik/dist/{build,assets}` — the middleware's bundled `staticFile` defaults to `/dist` relative to a build-time project root that doesn't resolve under raw Node (chunks 500'd before the inline serving was added).
3. Fall-through to `middleware.router(req, res, next)` for SSR routes.
4. Guard `res.end()` on `writableEnded` — Qwik's router writes its own 500 page on internal errors then calls `next(err)` afterward; double-write to a closed response is the `ERR_STREAM_WRITE_AFTER_END` that surfaced in the first wrapper iteration.

**Methodology delta.** Smoke run (n=2 vs sprint-003's vite-preview baseline):

| metric  | vite preview | node prod |            delta |
| ------- | -----------: | --------: | ---------------: |
| LCP     |      1670 ms |   2108 ms | +438 ms (slower) |
| CLS     |            0 |         0 |        unchanged |
| LH Perf |           99 |        98 |               -1 |
| jsBytes |       60 927 |   143 765 |  +82 838 (~2.4×) |

The jsBytes near-tripling is the most informative number. Vite preview was apparently undercounting transferred-script bytes (likely via dev-mode transforms or compression Lighthouse measured differently than the raw Node static-file path). The Node prod numbers are honest production-equivalent measurements; subsequent story-002+ perf gates and the M13 comparison report will use these as the Qwik baseline.

**Why Node and not Deno.** Qwik 2 beta.32 _does_ ship `@qwik.dev/router/middleware/deno` (verified at `node_modules/.bun/@qwik.dev+router@2.0.0-beta.32+*/node_modules/@qwik.dev/router/lib/middleware/deno/`) — earlier draft of this section claimed no Deno middleware existed; that was wrong. The honest reasons this wrapper uses Node:

1. The bundled `staticFile` `static.root` resolution bug (above) would almost certainly recur for the Deno middleware too — would need to split `entry.preview.tsx` per runtime to test the hypothesis, and there's no upstream Qwik fix yet.
2. The Deno middleware is `Request → Response` (Web standard), not the Node `(req, res, next)` model. Reusing the same hand-rolled static handler under Deno means rewriting `tryServeStatic` for the new I/O model.
3. Node `node:http` + `--experimental-strip-types` was the smaller lift; methodology parity with Astro's "raw runtime hosting the bundled handler" is preserved either way.

Pivoting to Deno once the upstream `static.root` bug is fixed (and once an M11 demo concern justifies the rewrite) is a defensible follow-up.

**`preview:prod` script** added to `apps/qwik/package.json` so manual smoke testing matches what perf-harness does. `bun run preview` (vite-served) stays available for quick dev probing.
