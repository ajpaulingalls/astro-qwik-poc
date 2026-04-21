# Al Jazeera English — Framework Comparison PoC

> **Goal:** Build four representative page types from aljazeera.com in **two parallel implementations** — **Astro 6** with Preact islands and **Qwik 2** with resumability — backed by a shared fixture-based mock API and measured by a shared performance harness, to evaluate both frameworks for a production frontend rebuild.

## Why a monorepo

The two PoCs exist to be compared, not to live in isolation. A monorepo lets us share the things that *must* be identical across both implementations:

- **Mock GraphQL API** — same fixture-based server serving identical data to both apps
- **Production research** — `docs/RESEARCH.md` describes aljazeera.com itself, framework-agnostic
- **Performance harness** — Lighthouse + Playwright runner that measures both apps the same way; the comparison report depends on identical methodology

Each app keeps its framework-specific architecture, milestones, and CLAUDE.md inside its own subtree.

## Structure

```
aje-poc/
├── apps/
│   ├── astro/                       ← Astro 6 + Preact islands implementation
│   │   ├── README.md
│   │   ├── CLAUDE.md
│   │   └── docs/{ARCHITECTURE,MILESTONES}.md
│   └── qwik/                        ← Qwik 2 (beta) implementation
│       ├── README.md
│       ├── CLAUDE.md
│       └── docs/{ARCHITECTURE,MILESTONES}.md
├── packages/
│   ├── mock-api/                    ← Deno 2 mock GraphQL server + recorded fixtures
│   └── perf-harness/                ← Playwright + Lighthouse runner + comparison reporter
├── docs/
│   ├── RESEARCH.md                  ← Framework-agnostic production findings
│   └── COMPARISON.md                ← Final comparison report (M9 output)
├── package.json                     ← bun workspaces
└── deno.json                        ← deno workspace (mock-api)
```

## Quick Start

```bash
# 1. Start the shared mock API (Deno)
bun run mock-api
# or: deno task mock-api

# 2. Install dependencies for all workspaces
bun install

# 3. Run one of the apps
bun run dev:astro       # Astro 6 dev server
bun run dev:qwik        # Qwik 2 dev server

# 4. Run the performance harness (after pages are built)
bun run perf:astro
bun run perf:qwik
```

## Pages in scope

| Page | Route | Key Characteristics |
|------|-------|---------------------|
| **Homepage** | `/` | 3-column layout, 17 featured posts, livestream, vertical videos, most popular, curated collections |
| **Article** | `/news/[...slug]` | Long-form rich content, embeds, related stories |
| **Live Blog** | `/news/liveblog/[...slug]` | 3-query architecture, polling for updates |
| **Section Front** | `/[section]` | Two architectures (geographic vs topic), offset-based "Load More" |

Each page includes the **breaking news ticker** (polled globally) and **hardcoded navigation**.

## Performance targets — stretch goals

Both apps aim to **exceed** the Core Web Vitals "Good" thresholds, not just pass them. Acceptance criteria use the stretch column; a value worse than the floor fails the milestone.

| Metric | "Good" floor | **Stretch (target)** |
|--------|--------------|----------------------|
| LCP | < 2.5s | **≤ 1.5s** |
| CLS | < 0.1 | **≤ 0.05** |
| INP | < 200ms | **≤ 100ms** |
| Lighthouse Performance | ≥ 95 | **≥ 98** |

JavaScript budgets are framework-specific — see each app's `docs/ARCHITECTURE.md`.

## Out of scope

- User authentication, comments, search
- CMS / admin interfaces
- Full Arabic site (same queries with `wp-site: aja` — deferred)
- Production deployment, CDN, ads beyond placeholder slots

## Key documents

| Document | Scope |
|----------|-------|
| [docs/RESEARCH.md](./docs/RESEARCH.md) | Production GraphQL queries, response shapes, navigation/pagination patterns — applies to both apps |
| [apps/astro/docs/ARCHITECTURE.md](./apps/astro/docs/ARCHITECTURE.md) | Astro 6 design — islands, runtime split (bun + Deno), CSP, Fonts API |
| [apps/astro/docs/MILESTONES.md](./apps/astro/docs/MILESTONES.md) | Astro implementation plan |
| [apps/qwik/docs/ARCHITECTURE.md](./apps/qwik/docs/ARCHITECTURE.md) | Qwik 2 design — resumability, lazy handlers |
| [apps/qwik/docs/MILESTONES.md](./apps/qwik/docs/MILESTONES.md) | Qwik implementation plan |
