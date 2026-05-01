# Al Jazeera English — Framework Comparison PoC

> **Goal:** Build four representative page types from aljazeera.com in **two parallel implementations** — **Astro 6** with Preact islands and **Qwik 2** with resumability — backed by a shared fixture-based mock API and measured by a shared performance harness, to evaluate both frameworks for a production frontend rebuild.
>
> **Status — complete.** All 13 milestones delivered; both apps shipped against the same shared mock API, the same stretch CWV bars, and the same n=10 perf-harness sweep. Headline result: **Astro 6 is production-ready today; Qwik 2 is conditional on Qwik 2 stable shipping.** Full report and citations live in [`docs/COMPARISON.md`](./docs/COMPARISON.md).

## Why a monorepo

The two PoCs exist to be compared, not to live in isolation. A monorepo lets us share the things that _must_ be identical across both implementations:

- **Mock GraphQL API** — same fixture-based server serving identical data to both apps
- **Production research** — `docs/RESEARCH.md` describes aljazeera.com itself, framework-agnostic
- **Performance harness** — Lighthouse + puppeteer-core runner that measures both apps the same way; the comparison report depends on identical methodology

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
│   └── perf-harness/                ← puppeteer-core + Lighthouse runner + comparison reporter
├── docs/
│   ├── RESEARCH.md                  ← Framework-agnostic production findings
│   └── COMPARISON.md                ← Final comparison report (M-13 capstone)
├── package.json                     ← bun workspaces
└── deno.json                        ← deno workspace (mock-api)
```

## Try it locally

### Prerequisites

| Tool     | Min version | Notes                                                                                               |
| -------- | ----------- | --------------------------------------------------------------------------------------------------- |
| **bun**  | 1.3.13      | `packageManager` pinned in `package.json`. Used for installs + dev + Qwik runtime.                  |
| **deno** | 2.x         | Production SSR runtime for the Astro app via `@deno/astro-adapter`; also runs the mock GraphQL API. |
| **git**  | any         | For clone.                                                                                          |

```bash
git clone <this repo> aje-poc && cd aje-poc
bun install
```

### Dev (mock data, hot-reload)

In two shells:

```bash
# shell 1 — start the shared mock GraphQL server (Deno, http://localhost:4455)
bun run mock-api

# shell 2 — run one of the apps
bun run dev:astro       # Astro 6 dev server (http://localhost:4321)
bun run dev:qwik        # Qwik 2 dev server  (http://localhost:5173)
```

Both apps default `PUBLIC_API_BASE` to the local mock; no env config needed for dev.

### Demo against production aljazeera.com

```bash
export PUBLIC_API_BASE=https://www.aljazeera.com

# Astro — built with Astro 6, served by Deno on http://localhost:8080
bun run demo:astro

# Qwik — built with Qwik 2 beta, served by bun on http://localhost:4173
bun run demo:qwik
```

Each demo script chains `build:` (with `PUBLIC_API_BASE` baked into CSP + the same-origin uploads proxy) then launches the production runtime. The Astro demo derives Deno `--allow-net` from `PUBLIC_API_BASE` and audits all 11 env vars at boot — see [`docs/DEMO.md`](./docs/DEMO.md) for the full sandboxing model + known-issues list (article slug rotation, liveblog availability).

### Tests + lint + typecheck

```bash
bun run --cwd apps/astro test     # Astro: vitest + happy-dom + @testing-library/preact
bun run --cwd apps/qwik test      # Qwik:  vitest + @qwik.dev/core/testing + custom getByHeading helper
bun run typecheck                 # All apps + packages
bun run lint                      # ESLint
bun run format:check              # Prettier (use `format` to write)
```

### Performance harness (n=10 sweep, mock data)

```bash
bun run perf:astro                # build + spawn Astro under Deno + run Lighthouse on :4455 mock
bun run perf:qwik                 # build + spawn Qwik under bun + run Lighthouse on :4456 mock
bun run perf:e2e-csp              # builds both, runs the CSP-zero pipeline gate
```

Reports land in `packages/perf-harness/reports/{astro,qwik}-{page}.json` plus an aggregated `RUN_NOTES.md`. The harness is the methodology used for the §1 numbers in [`docs/COMPARISON.md`](./docs/COMPARISON.md).

### Doc acceptance scripts

```bash
bash scripts/check-comparison-denylist.sh    # editorial vocabulary + per-section heading-format guard
bash scripts/check-comparison-citations.sh   # §1 pipe-rows must cite an accepted basename
```

Both scripts gate `docs/COMPARISON.md` against the M-13 "measured data, no opinions" constraint. Re-run after any edit.

## Pages in scope

| Page              | Route                      | Key Characteristics                                                                                |
| ----------------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| **Homepage**      | `/`                        | 3-column layout, 17 featured posts, livestream, vertical videos, most popular, curated collections |
| **Article**       | `/news/[...slug]`          | Long-form rich content, embeds, related stories                                                    |
| **Live Blog**     | `/news/liveblog/[...slug]` | 3-query architecture, polling for updates                                                          |
| **Section Front** | `/[section]`               | Two architectures (geographic vs topic), offset-based "Load More"                                  |

Each page includes the **breaking news ticker** (polled globally) and **hardcoded navigation**.

## Performance targets — stretch goals

Both apps aim to **exceed** the Core Web Vitals "Good" thresholds, not just pass them. Acceptance criteria use the stretch column; a value worse than the floor fails the milestone.

| Metric                 | "Good" floor | **Stretch (target)** |
| ---------------------- | ------------ | -------------------- |
| LCP                    | < 2.5s       | **≤ 1.5s**           |
| CLS                    | < 0.1        | **≤ 0.05**           |
| INP                    | < 200ms      | **≤ 100ms**          |
| Lighthouse Performance | ≥ 95         | **≥ 98**             |

JavaScript budgets are framework-specific — see each app's `docs/ARCHITECTURE.md`.

## Results

Measured against the four production page types via the n=10 perf-harness sweep (M-12 final validation). Full per-page numbers, methodology, and citations in [`docs/COMPARISON.md`](./docs/COMPARISON.md) §1; verdict synthesis in §8.

| Metric (median, n=10)  | Astro 6                | Qwik 2 beta.32        | Stretch bar                                        |
| ---------------------- | ---------------------- | --------------------- | -------------------------------------------------- |
| Lighthouse Performance | 100 across all 5 pages | 83-93 (range)         | ≥ 98 — Astro PASS, Qwik HONEST-FAILURE w/ 80 floor |
| CLS                    | 0                      | 0                     | ≤ 0.05 — both PASS                                 |
| LCP (real-browser)     | 46-76 ms               | 48-100 ms             | ≤ 1500 ms — both clear by ~20×                     |
| INP (real-browser)     | 16 ms                  | 16 ms                 | ≤ 100 ms — both clear by ≥ 6×                      |
| CSP violations         | 0 (auto-hash)          | 0 (`'unsafe-inline'`) | 0 — both PASS via different mechanisms             |
| JS bundle (homepage)   | 13,917 B               | 176,237 B             | per-app budget — both PASS                         |

**The headline Qwik finding** is the framework-floor cost: beta.32 ships ~136 KB of irreducible runtime before any app symbol — the `core` chunk alone is 101,968 B vs Qwik 1 stable's 54,680 B (+86%). This is upstream, not app-architecture: the leaf-component refactor recovered only −558 B / −4 chunks across four conversions. The cost is unavoidable until Qwik 2 stable's size-optimization pass lands. Full deep-dive in [`docs/COMPARISON.md`](./docs/COMPARISON.md) §5.

**The headline Astro finding** is that the platform features carried their weight: the Fonts API delivered CLS = 0 with no manual fallback wiring, the Vite Env API kept `PUBLIC_API_BASE` consistent across SSR + CSP + Vite-substituted client islands, and the `scriptDirective` / `styleDirective` auto-hash gave zero CSP violations without `'unsafe-inline'`. Deep-dive in §4.

### Verdicts (from `docs/COMPARISON.md` §8)

- **Choose Astro 6** if you need a production-ready stable framework today. It cleared every stretch CWV bar without per-target relaxation. Deployment cost: any new env var or filesystem read needs to be added to the audited Deno `--allow-env` / `--allow-read` list, or it's denied at boot. Demonstrated on the four page types this PoC implemented.
- **Choose Qwik 2** if your team is willing to wait for Qwik 2 stable and re-measure against the §5.5 "Re-evaluate" rows (Vite 7 pin, `allowStale`, `useVisibleTask$` test ergonomics, framework-floor regression, LH-Perf 80 floor). The §5.5 "Likely persist" rows (CSP `'unsafe-inline'`, leaf-component convention) remain inputs to the verdict regardless of stable-ship status. PoC-validated, not production-recommended without that re-measurement.

### What's still open

- Page types beyond the four measured (search, tag, archive)
- Production-load benchmarking (the harness measures n=10 single-page runs, not concurrent traffic)
- Real-world RUM against actual production audience — the next-highest-leverage measurement before any further code-level optimization
- Editorial workflow integration (both apps consume the GraphQL API; neither writes to it)
- Qwik 2 stable re-measurement (per §5.5 — the gate for moving the Qwik verdict past PoC-validated)

## Out of scope

- User authentication, comments, search
- CMS / admin interfaces
- Full Arabic site (same queries with `wp-site: aja` — deferred)
- Production deployment, CDN, ads beyond placeholder slots

## Key documents

| Document                                                             | Scope                                                                                                                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [docs/COMPARISON.md](./docs/COMPARISON.md)                           | **Final comparison report (M-13 capstone).** §1 perf data, §2 DX, §3 architecture, §4 Astro platform, §5 Qwik beta deep-dive, §6 ecosystem, §7 production-readiness, §8 verdicts. Every numeric claim cited. |
| [docs/RESEARCH.md](./docs/RESEARCH.md)                               | Production GraphQL queries, response shapes, navigation/pagination patterns — applies to both apps                                                                                                           |
| [docs/DEMO.md](./docs/DEMO.md)                                       | Demo build/run for both apps; Astro Deno `--allow` model; Qwik bun `server.ts` wrapper; M11 live-endpoint findings (CORS, slug rotation, liveblog availability)                                              |
| [docs/M12_VALIDATION.md](./docs/M12_VALIDATION.md)                   | M-12 final perf-validation sign-off — per-criterion mapping from the n=10 sweep to acceptance bars                                                                                                           |
| [docs/PERFORMANCE_TARGETS.md](./docs/PERFORMANCE_TARGETS.md)         | Per-target stretch CWV + LH-Perf split (Astro stretch ≥ 98, Qwik 2 floor ≥ 80) and the relaxation rationale                                                                                                  |
| [apps/astro/docs/ARCHITECTURE.md](./apps/astro/docs/ARCHITECTURE.md) | Astro 6 design — islands, runtime split (bun + Deno), CSP, Fonts API                                                                                                                                         |
| [apps/astro/docs/SECURITY.md](./apps/astro/docs/SECURITY.md)         | Astro M-12 CSP audit (auto-hash directive set, zero-violations evidence) + production permission audit (Deno `--allow` flag set)                                                                             |
| [apps/astro/docs/MILESTONES.md](./apps/astro/docs/MILESTONES.md)     | Astro implementation plan                                                                                                                                                                                    |
| [apps/qwik/docs/ARCHITECTURE.md](./apps/qwik/docs/ARCHITECTURE.md)   | Qwik 2 design — resumability, lazy handlers                                                                                                                                                                  |
| [apps/qwik/docs/QWIK2_NOTES.md](./apps/qwik/docs/QWIK2_NOTES.md)     | **Qwik 2 beta audit (M-12 consolidated).** 5 beta blockers + workarounds, framework-floor characterization (~136 KB), LH-Perf floor relaxation rationale, sprint-by-sprint friction log                      |
| [apps/qwik/docs/MILESTONES.md](./apps/qwik/docs/MILESTONES.md)       | Qwik implementation plan                                                                                                                                                                                     |
