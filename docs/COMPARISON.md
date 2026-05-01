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

_§1.3–§1.7 follow in subsequent commits._

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
