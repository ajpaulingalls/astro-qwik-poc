# CLAUDE.md — apps/qwik

This file is scoped to the **Qwik 2 (beta) PoC**. For monorepo-wide guidance (shared mock API, shared perf harness, production API constraints, etc.), see [../../CLAUDE.md](../../CLAUDE.md).

## App state

Spec-only. No `src/`, no `vite.config.ts`, no `package.json` deps installed. Implementation begins at M1 (`docs/MILESTONES.md`). Don't grep for components yet.

## Qwik-specific decisions

Codified in `docs/ARCHITECTURE.md` — don't relitigate without explicit user input:

- **Framework:** Qwik **2 beta** (`@qwik.dev/core` 2.0.0-beta.32). **Not** the legacy `@builder.io/qwik` 1.x. Stable Qwik 2 release date is unannounced; we're on the `latest` tag of the new `@qwik.dev/*` scope.
- **Routing:** `@qwik.dev/router` (renamed from `@builder.io/qwik-city`)
- **Package manager + dev runtime:** **bun** (`bun install`, `bun run dev:qwik` from repo root)
- **Styling:** Tailwind CSS 4 — fonts via standard Vite asset pipeline (Qwik 2 has no built-in Fonts API equivalent to Astro's; use `<link rel="preload">` + `font-display: swap` + `size-adjust` for CLS)

## Qwik 2 platform features in use

| Feature | Where used |
|---------|-----------|
| `@qwik.dev/core` / `@qwik.dev/router` (renamed scope) | All imports |
| `useSerializer$` | Loaders no longer serialize to client by default in v2; opt in here |
| `allowStale` on `routeLoader$` / `AsyncSignal` | Breaking ticker, live blog polling — alternative to manual `setInterval` |
| `passive:` event markers | Vertical video carousel scroll/touch |
| Build-time HTML validation | `ArticleBody.tsx` rich-text rendering |

## Beta caveats

This PoC runs on a beta release. Track real-world friction in **`docs/QWIK2_NOTES.md`** as you encounter it — plugin incompatibilities, missing types, unexpected behavior, workarounds. M9 audits this file; M10's comparison report uses it as input for the production-readiness assessment.

Don't pretend things are stable when they aren't. If a beta-specific bug forces a workaround, document it; if a feature documented in release notes doesn't actually exist yet in beta.32, flag it.

## Looking up Qwik 2 specifics

Pick the source that matches the question (top-level `../../CLAUDE.md` has the full table):

### Type signatures / API shape — after `bun install`

For a beta package this is **especially important** — the runtime types are the only source guaranteed to match the installed version. Prefer reading installed `.d.ts` files over network calls:

```
node_modules/@qwik.dev/core/public.d.ts              ← top-level type re-export (start here)
node_modules/@qwik.dev/core/server.d.ts              ← SSR APIs
node_modules/@qwik.dev/core/optimizer.d.ts           ← compiler / build-time APIs
node_modules/@qwik.dev/core/testing.d.ts             ← test utilities
node_modules/@qwik.dev/core/dist/                    ← deeper types + JSDoc
node_modules/@qwik.dev/router/                       ← routeLoader$, server$, layouts, etc.
```

JSDoc in these files is the API source of truth. **For every Qwik 2 platform feature listed in `docs/ARCHITECTURE.md` (`useSerializer$`, `allowStale`, `passive:` event markers, etc.), confirm it exists in the installed version's `.d.ts` before writing code that depends on it.** Release-notes summaries and blog posts can describe features that haven't actually shipped in beta.32 yet.

### Hover / goto-def — once an app file exists

Use the `LSP` tool (`hover`, `goToDefinition`) on any TypeScript symbol. Especially useful for confirming whether a JSX prop signature accepts a beta-only modifier (`passive:onTouchstart$`, etc.).

### Conceptual / migration docs — `gh api` against `build/v2` branch

Guides aren't shipped in the npm package. Two critical gotchas:

1. **Always pass `?ref=build/v2`** — the `main` branch hosts Qwik 1 docs (`@builder.io/qwik`, `(qwikcity)` route group). Fetching from `main` gives you stale info that imports the wrong package.
2. **Route groups are in the path:** `(qwik)` for core, `(qwikrouter)` for routing (v1 uses `(qwikcity)` — different name). Easy to grab the wrong file.

```bash
# 1. Index — hand-curated hierarchy of every doc page with source paths
gh api 'repos/QwikDev/qwik/contents/packages/docs/src/routes/docs/menu.md?ref=build/v2' --jq '.content' | base64 -d

# 2. A specific page
gh api 'repos/QwikDev/qwik/contents/packages/docs/src/routes/docs/(qwik)/core/overview/index.mdx?ref=build/v2' --jq '.content' | base64 -d
gh api 'repos/QwikDev/qwik/contents/packages/docs/src/routes/docs/(qwikrouter)/route-loader/index.mdx?ref=build/v2' --jq '.content' | base64 -d
```

Useful entry points on `build/v2`:
- `menu.md` — full doc index
- `upgrade/` — v1→v2 migration guide (read this when porting v1 patterns)
- `(qwik)/core/<topic>/index.mdx` — core APIs (component$, useSignal, useTask$, etc.)
- `(qwikrouter)/<topic>/index.mdx` — router APIs (routeLoader$, server$, layouts, etc.)

### Preflight

`node_modules/` and LSP only work after M1 has scaffolded the app and `bun install` has run. Before then, only `gh api` is available — and even then, on `build/v2` only.
