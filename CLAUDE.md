# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This is a **monorepo containing two parallel PoCs** for the same product: Astro 6 (`apps/astro/`) and Qwik 2 beta (`apps/qwik/`). Both are currently **spec-only** — no source code in either app, no `packages/mock-api/server.ts`, no `packages/perf-harness/` runner. Implementation begins at each app's Milestone 1. Don't grep for components or attempt build/test/lint commands until they exist.

## What's shared vs per-app

The whole point of the monorepo is comparing the two frameworks fairly. Things that must be identical across both apps live at the top level; things that are framework-specific live under `apps/<framework>/`.

| Concern                                                      | Lives in                                                  | Reason                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------- |
| Production API research                                      | `docs/RESEARCH.md`                                        | aljazeera.com behavior is framework-agnostic                   |
| Mock GraphQL server + fixtures                               | `packages/mock-api/`                                      | Both apps must hit the exact same data                         |
| Performance harness (puppeteer-core + Lighthouse + reporter) | `packages/perf-harness/`                                  | Apples-to-apples CWV comparison requires identical methodology |
| Final comparison report                                      | `docs/COMPARISON.md`                                      | M9 output — synthesizes data from both apps                    |
| Per-app architecture, milestones, CLAUDE.md                  | `apps/<framework>/docs/` and `apps/<framework>/CLAUDE.md` | Framework-specific                                             |

When you're working on something, the right doc to read first depends on the question:

- **"How does production aljazeera.com work?"** → `docs/RESEARCH.md`
- **"How is Astro wired together?"** → `apps/astro/docs/ARCHITECTURE.md` + `apps/astro/CLAUDE.md`
- **"How is Qwik wired together?"** → `apps/qwik/docs/ARCHITECTURE.md` + `apps/qwik/CLAUDE.md`
- **"What does success look like for the comparison?"** → `README.md` (stretch CWV targets)

## Locked-in structural decisions

- **Workspace tooling:** bun workspaces (`package.json` `workspaces: ["apps/*", "packages/*"]`) for the Node-side packages; Deno workspace (`deno.json`) covers `packages/mock-api/`.
- **Mock API runtime:** Deno 2 with native `Deno.serve()` — _not_ the deprecated `import { serve } from "deno.land/std/http"`. Port `4455`.
- **Performance harness:** puppeteer-core drives interactions (so INP is captured) by attaching to chrome-launcher's headless Chrome via CDP, Lighthouse runs against the resulting state, results aggregated per page type. (Original spec said Playwright; swapped to puppeteer-core in sprint-003 to avoid the ~300MB bundled-Chromium install — puppeteer-core attaches to the chrome-launcher Chrome we already use for Lighthouse.) `chrome-devtools-mcp` available as a dev-time probe but not part of the CI loop.
- **Astro app:** Astro 6 + Preact + bun for deps and dev + Deno for production SSR via `@deno/astro-adapter` 0.4.0. Details in `apps/astro/CLAUDE.md`.
- **Qwik app:** Qwik 2 beta (`@qwik.dev/core` 2.0.0-beta.x) — _not_ the legacy `@builder.io/qwik` 1.x stable. Details in `apps/qwik/CLAUDE.md`.

## Performance targets — stretch goals

Both apps target the same **stretch CWV thresholds**. Use these as the primary acceptance criteria; the "Good" thresholds are a hard floor below which a milestone fails outright.

| Metric                 | "Good" floor | **Stretch target** |
| ---------------------- | ------------ | ------------------ |
| LCP                    | < 2.5s       | **≤ 1.5s**         |
| CLS                    | < 0.1        | **≤ 0.05**         |
| INP                    | < 200ms      | **≤ 100ms**        |
| Lighthouse Performance | ≥ 95         | **≥ 98**           |

JS bundle budgets differ by framework — see each app's `docs/ARCHITECTURE.md`.

## Non-obvious production API constraints

The mock GraphQL API mirrors production exactly. Critical behaviors to preserve in `packages/mock-api/`:

- **GET only**, never POST
- `wp-site` header **required** on every request (`aje` English, `aja` Arabic) — return 400 if missing
- `variables` param is URL-encoded JSON
- Resolution is by `operationName`, not by query body (production uses a numeric whitelist)
- **Navigation is hardcoded** in each app's frontend — no GraphQL query returns nav data; the `cmsArcSettings` query is never called in production. Do not add a CMS-driven nav abstraction in either app.
- Pagination is **client-side offset-based** (`offset: 0, 9, 18, …`) via "Load More" — no `?page=N` URLs, no infinite scroll

## Looking up framework details

Pick the tool that matches the question. Different question types have different best sources — the npm packages ship runtime code and types but **not** guide docs.

| Question type                                                                               | Best source                                                    | Why                                                                       |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| "What's the signature of X?" / "What options does Y accept?"                                | **Read `node_modules/<pkg>/**/\*.d.ts`** (after `bun install`) | Exact types for the installed version, JSDoc inline, no network, no drift |
| "What's the type of this expression?" / "Where is X defined?"                               | **LSP tool** (`hover` / `goToDefinition`)                      | Faster than reading files; works once an app is scaffolded                |
| "How do I migrate v1→v2?" / "What's the recommended pattern?" / "Why does X work this way?" | **`gh api` the docs source repo**                              | Guides are NOT in the npm packages                                        |
| "What does production aljazeera.com do?"                                                    | `docs/RESEARCH.md`                                             | Already verified, in-repo                                                 |

**Preflight:** the `node_modules/` and LSP options only work after M1 has scaffolded an app and `bun install` has run. Before then, use `gh api` for everything.

### Where types live in node_modules (after install)

| Package               | Type entry points                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `astro`               | `node_modules/astro/dist/index.d.ts` (root) + `dist/types/**/*.d.ts` (deep)                                                                      |
| `@astrojs/preact`     | `node_modules/@astrojs/preact/dist/index.d.ts`                                                                                                   |
| `@deno/astro-adapter` | `node_modules/@deno/astro-adapter/src/index.ts` (TS source — package exports `.ts` directly)                                                     |
| `@qwik.dev/core`      | `node_modules/@qwik.dev/core/public.d.ts` (root) + `dist/**/*.d.ts` (deep) + `server.d.ts`, `testing.d.ts`, `optimizer.d.ts` (entry-point shims) |
| `@qwik.dev/router`    | `node_modules/@qwik.dev/router/**/*.d.ts`                                                                                                        |

JSDoc in these files is the API source of truth — release-notes summaries and blog posts can lag.

### Guide docs (no llms.txt anywhere — verified 2026-04)

Neither `docs.astro.build` nor `qwik.dev` hosts `llms.txt`, `llms-full.txt`, or per-page `.md` URLs (all 404). Fetch from the docs source repos instead:

#### Astro 6

```bash
gh api repos/withastro/docs/contents/src/content/docs/en/<path>.mdx --jq '.content' | base64 -d
```

Pages organized under `src/content/docs/en/`. Useful entry points:

- `guides/upgrade-to/v6.mdx` — v5→v6 migration
- `reference/configuration-reference.mdx` — config schema

#### Qwik 2 (beta)

**Critical:** Qwik 2 docs live on the **`build/v2` branch**, not `main`. The `main` branch still hosts Qwik 1.x docs and uses `@builder.io/qwik`.

```bash
# Index of all v2 doc pages with their source paths
gh api 'repos/QwikDev/qwik/contents/packages/docs/src/routes/docs/menu.md?ref=build/v2' --jq '.content' | base64 -d

# Fetch a specific page (note the parenthesized route groups in the path)
gh api 'repos/QwikDev/qwik/contents/packages/docs/src/routes/docs/(qwik)/core/overview/index.mdx?ref=build/v2' --jq '.content' | base64 -d
gh api 'repos/QwikDev/qwik/contents/packages/docs/src/routes/docs/(qwikrouter)/route-loader/index.mdx?ref=build/v2' --jq '.content' | base64 -d
```

Path quirks for Qwik 2:

- Route groups: **`(qwik)`** for core APIs (`@qwik.dev/core`), **`(qwikrouter)`** for routing (`@qwik.dev/router`). On v1's `main` branch this is `(qwikcity)` instead — easy to grab the wrong one.
- `menu.md` is a hand-maintained hierarchical index — start there to find the right page path
- v1→v2 migration guide: `packages/docs/src/routes/docs/upgrade/` on `build/v2`

## Known doc lint warnings (ignore)

Some markdown tables in READMEs trigger "Table is not correctly formatted" hints from the linter. They render fine — don't reformat to chase these.
