# @aje-poc/perf-harness

Shared performance measurement rig for the AJE Astro and Qwik PoCs.

## What it will do

- Drive each app's four page types via **Playwright** (so interactions like Load More click and hamburger toggle are exercised — required for INP measurement)
- Run **Lighthouse** against the resulting state for lab CWV + bundle metrics
- Aggregate **N runs per page** (CWV are noisy; n=5+ recommended) into per-page summaries
- Emit a structured report consumable by `docs/COMPARISON.md` (M9)
- Use **`web-vitals`** instrumentation embedded in each app for consistent metric definitions

The `chrome-devtools-mcp` is also available as an on-demand probe during development, but is not part of the harness CI loop.

## Status

Not implemented yet. Scaffolding lands in **M2** of each app — see `apps/astro/docs/MILESTONES.md` or `apps/qwik/docs/MILESTONES.md`.

## Why a shared package

The whole point of running both PoCs is comparison. If each app measures itself differently, the comparison report is noise. This package is the single source of truth for "how we measure performance across both apps."
