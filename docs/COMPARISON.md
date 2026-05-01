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

_To be written by sprint-013 story-004._

## 6. Ecosystem

_To be written by sprint-013 story-005._

## 7. Production readiness

_To be written by sprint-013 story-005._

## 8. Tradeoffs

_To be written by sprint-013 story-006 (capstone)._
