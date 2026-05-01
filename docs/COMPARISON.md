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

**Unit note.** `README.md § stretch CWV` states LCP as `≤ 1.5s` / `< 2.5s` and INP as `≤ 200ms`; values are shown in milliseconds throughout §1 to match the unit used by the §1.3 INP cells (real-browser INP is sub-second, so milliseconds is the natural unit). The conversions are exact (`1.5s = 1500 ms`, `2.5s = 2500 ms`).

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

| page-row      | Astro jsBytes (gzipped) | Qwik jsBytes (gzipped) | Q − A delta (gzipped bytes) | Source                                                           |
| ------------- | ----------------------- | ---------------------- | --------------------------- | ---------------------------------------------------------------- |
| index         | 13,917                  | 176,237                | +162,320                    | `packages/perf-harness/reports/RUN_NOTES.md § Measured outcomes` |
| article       | 13,917                  | 176,237                | +162,320                    | same                                                             |
| section-geo   | 16,079                  | 176,237                | +160,158                    | same                                                             |
| section-topic | 16,079                  | 176,237                | +160,158                    | same                                                             |
| liveblog      | 16,951                  | 182,038                | +165,087                    | same                                                             |

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

**Acceptance bar.** Per-page acceptance is `req/s ≥ 50` (source: `RUN_NOTES.md § SSR throughput`). The lowest measurement in the table above is `qwik / index` — clears the bar with headroom (M-12 sign-off row 4, source: `docs/M12_VALIDATION.md § Sign-off table`). Cell drift in §1.5's table will surface here automatically because no number is restated in this prose.

**Throughput-skew note.** The aggregate row-by-row deltas (Q − A) range from −95.1 req/s on `index` to +109.6 req/s on `section-geo`. RUN_NOTES.md attributes the skew to per-page SSR work — pages with more SSR work per request (article, index) report lower req/s; pages with less SSR work per request (sections, liveblog) report higher req/s (source: `RUN_NOTES.md § SSR throughput`, paragraph after the table).

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

§2 captures measurable DX surfaces (build, dev server, TypeScript, code-complexity proxies, test cold-start) per app. Where a number is reproducible, the citation is a measurement command the reader can re-run; where a behavior is documented, the citation is a file path. Build-time wall-clock numbers are not transcribed because neither app's docs publishes them — the reproducible commands below are the citation.

### 2.1 Build commands & build shape

| Concern                         | Astro                                                                          | Qwik                                                                                               | Source                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Build command                   | `bun --bun astro build`                                                        | `vite build && vite build --ssr ./src/entry.ssr.tsx && vite build --ssr ./src/entry.preview.tsx`   | `apps/astro/package.json` build script; `apps/qwik/package.json:9` build script                               |
| Build steps                     | 1 (Astro orchestrates client + SSR)                                            | 3 sequential vite builds (client / SSR entry / preview entry)                                      | same                                                                                                          |
| Production bundle output        | `apps/astro/dist/server/entry.mjs` (Deno-targeted SSR)                         | `apps/qwik/dist/` (client) + `apps/qwik/server/entry.ssr.js` + `apps/qwik/server/entry.preview.js` | `apps/astro/CLAUDE.md`; `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Build / dev checks (M3 acceptance)` |
| Node-version gate workaround    | `bun --bun` flag forces bun runtime to bypass Astro 6's Node ≥22.12 hard-check | n/a (Qwik vite plugin tolerates bun directly)                                                      | `apps/astro/CLAUDE.md`                                                                                        |
| Reproducible build-time command | `time bun run build:astro` from repo root                                      | `time bun run build:qwik` from repo root                                                           | root `package.json`                                                                                           |

Why three builds for Qwik: the SSR entry and the preview entry both need to be SSR-compiled (one for production-style request handling, one for the `bun run preview` smoke loop). The `entry.preview.tsx` file was added in sprint-002 (commit `4579c6a — fix(qwik): add missing entry.preview.tsx (sprint-002 scaffold gap)`) to fill the M3 scaffold gap and was later wired into the perf-harness production-equivalent path in sprint-004 story-003 (per `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Production-equivalent perf-harness path`; note that the QWIK2_NOTES.md entry attributes the file's addition to sprint-003 — git history is the authoritative source).

### 2.2 Dev server & HMR

| Concern          | Astro                                               | Qwik                                                                                                                                                   | Source                                                                                                          |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Dev runtime      | bun running Astro 6's Vite-based dev server         | bun running Qwik 2's Vite-based dev server                                                                                                             | `apps/astro/docs/ARCHITECTURE.md § Runtime & Tooling`; `apps/qwik/vite.config.ts`                               |
| HMR mechanism    | Vite HMR for `.astro` + Preact islands (out-of-box) | Vite HMR + Qwik vite plugin (`qwikVite` from `@qwik.dev/core/optimizer` + `qwikRouter` from `@qwik.dev/router/vite`)                                   | same; `apps/qwik/vite.config.ts:24` (plugin import sites)                                                       |
| Vite version     | latest (no pin documented)                          | **Pinned `^7.3.2`** — Vite 8's rolldown bundler breaks Qwik router SSR module collection (`TypeError: ... 'concat'`); recheck on subsequent beta bumps | `apps/qwik/package.json:35`; `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Vite version pin — beta blocker` |
| Default dev port | `4321` (Astro default)                              | `5173` (Vite default)                                                                                                                                  | per-app `package.json` dev scripts                                                                              |

The Vite-version pin is the most load-bearing dev-server difference: a routine `bun update` in Qwik can break SSR until rolled back. The Astro stack has no equivalent pin — Astro 6 + Vite tracks Vite latest.

### 2.3 TypeScript experience

| Concern                       | Astro                                                                                                 | Qwik                                                                                                                                                              | Source                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Strict mode                   | `extends: "astro/tsconfigs/strict"`                                                                   | `"strict": true`                                                                                                                                                  | `apps/astro/tsconfig.json:2`; `apps/qwik/tsconfig.json`                                                       |
| Component file types          | `.astro` (static, no JS) + `.tsx` (Preact islands, `jsx: "react-jsx"` w/ `jsxImportSource: "preact"`) | `.tsx` everywhere; Qwik 2 JSX                                                                                                                                     | `apps/astro/tsconfig.json:4-5`; `apps/qwik/src/` (find result, §2.4)                                          |
| Notable framework gotchas     | none (Astro 6 is stable)                                                                              | `QwikCityProvider` deprecated → use `useQwikRouter()` inside `component$` (Qwik 2 v3-removal warning); `passive:` event marker syntax not yet verified in beta.32 | `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Divergences from apps/qwik/docs/ARCHITECTURE.md` items 1, 4 |
| Type-source-of-truth doctrine | n/a                                                                                                   | Read `node_modules/@qwik.dev/core/*.d.ts` before depending on release-notes features (SMM wisdom `2cc98fbeedff`)                                                  | `apps/qwik/CLAUDE.md § Looking up Qwik 2 specifics`                                                           |

Qwik's beta-friction TypeScript surface is documented inline in QWIK2_NOTES.md as it accumulates; Astro 6's TS surface is the same as Astro 5's for the patterns this PoC uses, with no documented gotchas in the M1-M12 work.

### 2.4 Code complexity proxies

Measurements taken at story-002 commit time on the post-merge `main` tip. The reproducible `find` + `wc -l` commands ARE the citation — re-run them to verify or re-measure later.

| Metric                         | Astro                                                                              | Qwik                                                                                                                        | Source                                                                                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source files (excluding tests) | 42                                                                                 | 45                                                                                                                          | `find apps/astro/src -type f \( -name "*.astro" -o -name "*.tsx" -o -name "*.ts" \) ! -name "*.test.*" ! -name "*.spec.*" \| wc -l`; analogous `apps/qwik/src` command (no `.astro`)                                 |
| Test files                     | 36                                                                                 | 39                                                                                                                          | `find apps/astro -type f \( -name "*.test.*" -o -name "*.spec.*" \) \| wc -l`; analogous `apps/qwik` command                                                                                                         |
| Source LOC (cat-piped wc)      | 1,901                                                                              | 2,183                                                                                                                       | `find apps/astro/src ... ! -name "*.test.*" -exec cat {} + \| wc -l`; analogous `apps/qwik/src`                                                                                                                      |
| Interactive boundary count     | 4 `client:idle` + 2 `client:visible` directive uses across `.astro` + `.tsx` files | 8 `component$` production uses (6 routes + BreakingTicker + Navigation) + 13 plain-function leaf exports per the convention | `grep -roE "client:[a-z]+" apps/astro/src \| sort \| uniq -c`; `grep -rln 'component\$(' apps/qwik/src --include="*.tsx" \| grep -v test`; `grep -rln "^export function" apps/qwik/src/components --include="*.tsx"` |

The interactive-boundary count is the most informative complexity proxy: Astro names exactly 6 hydration sites in the codebase via `client:*` directives; Qwik names 8 `component$` boundaries (which the optimizer further dices into per-handler QRL chunks at build time — see §3.3) plus 13 plain-function leaves (per the leaf-component convention in `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Leaf component convention`, which §5 elaborates).

### 2.5 Test cold-start cost

SMM risk `4573b5815a2f` records "Qwik vitest cold-start ~10x Astro (6.3s vs 0.67s) — Vite+Qwik plugin transform overhead may compound as src grows" (source: SMM event id, sprint-002 measurement). The pre-build prerequisite in Qwik's test script (`bun run build &&` in `apps/qwik/package.json:13`) compounds the cold-start cost vs Astro's standalone `bun test`.

Reproducible commands:

- Astro: `time bun --filter aje-poc-astro test:run`
- Qwik: `time bun --filter aje-poc-qwik test:run`

This is one of the few apples-to-apples DX measurements that exists in the M1-M12 record. The 10× multiplier was sized at sprint-002 with a near-empty src tree; both apps have grown since (Astro to 42 source files, Qwik to 45 — see §2.4), so a re-measure at story-006 capstone would be useful but is out of story-002 scope.

## 3. Architecture

§3 captures the core architectural difference between the two apps and the per-app patterns that fall out of it. Every architectural claim cites a code reference (`apps/<app>/<file>` or section in an audit doc) — the citation discipline is the §3 equivalent of §1's no-opinion rule.

### 3.1 Hydration vs resumability — the central distinction

Astro and Qwik are both SSR-first; the difference is what happens **client-side after first paint**.

- **Astro**: client islands. The server emits static HTML; each Preact island runs its own initialization on hydrate per its `client:*` directive. The rest of the page is static — no JS executes for non-island markup. Hydration is per-island and independent — a failed island does not cascade (`apps/astro/docs/ARCHITECTURE.md § Component Library` table, line 23).
- **Qwik**: resumability. The server renders HTML and serializes component state into the DOM. The client does not re-execute component initialization — it resumes from the serialized state, with interactive handlers lazy-loaded as QRL chunks only when the user triggers them (`apps/qwik/docs/ARCHITECTURE.md § Resumability` lines 12-14).

The two models converge on a similar end-state for non-interactive markup (zero JS) but diverge on how interactive code arrives at the page: Astro ships per-island bundles eagerly per directive (`client:idle`/`client:visible`/etc.); Qwik ships nothing for handlers until first interaction, with the framework runtime itself providing the lazy-load infrastructure (the ~136 KB framework floor cited in §1.4 + §5).

### 3.2 Astro islands — directives in use

The Astro app declares 6 island components in its component library; the directive used for each comes from the deploy site (grep against `apps/astro/src`).

| Component                   | Directive                                | Purpose                                                             | Source                                                                                                |
| --------------------------- | ---------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `BreakingTicker.tsx`        | `client:idle`                            | 30s polling for breaking-news banner; mounted in `BaseLayout.astro` | `apps/astro/docs/ARCHITECTURE.md § Component Library`; `apps/astro/src/components/BreakingTicker.tsx` |
| `LoadMoreButton.tsx`        | `client:idle`                            | Section-front pagination (offset-based, client-side append)         | same; `apps/astro/src/components/LoadMoreButton.tsx`                                                  |
| `LiveBlogUpdater.tsx`       | `client:idle`                            | 30s polling for live-blog entries with prepend                      | same; `apps/astro/src/components/LiveBlogUpdater.tsx`                                                 |
| `NavigationMenu.tsx`        | `client:idle`                            | Hamburger-toggle menu; mounted in `BaseLayout.astro:37`             | same; `apps/astro/src/layouts/BaseLayout.astro:37`                                                    |
| `VerticalVideoCarousel.tsx` | `client:visible`                         | Vertical-video carousel with touch/scroll handlers                  | same; `apps/astro/src/components/VerticalVideoCarousel.tsx`                                           |
| `LivestreamPlayer.tsx`      | `client:visible`                         | Embedded livestream playback                                        | same; `apps/astro/src/components/LivestreamPlayer.tsx`                                                |
| **In-tree directive count** | **4 `client:idle` + 2 `client:visible`** | (verified inline)                                                   | `grep -roE "client:[a-z]+" apps/astro/src \| sort \| uniq -c`                                         |

The directives are explicit per-island choices: polling work that should be lazy-but-warm uses `client:idle`; viewport-conditional content uses `client:visible`. There are no `client:load` (eager) uses — the budget discipline is to ship as little upfront JS as possible.

### 3.3 Qwik QRL boundaries — `$()`, `useVisibleTask$`, `useOnDocument`

Qwik's optimizer extracts `$`-suffixed expressions into separate QRL chunks at build time. There are three distinct primitives in this codebase, each with a concrete deploy site:

- **`$()` click handlers** — wrap async handlers with `$()` to mark a QRL boundary; the chunk is fetched on first interaction. Example: `LoadMoreButton.tsx` async pagination handler (per `apps/qwik/docs/ARCHITECTURE.md § LoadMoreButton component`, line 177 cites the `loadMore = $(async () => …)` pattern). In-tree: 8 `$()` handler markers in `apps/qwik/src/components/` (`grep -rn '\$(async\|\$(()' apps/qwik/src/components --include="*.tsx" | wc -l`).
- **`useVisibleTask$`** — runs once on visibility (mount-equivalent); wraps `setInterval` for polling. Production deploy sites: `apps/qwik/src/components/BreakingTicker.tsx:28`, `apps/qwik/src/components/LiveBlogUpdater.tsx:100`, `apps/qwik/src/components/LoadMoreButton.tsx`, `apps/qwik/src/routes/layout.tsx`. Test limitation: `createDOM()` does not bootstrap qwikLoader, so `useVisibleTask$` registers but never settles in unit tests — verification deferred to e2e (`apps/qwik/docs/QWIK2_NOTES.md § sprint-007 § Beta friction encountered` items 1, 3).
- **`useOnDocument`** — preferred over `useVisibleTask$` + `addEventListener` for cross-island document listeners because the handler lazy-loads via `$()` instead of being part of the visible-task chunk. Production deploy sites: `apps/qwik/src/components/LivestreamPlayer.tsx`, `apps/qwik/src/components/embeds/{Twitter,Instagram,Brightcove}Embed.tsx` (`apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > APIs confirmed present in beta.32`).

The `allowStale` primitive that the architecture doc originally referenced for routeLoader-driven polling does not exist in `@qwik.dev/core` 2.0.0-beta.32 — `useVisibleTask$ + setInterval` is the documented workaround until it lands (`apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Divergences` item 3). §5 (story-004) elaborates on the leaf-component convention (when to use `component$` vs plain function) which is the build-time complement to these runtime QRL boundaries.

### 3.4 Server-islands rejection — the M2 decision and post-M-12 reflection

`apps/astro/docs/ARCHITECTURE.md § Why client islands and not server islands?` (lines 25-34) records the original rejection. Astro 6 supports server islands — components rendered out-of-band on the server with their own cache TTL, deferred from the initial HTML response and streamed in afterward. The PoC chose client islands because every interactive component in the M4-M12 work either:

1. Requires true client-side interactivity (carousel swipes, hamburger toggle, video playback) — server islands cannot fire DOM events.
2. Polls on a client-controlled cadence (BreakingTicker 30s, LiveBlogUpdater 30s) — server islands would round-trip the SSR layer on every poll, defeating the purpose.
3. Maintains pure client-state (hamburger open/closed) — server-side execution would be incoherent.

**Post-M-12 reflection:** the rejection still holds. Walking the M4-M12 component additions:

- **M4 (perf harness)** — no server-island candidates (instrumentation only).
- **M5 (Layout & Nav)** — `NavigationMenu` (hamburger toggle, pure client state). Not a server-island candidate.
- **M6 (Homepage)** — `VerticalVideoCarousel`, `LivestreamPlayer` (DOM event handlers). Not server-island candidates.
- **M7 (Article)** — embed components (DOM script injection). Not server-island candidates.
- **M8 (Section Front + Load More)** — `LoadMoreButton` (client-side offset pagination, no URL change). Not a server-island candidate; would defeat the whole "client-side append" design per SMM constraint about pagination.
- **M9 (Live Blog)** — `LiveBlogUpdater` (30s polling). Server-island worst-case: 30s × N concurrent readers = N requests/30s back to the SSR origin where currently zero land.
- **M10 (Breaking Ticker)** — `BreakingTicker` (30s polling, global). Same worst-case as M9.
- **M11 (Live endpoint)** — config-only; no new components.

Zero M4-M12 components fit the server-island use-case profile (cacheable + non-interactive). The "so future-us doesn't relitigate" annotation in the original doc stood up. Confirmed in-tree: `grep -rin "server.island" apps/ docs/` returns only the `ARCHITECTURE.md` rejection block plus this section — no follow-up "actually we should reconsider" entry exists.

### 3.5 Hardcoded navigation — both apps

Per SMM constraint `05a8538dd5d5` ("Navigation is hardcoded per app; no nav GraphQL query, cmsArcSettings is never called"), both apps own their navigation tree statically.

| Concern                    | Astro                                                                           | Qwik                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Navigation component       | `apps/astro/src/components/NavigationMenu.tsx` (Preact island)                  | `apps/qwik/src/components/Navigation.tsx` (`component$` with `$()` hamburger toggle) |
| Mount site                 | `apps/astro/src/layouts/BaseLayout.astro:37` (`<NavigationMenu client:idle />`) | `apps/qwik/src/routes/layout.tsx`                                                    |
| GraphQL nav query          | none                                                                            | none                                                                                 |
| `cmsArcSettings` call site | none                                                                            | none                                                                                 |

Verification: `grep -r "cmsArcSettings" apps/astro/src apps/qwik/src` returns zero hits in either tree (confirmed inline). The constraint holds.

### 3.6 Production runtime split

The runtime story is the structural decision with the most variance between the apps. Astro runs on Deno 2 in production to apply the principle of least privilege via Deno's permission system; Qwik runs on bun with a hand-rolled Node-style middleware wrapper for the reasons documented in sprint-003 (below).

| Concern                      | Astro                                                                                                                          | Qwik                                                                                                                                                                              | Source                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production SSR runtime       | Deno 2 via `@deno/astro-adapter ^0.4.0`                                                                                        | bun running `apps/qwik/server.ts` (hand-rolled `node:http` wrapper around `QwikRouterNodeMiddleware` from `dist/server/entry.preview.js`)                                         | `apps/astro/CLAUDE.md`; `apps/qwik/server.ts`; `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Production-equivalent perf-harness path (sprint-004 story-003)` |
| Permission model             | `--allow-net=<derived from PUBLIC_API_BASE>` + `--allow-read=apps/astro/dist` + `--allow-env=<11 audited vars>`; `-A` rejected | bun runs without sandboxing (Node-style env access)                                                                                                                               | `apps/astro/docs/SECURITY.md § M12 Audit > Deno --allow audit`; `packages/perf-harness/spawn.ts:buildAstroDenoArgv`                                              |
| Runtime selection rationale  | Deno's permission model is the production-runtime defense the Astro PoC depends on                                             | Node middleware required less rewrite than adapting Qwik's bundled middleware to Deno's `Request → Response` model + working around a `staticFile` `static.root` resolution bug   | `apps/astro/docs/ARCHITECTURE.md § Runtime & Tooling`; `apps/qwik/docs/QWIK2_NOTES.md § sprint-003 > Why Node and not Deno` (lines 181-187)                      |
| Why not Deno on Qwik         | n/a                                                                                                                            | Deno middleware DOES exist (`@qwik.dev/router/middleware/deno` verified in node_modules) — pragmatic Node choice, not absence-forced; revisit if upstream `static.root` bug fixed | `apps/qwik/docs/QWIK2_NOTES.md § sprint-003 > Why Node and not Deno` (corrects an earlier "no Deno middleware" claim)                                            |
| CSP injection site           | `astro.config.mjs` security.csp via `packages/shared-csp/buildAstroCspConfig`                                                  | `apps/qwik/server.ts` sets `Content-Security-Policy` header via `packages/shared-csp/buildQwikCsp`                                                                                | `apps/astro/docs/SECURITY.md § M12 Audit`; `packages/shared-csp/index.ts:94` (`buildAstroCspConfig`) and `:111` (`buildQwikCsp`)                                 |
| Cross-link to security story | §4 (Astro CSP auto-hash via Astro 6's `scriptDirective` / `styleDirective`)                                                    | §5 (Qwik CSP `'unsafe-inline'` requirement, story-008)                                                                                                                            | per-section cross-references                                                                                                                                     |

The asymmetry is the comparison's most concrete production-readiness data point: Astro shipped with a narrow allowlist Deno permission model, validated by audit (`apps/astro/docs/SECURITY.md § M12 Audit > Deno --allow audit`); Qwik shipped with bun's default permission model (none) plus a hand-rolled middleware wrapper. §7 (story-005) elaborates on what this means for production deployment recommendations.

## 4. Astro 6 platform features

§4 covers the four Astro 6 platform features the PoC depends on: Fonts API, CSP (auto-hash via `scriptDirective`), `@deno/astro-adapter` (production runtime + `--allow` audit), and Vite Env API (build-time `PUBLIC_*` substitution). The audit content for each feature is consolidated in `apps/astro/docs/SECURITY.md § M12 Audit`; §4 references that doc as canonical and adds only the comparison-relevant framing plus the configuration-site citations.

### 4.1 Fonts API

The Astro 6 Fonts API auto-emits size-adjusted fallback `@font-face` rules at build time so the browser swaps from system fallback to web font with no observable layout shift — addressing the chronic CLS risk that manual `<link rel="preload">` + `font-display: swap` chains produce on news layouts.

**Configuration site:** `apps/astro/astro.config.mjs:25-36` — `fonts: [...]` block declaring `provider: fontProviders.google()`, `name: 'Inter'`, `cssVariable: '--font-inter'`, `weights: [400, 700]`, `styles: ['normal']`, `subsets: ['latin']`, `display: 'swap'`, `fallbacks: ['system-ui', 'sans-serif']`.

**Measured impact:** CLS = 0 (median + p95) across all 5 Astro page-rows at n=10 — at the stretch ≤ 0.05 budget with 0.05 of headroom (cross-link to §1.3.1 + §1.3.2 CWV tables). Source: `apps/astro/docs/SECURITY.md § M12 Audit > Fonts API CLS validation`.

**Cross-app note:** Qwik 2 has no built-in Fonts API equivalent; the Qwik PoC self-hosts Inter via the standard Vite asset pipeline plus a manually-tuned `size-adjust` + `ascent-override` / `descent-override` / `line-gap-override` fallback face (story-004 elaborates the Qwik-side font story in §5).

### 4.2 CSP — auto-hash via `scriptDirective`

Astro 6 emits per-bundle script + style hashes via the `scriptDirective` field, so inline content is allowed by hash, never by `'unsafe-inline'`. This is the structural difference from the Qwik beta's CSP shape (story-004 §5 elaborates the Qwik `'unsafe-inline'` requirement).

**Source-of-truth:** `packages/shared-csp/index.ts:94` (`buildAstroCspConfig(apiBase: string)`) — both `apps/astro/astro.config.mjs:42` (`csp: buildAstroCspConfig(API_BASE)` inside the `security:` block on lines 37-43) and the M11 demo path import this builder, so directive drift between perf and demo paths is structurally impossible. The function returns `{ scriptDirective: { resources: string[] }, directives: CspDirectivePrefix[] }`.

**Compile-time gate against silent widening:** `_CspDirectivePrefixIsExact` type-equality check at `packages/shared-csp/index.ts:83` (with the `CspDirectivePrefix` union starting at `:67`) breaks `tsc` if the directive list mutates without updating the union — TypeScript fails with "Type 'false' is not assignable to type 'true'." This is the only structural gate against silent CSP widening (source: `apps/astro/docs/SECURITY.md § M12 Audit > Final CSP directive set`, paragraph after the directive table).

**API-base validation:** `assertSafeApiBase` at `packages/shared-csp/index.ts:46` rejects CSP injection characters (whitespace, `;`, `,`, quotes, angle brackets, backslash, control chars) before `apiBase` is baked into `img-src` and `connect-src` directives — guards against header corruption and source-list grammar breakage when the operator points `PUBLIC_API_BASE` at a non-default upstream.

**Measured impact:** Zero CSP violations across all 5 Astro page-rows × n=10 runs — collected by `packages/perf-harness/web_vitals_collector.ts` per SMM constraint `fd770051b407` (runtime collector evidence required, not header-only assertions). Source: `apps/astro/docs/SECURITY.md § M12 Audit > Final CSP directive set` (the audit doc holds the full directive table); cross-link to §1.3.1, §1.6 (`PASS (0)` cells in the verdict matrix).

**Audit-deliverable note:** the n=10 sweep with the collector active surfaced 53 real `style-src-attr ← inline` violations from CMS-rendered `style="..."` attributes on WordPress wp-caption divs and Brightcove embed containers; fixed by `packages/shared-csp/strip-inline-styles.ts` plus the `apps/astro/src/lib/safe-inner-html.ts` seam (commits `9b04f84`, `233aa8d` in sprint-012). The follow-up sweep returned 0 violations across all 5 pages × n=10. Source: `apps/astro/docs/SECURITY.md § M12 Audit > Final CSP directive set` (audit-deliverable paragraph) — citation only; the deep dive lives in SECURITY.md.

### 4.3 `@deno/astro-adapter` — production runtime + `--allow` audit

Astro 6's Deno SSR adapter lets the principle of least privilege apply at request time via Deno's permission model. The narrow `--allow-*` flag set is the largest production-runtime defense in the Astro PoC — the cross-app comparison with Qwik's bun runtime lives in §3.6.

**Configuration site:** `apps/astro/astro.config.mjs:4` (import `deno from '@deno/astro-adapter'`) + `:17-20` (`adapter: deno({ port: Number(process.env.PORT ?? 8080), hostname: '0.0.0.0' })`). Adapter version: `^0.4.0` (peer-deps `astro: ^6.0.0`) per `apps/astro/package.json`.

**Final `--allow` flag set** (sealed at sprint-012 story-004; consumed by both `packages/perf-harness/spawn.ts` and `scripts/demo-launch-astro.ts`):

| Flag                           | Value                                                                        | Source                                                                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--allow-net=<derived>`        | `0.0.0.0:8080,${apiBaseHost}:${apiBasePort}` derived from `PUBLIC_API_BASE`  | `packages/perf-harness/spawn.ts:75` (`deriveAllowNet`); `:92` (`buildAstroDenoArgv`); SECURITY.md M11 follow-up                                                                             |
| `--allow-read=apps/astro/dist` | bundle directory only — no source, no config, no traversal vector            | `packages/perf-harness/spawn.ts:92`                                                                                                                                                         |
| `--allow-env=<11 vars>`        | `ASTRO_ALLOWED_ENV` — audited whitelist with per-variable rationale comments | `packages/perf-harness/spawn.ts:57-69` (constant + per-var rationale comments); SECURITY.md M12 audit summarizes the 11 vars in one row and redirects to spawn.ts for the per-var rationale |

**Why `-A` rejected:** `-A` (allow-all) would defeat the principle of least privilege — would grant the SSR process unconstrained access to every network interface, the entire filesystem, and every env var in the parent process (including operator-set secrets). Source: `apps/astro/docs/SECURITY.md § M12 Audit > Deno --allow audit > Why -A is rejected`.

**Single source of truth:** both `packages/perf-harness/spawn.ts:104` (`spawnAstro`) and `scripts/demo-launch-astro.ts` consume `buildAstroDenoArgv` so the M11 demo and the perf-harness boot byte-identical args. Cross-link: story-002 §3.6 cross-app runtime comparison; story-005 §7 picks up the production-readiness implication.

### 4.4 Vite Env API — build-time `PUBLIC_*` substitution

Astro 6 inherits Vite's `import.meta.env.PUBLIC_*` substitution — env vars prefixed `PUBLIC_` are inlined at build time as string literals in both SSR and client bundles. No explicit Vite Env API config is required: `apps/astro/astro.config.mjs:22-24` shows the `vite:` block is empty except for the Tailwind plugin.

**Build-time consumer (CSP bake):** `apps/astro/astro.config.mjs:12` reads `process.env.PUBLIC_API_BASE` (or `DEFAULT_API_BASE` fallback from `@aje-poc/shared-csp`) at config-load time and passes it to `buildAstroCspConfig(API_BASE)` on `:42` so the CSP `img-src` and `connect-src` directives are baked with the correct upstream host.

**SSR runtime consumer:** `apps/astro/src/lib/graphql.ts:27` (`resolveApiBase`) reads `import.meta.env.PUBLIC_API_BASE` (Vite-substituted at build) with the same fallback; called by `graphqlFetch()` on `:45`.

**Client island consumer:** `apps/astro/src/components/LiveBlogUpdater.tsx:14-15` reads `import.meta.env.PUBLIC_LIVEBLOG_POLL_INTERVAL_MS` with a fallback constant — Vite replaces the literal at build time before the island chunk ships.

**Measured impact:** Vite Env API correctness is verified by build success + functional acceptance, not by a perf gate. The Astro-side analogue of Qwik's `PUBLIC_API_BASE` build-bake bug (SMM constraint `17bc3961cb61` — Qwik perf build must bake `PUBLIC_API_BASE` matching `MOCK_API_PORT.qwik`) is structurally absent because Astro's adapter spawn pipeline derives `--allow-net` from the same `PUBLIC_API_BASE` (see §4.3 + the `deriveAllowNet` cross-link) — a stale build-bake would surface immediately as a Deno permission denial at request time, not as a silent CSP `connect-src` violation.

## 5. Qwik 2 beta deep dive

§5 captures the Qwik 2 beta.32 PoC findings that don't belong in the per-page perf tables (§1) or the cross-app architecture comparison (§3): which beta APIs the PoC actually used, the five beta-specific blockers it routed around, the irreducible ~136 KB framework runtime, and which findings get re-evaluated when Qwik 2 stable ships. The audit source of truth is `apps/qwik/docs/QWIK2_NOTES.md`; this section names what shipped and cites back to that audit for the bisect histories and call-site rationale.

### 5.1 Qwik 2 APIs in use

The PoC ships against `@qwik.dev/core ~2.0.0-beta.32` and `@qwik.dev/router 2.0.0-beta.32` (pin rationale: `apps/qwik/CLAUDE.md § Qwik-specific decisions`). The non-trivial beta APIs the app depends on:

| API                                                | Where used                                                            | Why this API                                                                                             | Source                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `useOnDocument('qvisible', $())`                   | embed components, `LivestreamPlayer.tsx`                              | Cross-island document-level listeners; QRL lazy-loads the handler off the visible-task chunk             | `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > APIs confirmed present` (line 128)         |
| `useVisibleTask$`                                  | web-vitals shim, live-blog/breaking-ticker polling                    | Once-on-visibility client init; suppressed `eslint-plugin-qwik/no-use-visible-task` for legitimate uses  | `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Divergences` item 6 (line 121)             |
| `useQwikRouter()` (replaces `<QwikCityProvider>`)  | `apps/qwik/src/root.tsx`                                              | Provider component is `@deprecated … removed in v3`; hook-form is the v2 pattern                         | `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Divergences` item 1 (line 116)             |
| `qwikRouter` vite plugin (renamed from `qwikCity`) | `apps/qwik/vite.config.ts`                                            | `qwikCity` is a deprecated alias scheduled for v3 removal                                                | `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Divergences` item 2 (line 117)             |
| `fetchPriority` JSX prop (camelCase only)          | LCP-critical `<img>`s                                                 | Qwik 2 beta typed only the camelCase form — lowercase `fetchpriority` would compile as untyped attribute | `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > APIs confirmed present` (line 129)         |
| Plain-function leaf components                     | `HeroCard`, `MostPopular`, `CuratedCollection`, `Footer`, `LiveBadge` | Convention: stateless leaves skip `component$` to avoid the per-call-site QRL boundary + chunk overhead  | `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Leaf component convention` (lines 131-133) |

**`useSerializer$` / `createSerializer$` — available, not exercised.** Confirmed present in `@qwik.dev/core/public.d.ts:125` (cited at `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > APIs confirmed present`, line 125). The v2 default change — loaders are no longer serialized to the client unless opted in — is documented at `apps/qwik/docs/ARCHITECTURE.md § Qwik 2 platform features in use` (line 64). The PoC's `routeLoader$` data is consumed in SSR and re-fetched on the client where polling is needed (live-blog, breaking-ticker — the `allowStale` blocker, 5.2 row 2), so no PoC use case required a custom client-side serializer. `grep -rn "useSerializer\$\|createSerializer\$" apps/qwik/src/` returns zero hits.

### 5.2 Beta blockers

Five beta-specific workarounds shipped during the PoC. None are app bugs; each is a missing or broken feature in the installed beta that the PoC routed around. Source landing site for all five: `apps/qwik/docs/QWIK2_NOTES.md § M12 Consolidated Audit > Beta blockers landed` (lines 9-18).

| #   | Blocker                     | What broke                                                                                                                                                | Workaround                                                                                                                                                                                                                     | Workaround call site                                                                                      | Detail source                                                                                                                                    |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Vite 7 pin                  | Vite 8 (current `latest`) ships rolldown; Qwik router SSR pass crashes at module collection (`Cannot read properties of undefined (reading 'concat')`)    | Pin `vite ^7.3.2` until rolldown shape change in `@qwik.dev/router/lib/vite/index.mjs` `collectServerFnModuleIds` is reconciled                                                                                                | `apps/qwik/package.json:35`                                                                               | `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Vite version pin — beta blocker` (lines 140-143)                                               |
| 2   | `allowStale` missing        | Architecture doc references `allowStale` for breaking-ticker / live-blog polling; beta.32 only exposes `serializationStrategy` (controls send, not stale) | Manual `setInterval` inside `useVisibleTask$` (`// allowStale … does not exist in beta.32` rationale comment lives above each call site)                                                                                       | `apps/qwik/src/components/LiveBlogUpdater.tsx:84`, `apps/qwik/src/components/BreakingTicker.tsx:28`       | `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Divergences` item 3 (line 118) + `§ sprint-009 live-blog polling`                              |
| 3   | `useVisibleTask$` test-hang | `createDOM()` does not bootstrap qwikLoader, so `useVisibleTask$` registers but never settles in unit tests (5s timeout, no DOM output)                   | Switch cross-island bootstrap to `useOnDocument('qvisible', $(...))`; component-level tests verify markup only, side-effect verification deferred to e2e                                                                       | `apps/qwik/src/test-utils/dom.ts` (`getByHeading` helper covers the same hang for testing-library compat) | `apps/qwik/docs/QWIK2_NOTES.md § sprint-007 > Beta friction encountered` items 1 + 3 (lines 91-98)                                               |
| 4   | CSP `'unsafe-inline'`       | Qwik 2 beta has no auto-hash equivalent to Astro's `scriptDirective`/`styleDirective`; without `'unsafe-inline'` styleSheets empty + qwikLoader throws    | `buildQwikCsp` allows `'unsafe-inline'` on both `script-src` and `style-src` (security-vs-functionality trade documented as PoC headline finding for §3 / §7 / §8)                                                             | `packages/shared-csp/index.ts:104-115`                                                                    | `apps/qwik/docs/QWIK2_NOTES.md § story-008 — CSP 'unsafe-inline' requirement` (lines 77-83)                                                      |
| 5   | Leaf-component convention   | `component$` wrapper introduces a Qrl serialization boundary + separate chunk per call site — pure overhead on stateless leaves against the JS budget     | Convention: stateless leaves (no signals, no `$()`-wrapped handlers, no `Slot`) use plain functions, not `component$` (exception: leaves rendered over reactive signal maps keep `component$` to preserve the reactive append) | `apps/qwik/src/components/{HeroCard,MostPopular,CuratedCollection,Footer,LiveBadge}.tsx`                  | `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > Leaf component convention` (lines 131-133) + `§ sprint-009 > What landed` item 2 (lines 51-54) |

### 5.3 Framework-floor cost (~136 KB)

The story-009 chunk-inventory bisect (homepage `156 → 171 KB` between sprint-006 and post-sprint-008) attributed every byte of the +15 KB regression to framework + router growth across the beta line — no reversible app-code culprit was found. The same bisect named the irreducible Qwik 2 beta.32 runtime cost:

| Chunk            | Size        | Role                                                        |
| ---------------- | ----------- | ----------------------------------------------------------- |
| `q-CqNq4nJT.js`  | ~102 KB     | Qwik core (resumability runtime, signal/task primitives)    |
| router + zod     | ~12 KB      | `@qwik.dev/router` user-surface API + zod (form validation) |
| router internals | ~7.4 KB     | server-fn collection, route-loader plumbing                 |
| `qwikLoader`     | ~4.9 KB     | qvisible/qinit/qclick listener bootstrap                    |
| preloader        | ~4.7 KB     | speculative chunk warmer                                    |
| `web-vitals`     | ~5.5 KB     | LCP/INP/CLS measurement shim                                |
| **Total**        | **~136 KB** | **framework cost before any app symbol**                    |

Source: `apps/qwik/docs/QWIK2_NOTES.md § M12 Consolidated Audit > Framework-floor characterization` (lines 19-23, totals) and `§ sprint-009 > What landed (this session)` item 1 (lines 53-54, chunk inventory with hashed IDs).

**Comparison anchor.** Qwik 1 stable (`qwik.dev`) ships the same `core` chunk at 54,680 B; Qwik 2 beta.32 measures 101,968 B — **+86% on the framework floor**. The growth is pre-stable: Qwik 2's size-optimization pass is unbuilt in beta. Source: same `Framework-floor characterization` block (line 23).

**Budget consequence.** The Qwik per-page JS budgets in `packages/perf-harness/cli_helpers.ts` were revised twice against this framework cost (homepage `<155 KB → <165 KB → <175 KB`; article `<150 KB → <155 KB → <168 KB`). The n=10 sweep at sprint-012 confirmed every revised anchor still holds with 1.5–9.7% headroom (full table: `apps/qwik/docs/QWIK2_NOTES.md § M12 Consolidated Audit > Budgets at n=10`, lines 35-43). Framework cost (~136 KB = 139,264 B) is ~77% of the homepage budget anchor (180,224 B = 176 KB); the leaf-component refactor (5.2 row 5) recovered −558 bytes / −4 chunks across four conversions — measured against the ~136 KB irreducible floor.

### 5.4 LH-Perf floor relaxation (cross-reference)

The full numeric breakdown of Qwik LH-Perf vs the stretch ≥98 budget — per-page n=10 medians and p95s, the `QWIK_LH_PERF_FLOOR = 80` calibration, and the SMM constraint `d77dd7b4007e` ("Stretch INP<=100ms applies to all targets; on miss accept honest failure or land per-target relaxation with measured numbers — never silently raise") — already lives at §1.7. §5 adds the bisect-history angle that §1.7 cross-references:

The qwik/index 5-run median **dropped from 85 to 81** between sprint-008 and sprint-009 closes despite **no homepage code changes**, attributable to framework-runtime drift in the beta line (sprint-009 split the `lhPerf` gate per-target at 85, then lowered the floor to 80 at sprint-009 capstone). Source: `apps/qwik/docs/QWIK2_NOTES.md § M12 Consolidated Audit > LH-Perf floor relaxation rationale` (lines 25-29) and `§ sprint-009 > What landed` item 4 (line 56).

### 5.5 Re-evaluate at Qwik 2 stable

Two classes of finding, per `apps/qwik/docs/QWIK2_NOTES.md § M12 Consolidated Audit > LH-Perf floor relaxation rationale` (line 29 — "Re-evaluate when Qwik 2 stable ships its size-optimization pass") and `§ sprint-009 > What landed` (line 56 — "Re-evaluate when Qwik 2 stable ships"):

| Finding                              | Class          | What re-evaluates                                                                                                    |
| ------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Vite 7 pin (5.2 #1)                  | Re-evaluate    | Test on each beta bump; fixed once `collectServerFnModuleIds` reconciles with rolldown's `ModuleInfo` shape          |
| `allowStale` missing (5.2 #2)        | Re-evaluate    | Drop the manual `setInterval` workaround if `allowStale` lands on `routeLoader$` / `AsyncSignal`                     |
| `useVisibleTask$` test-hang (5.2 #3) | Re-evaluate    | If qwikLoader bootstraps in `createDOM()`, cross-island side-effects become unit-testable                            |
| Framework-floor regression (5.3)     | Re-evaluate    | Re-measure chunk inventory + revisit per-page JS budgets in `cli_helpers.ts`                                         |
| LH-Perf 80 floor (5.4 / §1.7)        | Re-evaluate    | Re-measure n=10 LH-Perf and reconsider whether the floor stays at 80 or returns to the stretch ≥98                   |
| CSP `'unsafe-inline'` (5.2 #4)       | Likely persist | Strategic security-vs-functionality choice for Qwik 2's resumability container until an auto-hash story ships        |
| Leaf-component convention (5.2 #5)   | Likely persist | Pattern characterizes the QRL/serialization boundary cost, not a beta bug — reaffirm at stable, don't expect to drop |

The Qwik production-readiness recommendation in §7 / §8 is conditioned on the "re-evaluate" rows landing in Qwik 2 stable; the "likely persist" rows remain inputs to the verdict regardless of stable-ship status.

## 6. Ecosystem

§6 captures the surrounding-tooling story: what each app uses for testing, where the integration harness lives, what release channel the framework ships on, and where the canonical docs are sourced. The performance and architecture comparisons (§1, §3) stand independent of these choices; §6 is the surface a team adopting either framework reaches for next.

### 6.1 Testing toolchain

| Concern                               | Astro                                                                     | Qwik                                                                                                                                                                                                                                               | Source                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOM env                               | `happy-dom ^15.11.0`                                                      | `@qwik.dev/core/testing` (`createDOM()` from the Qwik runtime — does not bootstrap qwikLoader)                                                                                                                                                     | `apps/astro/package.json`, `apps/qwik/package.json`; `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > APIs confirmed present` (line 128)                   |
| Component testing                     | `@testing-library/preact ^3.2.4` (works against happy-dom out of the box) | **blocked** — `@testing-library/dom`'s `getByRole` requires `dom-accessibility-api` → `window.getComputedStyle`, which `createDOM()` doesn't expose; Qwik's `renderToString` SSR-mount workaround crashes inside vitest with a Symbol getter error | `apps/astro/package.json`; `apps/qwik/docs/QWIK2_NOTES.md § M7 article shell > Divergences` (lines 104-109)                                                 |
| Workaround                            | none required                                                             | custom `getByHeading(screen, level, name)` walks `screen.querySelectorAll('h${level}')` + `textContent` — catches `<h3>` → `<div>` regressions without the `@testing-library` dep                                                                  | `apps/qwik/src/test-utils/dom.ts`                                                                                                                           |
| `screen.querySelector` (no match)     | returns `null` (happy-dom standard) — assert with `toBeNull()`            | returns `undefined` (Qwik 2 beta.32 divergence from happy-dom) — must assert with `toBeFalsy()`                                                                                                                                                    | `apps/qwik/docs/QWIK2_NOTES.md § sprint-007 > Beta friction encountered` item 2 (line 95)                                                                   |
| Cross-island side-effect verification | unit-testable in happy-dom                                                | NOT unit-testable — `createDOM()` does not bootstrap qwikLoader, so `useOnDocument` / `useVisibleTask$` register but never settle (5 s timeout, no DOM output); side-effect verification deferred to e2e                                           | `apps/qwik/docs/QWIK2_NOTES.md § M3 scaffolding > APIs confirmed present` (line 128) + `§ sprint-007 > Beta friction encountered` items 1 + 3 (lines 91-98) |
| Test runner                           | `vitest ^2.1.0`                                                           | `vitest 4.1.5` — cold-start 6.3 s vs Astro 0.67 s (~9.4× delta)                                                                                                                                                                                    | `apps/astro/package.json`, `apps/qwik/package.json`; SMM risk `4573b5815a2f`                                                                                |

**Headline.** Astro's testing path is the standard Preact / happy-dom stack and works with no modifications. Qwik 2 beta.32 is on `@qwik.dev/core/testing` only — the `@testing-library/*` integration is empirically blocked, so the PoC ships a custom `getByHeading` helper at `apps/qwik/src/test-utils/dom.ts` and verifies cross-island side effects via e2e instead of unit tests. Both blockers stem from `createDOM()` being a Qwik-runtime DOM, not happy-dom — the WHY also lives at the top of `apps/qwik/src/test-utils/dom.ts` so future readers don't strip the helper as dead code.

### 6.2 Integration test harness

Both apps share `packages/perf-harness/` (puppeteer-core driving interactions, chrome-launcher providing the headless Chrome, Lighthouse running against the resulting interactive state, web-vitals collector capturing real-browser CWV). Identical methodology = the §1 numbers are apples-to-apples. The harness spawns each app via the same `spawn{Astro,Qwik}` functions that `scripts/demo-launch-{astro,qwik}.ts` use (so the demo and perf-harness boot byte-identical args), with the Qwik target on `:4456` and the Astro target on `:4455` so runs can parallelise.

The CSP-zero gate that asserts no real-browser violations (`packages/perf-harness/runner_e2e_test.ts`) is opt-in via `PERF_E2E=1` so the default `bun test` keeps the unit-test suite as the default loop (per SMM constraint on `perf:*` script gating). Sources: `packages/perf-harness/spawn.ts` (shared spawn functions); `packages/perf-harness/runner_e2e_test.ts` (CSP-zero pipeline gate); `apps/qwik/docs/QWIK2_NOTES.md § sprint-003 > Production-equivalent perf-harness path` (lines 151-187, methodology rationale).

### 6.3 Release-channel position

| Concern                     | Astro                                                | Qwik                                                                                                                                                                        | Source                                                                                                 |
| --------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Framework version           | Astro 6 (current stable `latest`)                    | `@qwik.dev/core ~2.0.0-beta.32` (release date unannounced)                                                                                                                  | `apps/astro/package.json`, `apps/qwik/package.json`; root `CLAUDE.md § Locked-in structural decisions` |
| Package scope               | `astro` (stable since v1.0)                          | `@qwik.dev/*` — **renamed** from `@builder.io/qwik` 1.x; new scope at v2 beta                                                                                               | `apps/qwik/CLAUDE.md § Qwik-specific decisions`                                                        |
| API verification discipline | release-notes summaries align with installed `.d.ts` | every Qwik 2 platform feature must be re-verified against `node_modules/@qwik.dev/core/*.d.ts` on each beta bump (release notes describe features that haven't yet shipped) | `apps/qwik/CLAUDE.md § Looking up Qwik 2 specifics`                                                    |
| Pin discipline              | `astro ^6` (caret, follows minor)                    | `@qwik.dev/core ~2.0.0-beta.32` (tilde, pins to beta — re-verify on every bump per SMM risk `5e27d0509507`)                                                                 | `apps/qwik/package.json`; SMM risks                                                                    |

### 6.4 Documentation source-of-truth

Neither framework hosts `llms.txt` / `llms-full.txt` (verified 2026-04 via root `CLAUDE.md § Looking up framework details`). For both, `gh api` against the docs source repo is the canonical fetch.

| Framework | Docs repo                                                    | Branch / path quirk                                                                                                                                  |
| --------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Astro     | `withastro/docs`, pages under `src/content/docs/en/`         | v6 migration at `guides/upgrade-to/v6.mdx`                                                                                                           |
| Qwik 2    | `QwikDev/qwik`, pages under `packages/docs/src/routes/docs/` | **`?ref=build/v2`** required — the `main` branch hosts Qwik 1 docs (`@builder.io/qwik`, route group `(qwikcity)`); v2 uses `(qwik)` + `(qwikrouter)` |

The Qwik branch quirk is not a soft preference — `?ref=main` returns docs for the wrong package. Source: root `CLAUDE.md § Looking up framework details` + `apps/qwik/CLAUDE.md § Conceptual / migration docs`.

## 7. Production readiness

§7 covers the production-deployment surface for both apps: the demo build/run experience, the runtime + sandboxing model per app, the deployment trade-offs that fall out of those choices, the M11 live-endpoint findings, and a per-app production-readiness verdict. The Qwik verdict is conditioned on the §5.5 "Re-evaluate vs Likely-persist" classification — §7 doesn't restate it, just inherits it.

### 7.1 Demo build/run experience

Both apps ship a one-line demo wrapper:

- `bun run demo:astro` → builds + invokes `scripts/demo-launch-astro.ts` → calls `spawnAstro('inherit')` from `packages/perf-harness/spawn.ts`
- `bun run demo:qwik` → builds + invokes `scripts/demo-launch-qwik.ts` → calls `spawnQwik('inherit')` from the same module

The wrappers exist only to forward signals (so Ctrl-C surfaces as SIGINT, not exit-0) and to swap `stdio: 'ignore'` (perf-harness default) for `stdio: 'inherit'` (operators see runtime logs). The actual spawn argv lives in `packages/perf-harness/spawn.ts` and is consumed by both the demo and the perf-harness — so the M11 demo and the §1 perf-harness sweep boot byte-identical args. Source: `docs/DEMO.md § Quick start` (lines 22-52); wrapper scripts at `scripts/demo-launch-astro.ts` and `scripts/demo-launch-qwik.ts`.

### 7.2 Deployment runtime — Astro / Deno

Astro 6 runs production SSR under Deno 2 via `@deno/astro-adapter ^0.4.0`. The runtime is sandboxed with three `--allow` flag families, all derived per-environment from `PUBLIC_API_BASE`:

- `--allow-net=${deriveAllowNet(apiBase, appPort)}` — host:port pairs derived from `PUBLIC_API_BASE` plus the local listen address. Validated through `assertSafeApiBase` to prevent CSP injection. Source: `packages/perf-harness/spawn.ts:75-86`.
- `--allow-read=apps/astro/dist` — Deno can only read the build output directory.
- `--allow-env=${ASTRO_ALLOWED_ENV}` — 11 audited environment variables (`NODE_ENV`, `NODE_DEBUG`, `ASTRO_INTERNAL_TEST_DISABLE_CONSOLE_FILTER`, `CI`, `NO_COLOR`, `FORCE_COLOR`, `TERM`, `PKG_CONFIG_PATH`, `SHARP_FORCE_GLOBAL_LIBVIPS`, `SHARP_IGNORE_GLOBAL_LIBVIPS`, `npm_package_config_libvips`), each with an inline rationale comment naming the consumer. Source: `packages/perf-harness/spawn.ts:57-69`.

The full argv builder is `buildAstroDenoArgv` at `packages/perf-harness/spawn.ts:92-103` — a single source of truth consumed by both `scripts/demo-launch-astro.ts` and the perf-harness, so M11 demo and §1 sweep boot byte-identical Deno invocations. Headline trade-off: any code path needing an unaudited env var or filesystem read outside `apps/astro/dist` is denied at boot with a Deno permission denial. Cross-reference §4.3 for the full Vite Env API → `PUBLIC_API_BASE` → CSP `connect-src` derivation chain.

### 7.3 Deployment runtime — Qwik / bun

Qwik 2 runs production SSR via `apps/qwik/server.ts` — a hand-rolled `node:http` wrapper around `entry.preview.js`, executed under bun (originally launched under `node --experimental-strip-types`; M0 swapped to bun to drop the nvm/Node toolchain dependency). The wrapper measures **154 lines** (`wc -l`) and exists for two reasons documented in its own header comment:

1. `entry.preview.js` exports `QwikRouterNodeMiddleware` (handlers, not a listening server), so it must be wrapped in an http server. Source: `apps/qwik/docs/QWIK2_NOTES.md § sprint-003 > Why a wrapper is required` (lines 151-169).
2. The bundled `staticFile` middleware resolves `static.root` against `apps/qwik/server/dist/...` instead of the actual `apps/qwik/dist/...`, so the wrapper hand-rolls static-file serving with a 14-row MIME table covering everything the current build emits. Verified empirically — `staticFile` returned 500 with `ENOENT: no such file or directory, open 'apps/qwik/server/dist/build/q-*.js'`. Source: `apps/qwik/server.ts` header comment.

No Deno-style sandboxing — bun runs with full filesystem / net / env access. Why not Deno: `@qwik.dev/router/middleware/deno` exists but using it would require a rewrite (Deno middleware uses Web-standard `Request → Response` instead of `(req, res, next)`) and the `staticFile` resolution bug above would recur. Source: `apps/qwik/docs/QWIK2_NOTES.md § sprint-003 > Why Node and not Deno` (lines 181-187). A separate constraint forces the CSP setting into `server.ts` rather than `vite.config.ts`: `apps/qwik/vite.config.ts` cannot `import { ... } from '@aje-poc/shared-csp'` because Vite's config loader uses Node's ESM loader, which doesn't handle `.ts` workspace-package entries. Source: `apps/qwik/docs/QWIK2_NOTES.md § post-sprint-007` (lines 69-75).

### 7.4 Deployment trade-off summary

| Concern              | Astro / Deno                                                                          | Qwik / bun                                                                                                                    | Source                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Sandbox              | narrow `--allow-net` + `--allow-read` + `--allow-env` (11 vars audited)               | none — bun has full host access                                                                                               | `packages/perf-harness/spawn.ts:57-100` vs `apps/qwik/server.ts`                                                          |
| CSP enforcement      | per-bundle script + style hashes via `scriptDirective` / `styleDirective` (auto-hash) | `'unsafe-inline'` on `script-src` + `style-src` — no auto-hash equivalent in Qwik 2 beta                                      | §3 (architecture) cross-ref + `apps/qwik/docs/QWIK2_NOTES.md § story-008 — CSP 'unsafe-inline' requirement` (lines 77-83) |
| Build-time env-bake  | `PUBLIC_API_BASE` flows through Vite → CSP `connect-src` baked once (§4.3)            | needs `scripts/demo-launch-qwik.ts` wrapper to keep `PUBLIC_API_BASE` matching at build + runtime per SMM risk `44b455b402fb` | `scripts/demo-launch-qwik.ts`                                                                                             |
| Wrapper LoC          | minimal — Deno spawns `dist/server/entry.mjs` directly                                | 154 lines (`wc -l`) — `node:http` adapter + 14-row MIME table for hand-rolled static-file serving                             | `packages/perf-harness/spawn.ts` vs `apps/qwik/server.ts` (header comment)                                                |
| Env-var failure mode | unaudited var → Deno permission denial at boot (visible)                              | unaudited var → silent (bun reads any env var)                                                                                | n/a                                                                                                                       |

### 7.5 M11 live-endpoint findings

Three discoveries from the M11 live-endpoint smoke test, captured in `docs/bug-reports/m11-live-endpoint-smoke.md`:

1. **F3 — Article slug rotation is operational, not a bug.** Featured articles rotate weekly on aljazeera.com; any live-acceptance suite must discover paths at runtime (e.g. `page.$$eval` on `/`) rather than hard-coding `KNOWN_LIVE_*_PATH` constants. Source: `docs/bug-reports/m11-live-endpoint-smoke.md § F3` + `docs/DEMO.md § Article slug rotation` (lines 76-82).

2. **F1 — Qwik liveblog 404 against live (resolved).** `apps/qwik/src/lib/liveblog-api.ts` originally sent `{ name: slug, preview: '' }` without `postType: 'liveblog'`; production returned `no_posts_found` with `data.article: null`. The Astro twin always sent `{ name: slug, postType: 'liveblog', preview: '' }` and resolved correctly. Fixed in commit `2c6882d` ahead of this sprint — `apps/qwik/src/lib/liveblog-api.ts:17` now sends `postType: 'liveblog'` with the rationale comment immediately above. Source: `docs/bug-reports/m11-live-endpoint-smoke.md § F1` (lines 62-74).

3. **CORS — zero PoC-side mitigation needed.** All GraphQL fires from the SSR runtime (Astro Deno or Qwik bun); the image proxy is same-origin in both apps. Server-to-server requests have no CORS surface. Source: `docs/bug-reports/m11-live-endpoint-smoke.md § CORS` + `docs/DEMO.md § CORS` (lines 99-110).

### 7.6 Production-readiness verdict

- **Astro 6.** Stable runtime channel; narrow Deno sandbox (§7.2); CSP auto-hash (§7.4); Fonts API delivered measured CLS = 0 across all five page-rows (§1.3.1); Lighthouse Performance held the stretch ≥ 98 across all five page-rows in the n=10 sweep (§1.3.1). M11 live-endpoint smoke surfaced no Astro-side blockers. **Verdict: production-ready** for the four page types measured.

- **Qwik 2 beta.32.** Production-readiness is **conditioned on Qwik 2 stable shipping**. Specifically conditioned on the §5.5 "Re-evaluate" rows landing at stable: Vite 7 pin, `allowStale`, `useVisibleTask$` test ergonomics, framework-floor regression (~136 KB pre-app, +86% vs Qwik 1), LH-Perf 80 floor (vs the stretch ≥ 98). The §5.5 "Likely persist" rows — CSP `'unsafe-inline'` and the leaf-component convention — remain inputs to the verdict regardless of stable-ship status. M11 surfaced one Qwik-specific app bug (F1, fixed pre-sprint at commit `2c6882d`). Until Qwik 2 stable ships and the "Re-evaluate" triggers are re-measured: **PoC-validated, not production-recommended.** Cross-reference §5.5 for the full re-evaluate-vs-persist classification that conditions this verdict.

## 8. Tradeoffs

_To be written by sprint-013 story-006 (capstone)._
