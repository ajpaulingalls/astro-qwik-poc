# Qwik 2 (beta) PoC

> One of two parallel implementations of the AJE frontend rebuild PoC. Sister app: [`apps/astro/`](../astro/). Shared infra: [`packages/mock-api/`](../../packages/mock-api/), [`packages/perf-harness/`](../../packages/perf-harness/). Top-level: [../../README.md](../../README.md).

> **Beta caveat:** uses `@qwik.dev/core` 2.0.0-beta.32 (April 2026), not the legacy `@builder.io/qwik` 1.x. Stable Qwik 2 release date is unannounced. Expect some rough edges in tooling and plugin compatibility — track them in `docs/QWIK2_NOTES.md` as you encounter them.

## Why Qwik

Qwik's **resumability model** eliminates hydration entirely — the server renders HTML and serializes component state, and the client resumes exactly where the server left off without re-executing initialization code. For a content-heavy news site, this means near-zero initial JavaScript regardless of page complexity. Interactive handlers are lazy-loaded only when the user interacts.

## Quick Start (from repo root)

```bash
# 1. Start the shared mock API
bun run mock-api

# 2. Install monorepo dependencies (once)
bun install

# 3. Run the Qwik dev server
bun run dev:qwik

# 4. Build for production
bun run build:qwik
```

## App-specific JS bundle budgets

Qwik's resumability model means initial JS is near-zero regardless of page complexity:

| Page          | JS Target          |
| ------------- | ------------------ |
| Homepage      | < 15 KB compressed |
| Article       | < 10 KB compressed |
| Live Blog     | < 20 KB compressed |
| Section Front | < 15 KB compressed |

CWV stretch targets (LCP ≤ 1.5s, CLS ≤ 0.05, INP ≤ 100ms, Lighthouse ≥ 98) are shared across both PoCs — see [top-level README](../../README.md#performance-targets--stretch-goals).

## Key Documents

| Document                                         | Purpose                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)   | Qwik-specific architecture — resumability, lazy handlers, Qwik 2 platform features |
| [docs/MILESTONES.md](./docs/MILESTONES.md)       | 10 milestones with stretch-CWV acceptance criteria                                 |
| [CLAUDE.md](./CLAUDE.md)                         | Notes for Claude Code working in this app subtree                                  |
| [../../docs/RESEARCH.md](../../docs/RESEARCH.md) | Production GraphQL findings (shared, framework-agnostic)                           |
