# Qwik 2 beta friction notes

Live log of beta-specific workarounds, missing features, and divergences from the architecture doc. Updated as items are encountered.

## M3 scaffolding — 2026-04-21

Installed pins: `@qwik.dev/core ~2.0.0-beta.32`, `@qwik.dev/router 2.0.0-beta.32`, `@qwik.dev/optimizer 2.1.0-beta.2` (transitive).

### Divergences from `apps/qwik/docs/ARCHITECTURE.md`

1. **`QwikCityProvider` is deprecated.** `@qwik.dev/router/lib/index.d.ts` marks it `@deprecated Use useQwikRouter() instead. Will be removed in v3.` The architecture doc's `<QwikCityProvider>` wrapper pattern is replaced by calling `useQwikRouter()` inside `component$` — no provider component needed. `src/root.tsx` follows the new pattern.
2. **`qwikCity` vite plugin renamed to `qwikRouter`.** Imported from `@qwik.dev/router/vite`. `qwikCity` remains as a deprecated alias scheduled for v3 removal.
3. **`allowStale` does not exist on `routeLoader$` / `AsyncSignal` in `beta.32`.** The architecture doc references it for breaking-ticker and live-blog polling (M7, M8). Installed types expose `serializationStrategy: 'never' | 'always' | 'auto'` instead — controls *whether* loader data is sent to the client, not *staleness*. Polling in M7/M8 will need manual `setInterval` inside `useVisibleTask$` until `allowStale` lands. Will recheck on subsequent beta bumps.
4. **`passive:` event marker syntax not yet verified.** Not needed for M3; will confirm against installed `.d.ts` when the vertical-video carousel lands in M4.

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
