# Astro 6 PoC

> One of two parallel implementations of the AJE frontend rebuild PoC. Sister app: [`apps/qwik/`](../qwik/). Shared infra: [`packages/mock-api/`](../../packages/mock-api/), [`packages/perf-harness/`](../../packages/perf-harness/). Top-level: [../../README.md](../../README.md).

## Why Astro

Astro's **island architecture** ships zero JavaScript by default — only interactive components opt in via `client:` directives. For a content-heavy news site, this means most of the page (articles, story cards, layouts) ships as pure HTML with no JS cost. Interactive elements like the breaking ticker, live blog updater, and "Load More" button are Preact islands that hydrate independently.

## Quick Start (from repo root)

```bash
# 1. Start the shared mock API
bun run mock-api

# 2. Install monorepo dependencies (once)
bun install

# 3. Run the Astro dev server
bun run dev:astro

# 4. Build for production (Deno-targeted SSR via @deno/astro-adapter)
bun run build:astro
```

> **Runtime split:** bun manages `package.json` and runs `astro dev`; the production SSR build targets Deno via [`@deno/astro-adapter`](https://github.com/denoland/deno-astro-adapter). See [docs/ARCHITECTURE.md → Runtime & Tooling](./docs/ARCHITECTURE.md#runtime--tooling).

## App-specific JS bundle budgets

| Page          | JS Target          |
| ------------- | ------------------ |
| Homepage      | < 50 KB compressed |
| Article       | < 30 KB compressed |
| Live Blog     | < 60 KB compressed |
| Section Front | < 45 KB compressed |

CWV stretch targets (LCP ≤ 1.5s, CLS ≤ 0.05, INP ≤ 100ms, Lighthouse ≥ 98) are shared across both PoCs — see [top-level README](../../README.md#performance-targets--stretch-goals).

## Key Documents

| Document                                         | Purpose                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)   | Astro-specific architecture — islands, runtime split, CSP, Fonts API, performance budgets |
| [docs/MILESTONES.md](./docs/MILESTONES.md)       | 10 milestones with stretch-CWV acceptance criteria                                        |
| [CLAUDE.md](./CLAUDE.md)                         | Notes for Claude Code working in this app subtree                                         |
| [../../docs/RESEARCH.md](../../docs/RESEARCH.md) | Production GraphQL findings (shared, framework-agnostic)                                  |
