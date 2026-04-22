# @aje-poc/perf-harness

Shared Lighthouse-driven performance harness for the AJE Astro and Qwik PoCs.

## What it does

For a given target (`astro` or `qwik`), the harness:

1. Spawns the shared mock GraphQL API on `:4455`.
2. Spawns the target app's production-built server (Astro: `deno run dist/server/entry.mjs` on `:8080`; Qwik: `vite preview` on `:4173`).
3. For each configured page, runs Lighthouse N times via `chrome-launcher`.
4. Aggregates the median per metric (LCP, CLS, Lighthouse Perf score, JS bundle bytes) across the N runs.
5. Writes a deterministic `{target}-{page}.json` and `{target}-{page}.md` to `packages/perf-harness/reports/` (gitignored) and prints the markdown to stdout.

The mock-api and the app are torn down on exit (SIGTERM, SIGKILL after 2s).

INP is intentionally absent from the lab-metric schema — without a browser-driven session driving real interactions, Lighthouse-only INP is misleading on a no-interaction placeholder page. INP arrives via the `web-vitals` JS lib field-side (`apps/{astro,qwik}/src/lib/web-vitals.ts`), surfaced under `webVitals.samples` in the report. Browser-driving uses puppeteer-core attached to chrome-launcher's Chrome via CDP — see `chrome.ts` and `runner_helpers.ts:collectWebVitals`.

## Usage

From the repo root:

```bash
bun run perf:astro              # n=5 default
bun run perf:qwik
bun run perf:astro -- --runs=10 # statistical-confidence pass (M12)
bun run perf:astro -- --page=home
```

Equivalent direct invocation from this package:

```bash
bun run runner.ts --target=astro --runs=5
```

The runner exits 0 on success and 1 on any subprocess timeout, missing Lighthouse audit, or unhandled error. Errors are written to stderr; reports go to stdout.

### Prerequisites

- Node 22.12+ (Astro 6 requirement) — `nvm use 22` if your shell default is older.
- Deno 2 — for the mock-api and Astro production server.
- The target app must be built first:
  - `bun --filter aje-poc-astro build` for Astro
  - `bun --filter aje-poc-qwik build` for Qwik (also needs `src/entry.preview.tsx` — story-003 work)

## Interpretation guide

| Metric  | What it is                                          | Stretch target | Floor (hard fail) |
| ------- | --------------------------------------------------- | -------------- | ----------------- |
| LCP     | Largest Contentful Paint, lab measurement           | ≤ 1500 ms      | < 2500 ms         |
| CLS     | Cumulative Layout Shift                             | ≤ 0.05         | < 0.1             |
| lhPerf  | Lighthouse Performance category score (0–100)       | ≥ 98           | ≥ 95              |
| jsBytes | Sum of `network-requests` items where type = Script | per app budget | per app budget    |

Median is the central tendency at n=5; p95 is deliberately not emitted at this sample size (it would collapse to the max and mislead readers). M12 reintroduces p95 with n≥20.

JS budgets per app live in each app's `docs/ARCHITECTURE.md`.

## Development probing — chrome-devtools-mcp

For one-off interactive performance investigation outside the CI loop, drive a Chrome instance via `chrome-devtools-mcp` directly. That tool is dev-time only and not part of this harness; use it when you want to step through a specific interaction or capture a trace, not when you want comparable per-target numbers.

## Files

- `runner.ts` — CLI entry, lifecycle orchestration, aggregation
- `runner_helpers.ts` — `parseArgs`, `waitForPort`, `buildPageList` (unit-tested)
- `lighthouse.ts` — Lighthouse Node API wrapper, throws on missing audits
- `aggregator.ts` — pure median (mean of two middles for even N)
- `reporter.ts` — pure JSON+Markdown emit, recursive `sortKeys` for byte-stability
- `tests/` — vitest unit tests for the pure modules
- `reports/` — output (gitignored)

## Testing

```bash
bun run test
```

21 tests across aggregator, reporter, and runner_helpers. The runner orchestrator itself is exercised by smoke runs against each target.
