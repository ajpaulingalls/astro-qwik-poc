# M-12 Validation — Final Performance Sign-off

This doc is the M-12 ("Final Performance Validation, both apps") sign-off and the input bundle index for M-13 (`docs/COMPARISON.md`). Every row in the table below maps to a criterion from the M-12 `done` field of `execution_plan.json`. All measured numbers come from the n=10 sweep run on 2026-04-30 against the mock-api at commit `0283066c09e` (env fingerprint, run parameters, and acceptance budgets in `packages/perf-harness/reports/RUN_NOTES.md`); the per-page reports themselves live in `packages/perf-harness/reports/{astro,qwik}-{page}{,-throughput}.json`.

## Sign-off table

| #   | Criterion                            | Status             | Measured                                                                                                                                                                                                                                                           | Evidence                                                                                                     |
| --- | ------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1   | n>=10 runs/page/app                  | PASS               | n=10 × 5 pages × 2 apps = 100 perf runs; 10 throughput invocations                                                                                                                                                                                                 | `packages/perf-harness/reports/RUN_NOTES.md` § Run parameters                                                |
| 2   | median + p95 for all CWV             | PASS               | Per-(target, page) medians + p95 for LH-Perf, CLS, real-LCP, real-INP, jsBytes — full table                                                                                                                                                                        | `packages/perf-harness/reports/RUN_NOTES.md` § Measured outcomes                                             |
| 3   | bundles within budgets               | PASS               | Astro 13 917–16 998 B / Qwik 176 237–182 038 B; every page under its anchor                                                                                                                                                                                        | `packages/perf-harness/cli_helpers.ts` (per-page anchors)                                                    |
| 4   | SSR throughput >50 req/s/page/app    | PASS               | Lowest qwik/index 65.2 req/s; Astro range 160.3–487.3; Qwik range 65.2–596.9; 0 errors over 31 197 total reqs                                                                                                                                                      | `packages/perf-harness/reports/RUN_NOTES.md` § SSR throughput                                                |
| 5   | Astro: zero CSP violations           | PASS               | `cspViolations: []` on every Astro page report × 5 pages × n=10; collector positive-control smoke green                                                                                                                                                            | `apps/astro/docs/SECURITY.md` § M12 Audit > Final CSP directive set                                          |
| 6   | Astro: Fonts CLS validation          | PASS               | CLS median = 0 / p95 = 0 across all 5 Astro page types (size-adjusted fallbacks via Astro 6 Fonts API)                                                                                                                                                             | `apps/astro/docs/SECURITY.md` § M12 Audit > Fonts API CLS validation                                         |
| 7   | Astro: `--allow` audit               | PASS               | Narrowest viable flags via `buildAstroDenoArgv`: `--allow-net=<derived>`, `--allow-read=apps/astro/dist`, `--allow-env=<11 vars>`; M11 demo path byte-identical                                                                                                    | `apps/astro/docs/SECURITY.md` § M12 Audit > Deno --allow audit; `packages/perf-harness/spawn.ts:57-69,92-99` |
| 8   | Qwik: zero HTML warnings             | PASS               | `bun run build:qwik` emits zero HTML-validation warnings on segmented ArticleBody output for all 4 embed-bearing fixture variants (russian-oil/Twitter, instagram, gallery, trump/Brightcove)                                                                      | `apps/qwik/docs/QWIK2_NOTES.md` § sprint-007 > Build verification                                            |
| 9   | Qwik: QWIK2_NOTES audit consolidated | PASS               | Beta-blockers (5), framework-floor characterization (~136 KB), LH-Perf floor relaxation rationale, and budgets-at-n=10 all consolidated in one audit section                                                                                                       | `apps/qwik/docs/QWIK2_NOTES.md` § M12 Consolidated Audit                                                     |
| 10  | All metrics at stretch column        | **HONEST-FAILURE** | Qwik LH-Perf medians 83 / 88.5 / 92 / 93 / 91 (n=10) vs stretch ≥98; floor relaxed to `QWIK_LH_PERF_FLOOR=80` per SMM `d77dd7b4007e` (no silent stretch raise). Every other stretch metric on every Qwik page passes; every Astro page passes every stretch metric | `apps/qwik/docs/QWIK2_NOTES.md` § M12 Consolidated Audit > LH-Perf floor relaxation rationale                |

## HONEST-FAILURE detail (row 10)

Per-page Qwik Lighthouse-Perf medians from the n=10 sweep (source: `packages/perf-harness/reports/qwik-{page}.json`, `metrics.lhPerf.median` / `.p95`; stretch ≥98 per `README.md` § stretch CWV):

| page          | LH-Perf median | LH-Perf p95 |
| ------------- | -------------- | ----------- |
| index         | 83             | 86          |
| article       | 88.5           | 90.55       |
| section-geo   | 92             | 95          |
| section-topic | 93             | 94.55       |
| liveblog      | 91             | 92.55       |

Cause and floor calibration: see `apps/qwik/docs/QWIK2_NOTES.md` § M12 Consolidated Audit > LH-Perf floor relaxation rationale. The relaxation is governed by SMM constraint `d77dd7b4007e` (no silent stretch raise — accept honest failure or land per-target relaxation with measured numbers).

## Closing — M-12 status

M-12 is **complete with documented partials**. Nine of ten criteria PASS; the all-stretch criterion is the sole HONEST-FAILURE (Qwik LH-Perf, see row 10 + section above). M-13 (`docs/COMPARISON.md`) may begin; this doc is its input bundle index.
