# Astro 6 vs Qwik 2 beta — Framework Comparison

This document is the M-13 capstone of the AJE PoC monorepo: a side-by-side comparison of two parallel implementations of the same product surface (aljazeera.com — Homepage, Article, Section Front, Live Blog) on Astro 6 + Preact and on Qwik 2 (`@qwik.dev/core` 2.0.0-beta.32). Both apps target the same shared mock GraphQL API, the same stretch Core Web Vitals budgets, and the same four production page types — see `README.md` and `CLAUDE.md` (root) for monorepo orientation.

The doc is structured so each section answers one question. Performance (§1) is data-only — every numeric claim cites a source file. Sections §2–§7 mix measured and qualitative findings, with citations to code paths and audit docs that back each claim. Section §8 is the synthesis: when to choose Astro, when to choose Qwik, and what's still open.

## Table of Contents

1. [Performance](#1-performance)
2. [Developer Experience](#2-developer-experience)
3. [Architecture](#3-architecture)
4. [Astro 6 platform features](#4-astro-6-platform-features)
5. [Qwik 2 beta deep dive](#5-qwik-2-beta-deep-dive)
6. [Ecosystem](#6-ecosystem)
7. [Production readiness](#7-production-readiness)
8. [Tradeoffs](#8-tradeoffs)

## 1. Performance

### 1.1 Methodology

All numbers in §1 come from the n=10 measurement matrix that landed in sprint-012 (M-12 final performance validation), executed against the Deno mock GraphQL API at `localhost:4455` (Astro target) and `localhost:4456` (Qwik target). Environment fingerprint, run parameters, acceptance budgets, and the per-(target, page) raw tables live in `packages/perf-harness/reports/RUN_NOTES.md`; the per-page report JSONs live alongside it as `packages/perf-harness/reports/{astro,qwik}-{page}{,-throughput}.json`. The M-12 sign-off — which criterion of M-12 each measurement satisfies — lives in `docs/M12_VALIDATION.md`.

**Page-type vocabulary.** The PoC implements 4 production page types (Homepage, Article, Section Front, Live Blog) — but the perf sweep measures Section Front in two variants (geographic at `/middle-east` and topic at `/opinion`) because their mock-API resolution paths differ. So §1's tables show **5 page-rows × 2 apps** per metric while still covering the 4 page types: `index` (Homepage), `article`, `section-geo` and `section-topic` (Section Front variants), `liveblog` (Live Blog).

**Real-browser vs lab LCP.** The harness records both Lighthouse-throttled lab LCP (`metrics.lcp` in each report JSON) and real-browser median LCP from the web-vitals collector (`webVitals.aggregated.lcp`) — see SMM constraint `8e1727ffcd3e` for the dual-LCP doctrine. §1 reports the **real-browser** number as the LCP headline because that is the gate per SMM constraint `69a5e26f118f` (perf budget gating uses real-browser LCP, gzipped transferSize for jsBytes). Lab LCP is preserved in the per-page JSON for honesty but is not surfaced in the comparison tables.

**Citation convention.** Each table ends with a `Source` column pointing to a section of `RUN_NOTES.md` or `M12_VALIDATION.md`. The aggregate sources are the comparison-relevant view; for a single-cell dispute, drill from `RUN_NOTES.md § Measured outcomes` down to the per-page report JSON named in §1.1 above. Inline prose citations use a trailing `(source: …)` parenthetical.

### 1.2 Stretch budgets

| Metric                 | Stretch target | Hard floor                  | Source                                                              |
| ---------------------- | -------------- | --------------------------- | ------------------------------------------------------------------- |
| LCP (real-browser)     | ≤ 1500 ms      | < 2500 ms                   | `README.md § stretch CWV`; `packages/perf-harness/cli_helpers.ts`   |
| CLS                    | ≤ 0.05         | < 0.10                      | same                                                                |
| INP (real-browser)     | ≤ 100 ms       | < 200 ms                    | same                                                                |
| Lighthouse Performance | ≥ 98           | Qwik floor: ≥ 80 (see §1.7) | `packages/perf-harness/cli_helpers.ts:50-59` (`QWIK_LH_PERF_FLOOR`) |

The stretch column is the acceptance bar per SMM constraint `9cc47cf13aba`. The hard-floor column is the failure threshold below which a milestone fails outright. Qwik's LH-Perf floor relaxation is the only documented per-target deviation (§1.7).

### 1.3 Core Web Vitals

Comparison view: rows per page-row, columns per app. Astro number first, Qwik number second (`A / Q`). Numbers transcribed verbatim from `packages/perf-harness/reports/RUN_NOTES.md § Measured outcomes` (sprint-012 story-003 + story-004 n=10 sweep).

#### 1.3.1 Medians (n=10)

| page-row      | LH-Perf (A / Q) | CLS (A / Q) | LCP real ms (A / Q) | INP real ms (A / Q) | Source                                                           |
| ------------- | --------------- | ----------- | ------------------- | ------------------- | ---------------------------------------------------------------- |
| index         | 100 / 83        | 0 / 0       | 76 / 100            | 16 / 16             | `packages/perf-harness/reports/RUN_NOTES.md § Measured outcomes` |
| article       | 100 / 88.5      | 0 / 0       | 52 / 58             | 16 / 16             | same                                                             |
| section-geo   | 100 / 92        | 0 / 0       | 50 / 48             | 16 / 16             | same                                                             |
| section-topic | 100 / 93        | 0 / 0       | 50 / 48             | 16 / 16             | same                                                             |
| liveblog      | 100 / 91        | 0 / 0       | 46 / 48             | 16 / 16             | same                                                             |

#### 1.3.2 p95 (n=10)

| page-row      | LH-Perf p95 (A / Q) | CLS p95 (A / Q) | LCP real ms p95 (A / Q) | INP real ms p95 (A / Q) | Source                                                                            |
| ------------- | ------------------- | --------------- | ----------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| index         | 100 / 86            | 0 / 0           | 88 / 108                | 24 / 24                 | `packages/perf-harness/reports/RUN_NOTES.md § Measured outcomes` + per-page JSONs |
| article       | 100 / 90.55         | 0 / 0           | 56 / 64                 | 20 / 24                 | same                                                                              |
| section-geo   | 100 / 95            | 0 / 0           | 56 / 56                 | 24 / 16                 | same                                                                              |
| section-topic | 100 / 94.55         | 0 / 0           | 56 / 56                 | 16 / 20                 | same                                                                              |
| liveblog      | 100 / 92.55         | 0 / 0           | 56 / 58                 | 16 / 20                 | same                                                                              |

Astro LH-Perf p95 cells (100 across all page-rows) come from `packages/perf-harness/reports/astro-{page}.json:metrics.lhPerf.p95` (the RUN_NOTES.md aggregate table shows median only).

**CLS observations.** Both apps land CLS = 0 at median and p95 across all 5 page-rows; both are at the stretch ≤ 0.05 budget with 0.05 of headroom (source: §1.3.1, §1.3.2 above; stretch budget per §1.2).

**Real-browser LCP observations.** Astro real-LCP medians range 46–76 ms across page-rows; Qwik real-LCP medians range 48–100 ms (source: §1.3.1). Both apps clear the stretch ≤ 1500 ms budget by more than an order of magnitude on every page-row at median and at p95.

**INP observations.** Both apps land 16 ms median INP on every page-row; p95 INP ranges 16–24 ms. Both clear the stretch ≤ 100 ms budget by ≥ 4× on every page-row at median.

**LH-Perf observations.** Astro median and p95 LH-Perf is 100 on every page-row, meeting the stretch ≥ 98 budget. Qwik median LH-Perf range is 83–93 across the 5 page-rows; Qwik p95 LH-Perf range is 86–95. Qwik does not meet the stretch ≥ 98 LH-Perf budget on any page-row at median or at p95; Qwik's LH-Perf gate runs against the documented `QWIK_LH_PERF_FLOOR=80` per-target relaxation explained in §1.7.

_§1.4–§1.7 follow in subsequent commits._

## 2. Developer Experience

_To be written by sprint-013 story-002._

## 3. Architecture

_To be written by sprint-013 story-002._

## 4. Astro 6 platform features

_To be written by sprint-013 story-003._

## 5. Qwik 2 beta deep dive

_To be written by sprint-013 story-004._

## 6. Ecosystem

_To be written by sprint-013 story-005._

## 7. Production readiness

_To be written by sprint-013 story-005._

## 8. Tradeoffs

_To be written by sprint-013 story-006 (capstone)._
