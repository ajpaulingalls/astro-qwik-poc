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

## Looking up Qwik 2 docs

`qwik.dev` does not host `llms.txt` or per-page `.md` versions (verified 2026-04 — all 404). For authoritative source markdown:

```bash
# 1. Index — hand-curated hierarchy of every doc page with source paths
gh api 'repos/QwikDev/qwik/contents/packages/docs/src/routes/docs/menu.md?ref=build/v2' --jq '.content' | base64 -d

# 2. A specific page (note the parenthesized route groups)
gh api 'repos/QwikDev/qwik/contents/packages/docs/src/routes/docs/(qwik)/core/overview/index.mdx?ref=build/v2' --jq '.content' | base64 -d
gh api 'repos/QwikDev/qwik/contents/packages/docs/src/routes/docs/(qwikrouter)/route-loader/index.mdx?ref=build/v2' --jq '.content' | base64 -d
```

Two critical gotchas:

1. **Always pass `?ref=build/v2`** — the `main` branch hosts Qwik 1 docs (`@builder.io/qwik`, `(qwikcity)` route group). Fetching from `main` will give you stale info that imports the wrong package.
2. **Route groups are in the path:** `(qwik)` for core, `(qwikrouter)` for routing (v1 uses `(qwikcity)` — different name). Easy to grab the wrong file.

Useful entry points on `build/v2`:
- `menu.md` — full doc index
- `upgrade/` — v1→v2 migration guide (read this when porting v1 patterns)
- `(qwik)/core/<topic>/index.mdx` — core APIs (component$, useSignal, useTask$, etc.)
- `(qwikrouter)/<topic>/index.mdx` — router APIs (routeLoader$, server$, layouts, etc.)

## Validating documented APIs against beta

The architecture doc lists Qwik 2 platform features (`useSerializer$`, `allowStale`, `passive:`, etc.) that were sourced from release notes / blog posts. Before depending on any of them in code:

1. Confirm the API exists in `@qwik.dev/core@2.0.0-beta.32` (or current latest) — `bun pm ls @qwik.dev/core` then check the package's `dist/` types
2. Cross-check against the v2 source docs (build/v2 branch) above
3. If the API has been renamed or removed, update this CLAUDE.md and the ARCHITECTURE.md immediately
