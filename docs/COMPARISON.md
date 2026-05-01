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

| page-row      | LH-Perf p95 (A / Q) | CLS p95 (A / Q) | LCP real ms p95 (A / Q) | INP real ms p95 (A / Q) | Source                                                                                                                                                |
| ------------- | ------------------- | --------------- | ----------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| index         | 100 / 86            | 0 / 0           | 88 / 108                | 24 / 24                 | `packages/perf-harness/reports/RUN_NOTES.md § Measured outcomes` + per-page JSONs; Qwik LH-Perf p95: `docs/M12_VALIDATION.md § HONEST-FAILURE detail` |
| article       | 100 / 90.55         | 0 / 0           | 56 / 64                 | 20 / 24                 | same                                                                                                                                                  |
| section-geo   | 100 / 95            | 0 / 0           | 56 / 56                 | 24 / 16                 | same                                                                                                                                                  |
| section-topic | 100 / 94.55         | 0 / 0           | 56 / 56                 | 16 / 20                 | same                                                                                                                                                  |
| liveblog      | 100 / 92.55         | 0 / 0           | 56 / 58                 | 16 / 20                 | same                                                                                                                                                  |

Astro LH-Perf p95 cells (100 across all page-rows) come from `packages/perf-harness/reports/astro-{page}.json:metrics.lhPerf.p95` (the RUN_NOTES.md aggregate table shows LH-Perf median only). Qwik LH-Perf p95 cells (86, 90.55, 95, 94.55, 92.55) come from `docs/M12_VALIDATION.md § HONEST-FAILURE detail`, which sources them from `packages/perf-harness/reports/qwik-{page}.json:metrics.lhPerf.p95`.

**CLS observations.** Both apps land CLS = 0 at median and p95 across all 5 page-rows; both are at the stretch ≤ 0.05 budget with 0.05 of headroom (source: §1.3.1, §1.3.2 above; stretch budget per §1.2).

**Real-browser LCP observations.** Astro real-LCP medians range 46–76 ms across page-rows; Qwik real-LCP medians range 48–100 ms (source: §1.3.1). Both apps clear the stretch ≤ 1500 ms budget by more than an order of magnitude on every page-row at median and at p95.

**INP observations.** Both apps land 16 ms median INP on every page-row; p95 INP ranges 16–24 ms. Both clear the stretch ≤ 100 ms budget by ≥ 4× on every page-row at median.

**LH-Perf observations.** Astro median and p95 LH-Perf is 100 on every page-row, meeting the stretch ≥ 98 budget. Qwik median LH-Perf range is 83–93 across the 5 page-rows; Qwik p95 LH-Perf range is 86–95. Qwik does not meet the stretch ≥ 98 LH-Perf budget on any page-row at median or at p95; Qwik's LH-Perf gate runs against the documented `QWIK_LH_PERF_FLOOR=80` per-target relaxation explained in §1.7.

### 1.4 JS bundle sizes

Transferred-script bytes (gzipped) per page-row, both apps. Numbers transcribed verbatim from `packages/perf-harness/reports/RUN_NOTES.md § Measured outcomes` (`jsBytes` column). Per-page anchors are defined in `packages/perf-harness/cli_helpers.ts` and used by the budget gate per SMM constraint `69a5e26f118f`.

| page-row      | Astro jsBytes | Qwik jsBytes | Q − A delta (bytes) | Source                                                           |
| ------------- | ------------- | ------------ | ------------------- | ---------------------------------------------------------------- |
| index         | 13,917        | 176,237      | +162,320            | `packages/perf-harness/reports/RUN_NOTES.md § Measured outcomes` |
| article       | 13,917        | 176,237      | +162,320            | same                                                             |
| section-geo   | 16,079        | 176,237      | +160,158            | same                                                             |
| section-topic | 16,079        | 176,237      | +160,158            | same                                                             |
| liveblog      | 16,951        | 182,038      | +165,087            | same                                                             |

**Per-page anchors (gate thresholds).** Astro Article 30 KB / Liveblog 17 KB; Qwik Homepage 176 KB / Article 184 KB / Liveblog 184 KB / sections 176 KB (source: `packages/perf-harness/cli_helpers.ts` per `RUN_NOTES.md § Acceptance budgets in force`). Every measurement above lands under its anchor (M-12 sign-off row 3, source: `docs/M12_VALIDATION.md § Sign-off table`).

**Framework-floor characterization.** All Qwik page-rows include the ~136 KB irreducible Qwik 2 beta runtime (~102 KB Qwik core + ~12 KB router + zod + ~7 KB router internals + ~5 KB qwikLoader + ~5 KB preloader + ~5.5 KB web-vitals) per `apps/qwik/docs/QWIK2_NOTES.md § M12 Consolidated Audit > Framework-floor characterization`. The Q − A delta column is dominated by this floor on every page-row; the chunk-inventory deep dive lives in §5 (story-004).

### 1.5 SSR throughput

Server-side rendering throughput per page-row, both apps. Run parameters: `--duration=10s --concurrency=4` per (target, page) invocation, 10 invocations total (5 page-rows × 2 apps), no errors across 31,197 total requests. Numbers transcribed verbatim from `packages/perf-harness/reports/RUN_NOTES.md § SSR throughput`.

| page-row      | Astro req/s | Qwik req/s | Q − A delta (req/s) | Astro p95 latency (ms) | Qwik p95 latency (ms) | Source                                                        |
| ------------- | ----------- | ---------- | ------------------- | ---------------------- | --------------------- | ------------------------------------------------------------- |
| index         | 160.3       | 65.2       | −95.1               | 34                     | 70                    | `packages/perf-harness/reports/RUN_NOTES.md § SSR throughput` |
| article       | 248.4       | 162.9      | −85.5               | 22                     | 33                    | same                                                          |
| section-geo   | 487.3       | 596.9      | +109.6              | 11                     | 8                     | same                                                          |
| section-topic | 278.6       | 219.4      | −59.2               | 19                     | 24                    | same                                                          |
| liveblog      | 461.3       | 436.4      | −24.9               | 11                     | 12                    | same                                                          |

**Acceptance bar.** Per-page acceptance is `req/s ≥ 50` (source: `RUN_NOTES.md § SSR throughput`). Lowest measurement is `qwik / index` at 65.2 req/s — every page-row clears the bar (M-12 sign-off row 4, source: `docs/M12_VALIDATION.md § Sign-off table`).

**Throughput-skew note.** The aggregate row-by-row deltas (Q − A) range from −95.1 req/s on `index` to +109.6 req/s on `section-geo`. RUN_NOTES.md attributes the skew to per-page SSR work — larger pages (article, index) do more work per request, lowering req/s; smaller pages (sections, liveblog) churn faster (source: `RUN_NOTES.md § SSR throughput`, paragraph after the table).

### 1.6 Stretch verdict per (app, page-row)

PASS / HONEST-FAILURE per stretch metric per (app, page-row), aggregated from §1.3 (CWV), §1.4 (jsBytes), §1.5 (SSR throughput), and the CSP-zero claim from `apps/astro/docs/SECURITY.md § M12 Audit > Final CSP directive set` and `packages/perf-harness/reports/RUN_NOTES.md § Measured outcomes` (`CSP violations` column). The CSP gate per SMM constraint `fd770051b407` requires runtime collector evidence (`AggregatedReport.cspViolations` from `packages/perf-harness/web_vitals_collector.ts`), not header-only assertions — collected and recorded in the n=10 sweep.

| app   | page-row      | LH-Perf               | CLS  | LCP-real | INP-real | jsBytes | SSR req/s | CSP violations | Source                                                                                               |
| ----- | ------------- | --------------------- | ---- | -------- | -------- | ------- | --------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| astro | index         | PASS                  | PASS | PASS     | PASS     | PASS    | PASS      | PASS (0)       | §1.3.1, §1.3.2, §1.4, §1.5; `RUN_NOTES.md § Measured outcomes`; `M12_VALIDATION.md § Sign-off table` |
| astro | article       | PASS                  | PASS | PASS     | PASS     | PASS    | PASS      | PASS (0)       | same                                                                                                 |
| astro | section-geo   | PASS                  | PASS | PASS     | PASS     | PASS    | PASS      | PASS (0)       | same                                                                                                 |
| astro | section-topic | PASS                  | PASS | PASS     | PASS     | PASS    | PASS      | PASS (0)       | same                                                                                                 |
| astro | liveblog      | PASS                  | PASS | PASS     | PASS     | PASS    | PASS      | PASS (0)       | same                                                                                                 |
| qwik  | index         | HONEST-FAILURE (§1.7) | PASS | PASS     | PASS     | PASS    | PASS      | PASS (0)       | same                                                                                                 |
| qwik  | article       | HONEST-FAILURE (§1.7) | PASS | PASS     | PASS     | PASS    | PASS      | PASS (0)       | same                                                                                                 |
| qwik  | section-geo   | HONEST-FAILURE (§1.7) | PASS | PASS     | PASS     | PASS    | PASS      | PASS (0)       | same                                                                                                 |
| qwik  | section-topic | HONEST-FAILURE (§1.7) | PASS | PASS     | PASS     | PASS    | PASS      | PASS (0)       | same                                                                                                 |
| qwik  | liveblog      | HONEST-FAILURE (§1.7) | PASS | PASS     | PASS     | PASS    | PASS      | PASS (0)       | same                                                                                                 |

**Aggregate.** Astro: 35 PASS / 0 HONEST-FAILURE across 5 page-rows × 7 stretch metrics (LH-Perf, CLS, LCP-real, INP-real, jsBytes, SSR req/s, CSP violations). Qwik: 30 PASS / 5 HONEST-FAILURE — the failures are all the LH-Perf cells (one per Qwik page-row), gated against the documented `QWIK_LH_PERF_FLOOR=80` per-target relaxation explained in §1.7.

### 1.7 Honest-failure: Qwik LH-Perf relaxation rationale

The single HONEST-FAILURE category in §1.6 is Qwik LH-Perf vs the stretch ≥ 98 budget. This section records the relaxation rationale per SMM constraint `d77dd7b4007e` ("Stretch INP<=100ms applies to all targets; on miss accept honest failure or land per-target relaxation with measured numbers — never silently raise") — measured numbers, named cause, no silent stretch raise.

**Floor.** `QWIK_LH_PERF_FLOOR = 80`, defined at `packages/perf-harness/cli_helpers.ts:50-59`. The Qwik LH-Perf gate runs against this floor; the stretch ≥ 98 budget is preserved in `STRETCH_CWV.lhPerf` and continues to gate Astro routes.

**Per-page Qwik LH-Perf measurements (n=10).** Transcribed verbatim from `docs/M12_VALIDATION.md § HONEST-FAILURE detail` (which itself cites `packages/perf-harness/reports/qwik-{page}.json:metrics.lhPerf.median` / `.p95`).

| page-row      | LH-Perf median | LH-Perf p95 | Source                                           |
| ------------- | -------------- | ----------- | ------------------------------------------------ |
| index         | 83             | 86          | `docs/M12_VALIDATION.md § HONEST-FAILURE detail` |
| article       | 88.5           | 90.55       | same                                             |
| section-geo   | 92             | 95          | same                                             |
| section-topic | 93             | 94.55       | same                                             |
| liveblog      | 91             | 92.55       | same                                             |

**Cause.** ~136 KB framework runtime irreducible on `@qwik.dev/core` 2.0.0-beta.32 (~102 KB Qwik core + ~12 KB router + zod + ~7 KB router internals + ~5 KB qwikLoader + ~5 KB preloader + ~5.5 KB web-vitals). Qwik 2 beta.32's core runtime is +86% over Qwik 1 stable's `core` chunk (101,968 B vs 54,680 B) per the chunk-inventory bisect. Source: `apps/qwik/docs/QWIK2_NOTES.md § M12 Consolidated Audit > Framework-floor characterization`.

**Floor calibration.** The 80 floor sits 3 points below the lowest measured Qwik LH-Perf median (83 on `index`). The gap is sized to absorb framework-runtime variance on the beta line without false-failing while still firing on a real ~5-point regression. Source: `apps/qwik/docs/QWIK2_NOTES.md § M12 Consolidated Audit > LH-Perf floor relaxation rationale`.

**Re-evaluation point.** When `@qwik.dev/core` ships its size-optimization pass at Qwik 2 stable, re-measure LH-Perf and reconsider whether the floor stays at 80 or returns to the stretch ≥ 98. The relaxation is per-target and per-version, not permanent. Source: same as floor calibration above; full bisect history in §5 (story-004).

**Cross-references.** §5 (story-004) elaborates on the framework-floor cost story, the leaf-component convention, and the other beta-blockers consolidated in `QWIK2_NOTES.md § M12 Consolidated Audit > Beta blockers landed`.

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
