# RUN_NOTES — Sprint-012 Story-003 + Story-004 (M-12 final perf validation + CSP audit)

## Methodology

This file captures the environment fingerprint and parameters used for the n=10 performance + SSR throughput sweep that produced every report in this directory. Reproducibility for M-13 (`docs/COMPARISON.md`) depends on the methodology constraints recorded below — measured numbers are honest only against the same harness, runtime versions, and machine class.

**Story-004 update (sprint-012, post-defer):** the perf-harness now ships a runtime CSP-violation collector (`packages/perf-harness/web_vitals_collector.ts`) that attaches a `securitypolicyviolation` listener via `page.evaluateOnNewDocument` BEFORE every navigation. Per-page violation arrays land in `reports/${target}-${page}.json:cspViolations`. The collector caught real violations in the first sweep; the audit-deliverable fixes (Astro inline-style sanitizer + Qwik build-env baking) shipped in commits `9b04f84`, `233aa8d`, `c731063` before this RUN_NOTES update.

**Reports are gitignored.** `packages/perf-harness/.gitignore` excludes `reports/`. The canonical n=10 reports here were force-added (`git add -f`) for M-13 input. New runs of `runner.ts` / `throughput.ts` will overwrite these files but won't appear in `git status` — use `git add -f <file>` to commit fresh measurements. Non-canonical artifacts (`*.baseline.json`, `*.lever1.json` from sprint-007/008) stay untracked.

## Environment fingerprint

- **Date**: 2026-04-30
- **Git commit at start of run**: `0283066c09e443614c558255835a3d6377b8a2f3` (branch: `ingallsp/story-003-perf-n10-matrix`)
- **OS**: Darwin 24.6.0 arm64 (macOS)
- **CPU**: Apple M1 Max
- **RAM**: 64 GB (68,719,476,736 bytes)
- **Node**: v20.19.0
- **Bun**: 1.3.13
- **Deno**: 2.6.9 (V8 14.5.201.2, TypeScript 5.9.2)
- **Chrome**: 147.0.7727.117 (system Google Chrome, attached via chrome-launcher)

## Run parameters

- **Perf runner** (`packages/perf-harness/runner.ts`): `--runs=10`, all 5 pages per target (`index, article, section-geo, section-topic, liveblog`), both targets (`astro, qwik`). Each run launches a fresh chrome-launcher Chrome, runs Lighthouse-throttled CWV measurement, then attaches puppeteer-core via CDP for the web-vitals collector (real-browser INP via Tab keypress per decision `d32efdb569e8`).
- **Throughput bench** (`packages/perf-harness/throughput.ts`): `--duration=10s --concurrency=4` per (target, page) invocation. 10 invocations total (5 pages × 2 targets). Each spawns mock-api + the target app via `packages/perf-harness/spawn.ts:spawnApp`/`spawnMockApi` and drives concurrent GETs against the page URL.

## Acceptance budgets in force

Per `packages/perf-harness/cli_helpers.ts`:

- **Stretch CWV (Astro routes)**: LCP ≤ 1500 ms, CLS ≤ 0.05, INP ≤ 100 ms, Lighthouse-Perf ≥ 98.
- **Qwik LH-Perf floor**: 80 (`QWIK_LH_PERF_FLOOR`). Stretch ≥ 98 unmeetable on `@qwik.dev/core` 2.0.0-beta.32 due to ~136 KB framework runtime irreducible on the beta line; floor accepts honest failure per SMM constraint `d77dd7b4007e` (no silent stretch raise).
- **Qwik CWV (LCP/CLS/INP)**: stretch budgets apply, same as Astro.
- **JS bundle anchors**: per-page byte budgets stay as published in `cli_helpers.ts` (Astro Article 30 KB / Liveblog 17 KB; Qwik Homepage 176 KB / Article 184 KB / Liveblog 184 KB / sections 176 KB).

## Measured outcomes (n=10)

### Core Web Vitals — Lighthouse-throttled lab + real-browser

LCP columns: `lab` is Lighthouse-throttled median; `real` is web-vitals collector median (puppeteer-core via CDP, Tab-keypress INP per decision `d32efdb569e8`). The acceptance gate uses `real` for LCP and `real` for INP — `lab` is recorded for honesty. Numbers reflect the **post-fix** sweep that sealed the audit deliverable; the original story-003 sweep numbers are preserved in git history under commit `fc5b41d`.

| target | page          | LH-Perf median | CLS median / p95 | LCP real median / p95 (ms) | INP real median / p95 (ms) | jsBytes (bytes) | CSP violations |
| ------ | ------------- | -------------- | ---------------- | -------------------------- | -------------------------- | --------------- | -------------- |
| astro  | index         | 100            | 0 / 0            | 76 / 88                    | 16 / 24                    | 13 917          | **0**          |
| astro  | article       | 100            | 0 / 0            | 52 / 56                    | 16 / 20                    | 13 917          | **0**          |
| astro  | section-geo   | 100            | 0 / 0            | 50 / 56                    | 16 / 24                    | 16 079          | **0**          |
| astro  | section-topic | 100            | 0 / 0            | 50 / 56                    | 16 / 16                    | 16 079          | **0**          |
| astro  | liveblog      | 100            | 0 / 0            | 46 / 56                    | 16 / 16                    | 16 951          | **0**          |
| qwik   | index         | 83             | 0 / 0            | 100 / 108                  | 16 / 24                    | 176 237         | **0**          |
| qwik   | article       | 88.5           | 0 / 0            | 58 / 64                    | 16 / 24                    | 176 237         | **0**          |
| qwik   | section-geo   | 92             | 0 / 0            | 48 / 56                    | 16 / 16                    | 176 237         | **0**          |
| qwik   | section-topic | 93             | 0 / 0            | 48 / 56                    | 16 / 20                    | 176 237         | **0**          |
| qwik   | liveblog      | 91             | 0 / 0            | 48 / 58                    | 16 / 20                    | 182 038         | **0**          |

**Stretch budget verdict (gate column = real-browser LCP, real-browser INP, CLS, LH-Perf, jsBytes, cspViolations):**

- **Astro**: every page passes every stretch metric. LH-Perf 100, CLS 0, real-LCP ≤ 76 ms (vs ≤ 1500 ms), real-INP ≤ 16 ms (vs ≤ 100 ms), jsBytes well under per-page anchors. **Zero CSP violations across all 5 pages × n=10 runs**, after `stripInlineStyles` shipped to ArticleBody + 5 embed components via the `safeInnerHTML` seam (commits `9b04f84`, `233aa8d`).
- **Qwik**: every page passes the floor (LH-Perf ≥ 80) and every CWV stretch (CLS, real-LCP, real-INP, jsBytes-anchor). Qwik LH-Perf range 83-93 stays inside the documented `QWIK_LH_PERF_FLOOR=80` band — stretch ≥ 98 unmeetable on `@qwik.dev/core` 2.0.0-beta.32 due to ~136 KB framework runtime irreducible (story-009 chunk inventory). This is the documented honest-failure per SMM constraint `d77dd7b4007e`, not a regression. Re-evaluate at Qwik 2 stable. **Zero CSP violations** after the perf-harness build-env fix (`PUBLIC_API_BASE=http://localhost:4456 bun run build:qwik`, commit `c731063`) — Qwik's CSP allows `'unsafe-inline'` for script-src/style-src per `buildQwikCsp` (`packages/shared-csp/index.ts:104-115`), so the only violation category that could fire was `connect-src`, which the build-env fix eliminated.

### SSR throughput — `--duration=10s --concurrency=4`

Acceptance bar: `req/s ≥ 50` per page. Every page clears the bar; lowest is `qwik/index` at 65.2 req/s.

| target | page | req/s | total reqs | errors | latency p50 (ms) | latency p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| astro | index         | 160.3  | 1606 | 0 | 23 | 34 |
| astro | article       | 248.4  | 2486 | 0 | 15 | 22 |
| astro | section-geo   | 487.3  | 4875 | 0 |  8 | 11 |
| astro | section-topic | 278.6  | 2789 | 0 | 14 | 19 |
| astro | liveblog      | 461.3  | 4618 | 0 |  9 | 11 |
| qwik  | index         |  65.2  |  654 | 0 | 63 | 70 |
| qwik  | article       | 162.9  | 1633 | 0 | 26 | 33 |
| qwik  | section-geo   | 596.9  | 5972 | 0 |  7 |  8 |
| qwik  | section-topic | 219.4  | 2197 | 0 | 17 | 24 |
| qwik  | liveblog      | 436.4  | 4367 | 0 |  9 | 12 |

Throughput skew is expected: the larger pages (article, index) do more SSR work per request, lowering req/s. The smaller pages (sections, liveblog) churn faster. No errors across 31,197 total requests.

### Honest-failure inventory

None for this run. Every Astro page meets every stretch budget. Every Qwik page meets every stretch budget except LH-Perf, which uses the documented `QWIK_LH_PERF_FLOOR=80` per SMM `d77dd7b4007e` — not silently raised, not a regression.

**Qwik jsBytes drift across the story-003 → story-004 re-runs.** The Qwik jsBytes medians moved between the original story-003 sweep (commit `fc5b41d`) and the story-004 post-fix re-run. Per-page deltas: index 177 431 → 176 237 (−0.67%), article 170 065 → 176 237 (+3.63%), section-geo 174 572 → 176 237 (+0.95%), section-topic 174 572 → 176 237 (+0.95%), liveblog 170 065 → 182 038 (+7.04%). Range therefore ~−1% to +7% — most pages within ±1%, two outliers (article, liveblog). All numbers stay under the published per-page anchors so no budget gate fires, but the liveblog +7% drift is real. Cause unverified — the same-length `4455`→`4456` literal swap shouldn't shift bundle bytes by that much on its own, so candidates beyond build-env baking include Qwik bundle-splitter non-determinism on beta.32, transitive dep updates between sweeps, or an interaction with the M0 collector wiring that altered chrome-launcher startup timing. Investigate before re-anchoring at sprint-013.

**Story-004 audit-deliverable surfaced and resolved 50+ real CSP issues during this iteration**:
- **Astro**: 53 `style-src-attr ← inline` violations (4 per article load × 10 runs + 1-2 per liveblog load × 10 runs) from CMS-rendered `style="..."` attributes on WordPress wp-caption divs and Brightcove embed containers. Fixed by sanitizing CMS HTML via `stripInlineStyles` before `dangerouslySetInnerHTML` at every site (1 ArticleBody + 5 embed components, all routed through the `safeInnerHTML` seam in `apps/astro/src/lib/safe-inner-html.ts`).
- **Qwik**: 50 `connect-src ← localhost:4455` violations (1 per page-load × 10 runs × 5 pages) from BreakingTicker poll fetching the Astro mock port instead of the Qwik mock port. Root cause: Qwik client bundle was built without `PUBLIC_API_BASE` set, so vite inlined `DEFAULT_API_BASE='http://localhost:4455'`. Fixed by passing `PUBLIC_API_BASE=http://localhost:4456` at build time in `perf:qwik` (matches the existing pattern in `apps/qwik/package.json`).

Both fixes were validated by re-running the full n=10 sweep with the collector active. The collector itself is regression-tested at the integration level by `packages/perf-harness/tests/web_vitals_collector_test.ts` (handler capture, call ordering) AND by a positive-control real-Chrome smoke (`tests/web_vitals_collector_smoke_test.ts`, PERF_SMOKE=1 gated) that serves a page with strict `img-src 'self'` CSP plus a deliberately-blocked external image. If the smoke goes silent, the SECURITY.md "zero violations observed" claim is unprovable.
