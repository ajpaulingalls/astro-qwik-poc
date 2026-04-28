# Performance Targets — Cross-App Notes

Framework-agnostic performance acceptance targets shared by both the Astro and Qwik PoCs. Per-framework JS budgets and Core Web Vitals callouts live in each app's `docs/ARCHITECTURE.md` because they diverge per framework; SSR throughput and Lighthouse category scores are framework-agnostic and live here so the two ARCHITECTURE.md files don't have to keep them in sync.

## SSR Performance

| Metric             | Target                                 |
| ------------------ | -------------------------------------- |
| **Homepage TTFB**  | < 200ms (from mock API)                |
| **Article TTFB**   | < 150ms                                |
| **SSR throughput** | > 50 req/s per page type (single core) |

## Lighthouse Scores

| Category                | "Good" floor | **Stretch (target)** |
| ----------------------- | ------------ | -------------------- |
| Performance (Astro)     | ≥ 95         | **≥ 98**             |
| Performance (Qwik beta) | ≥ 85         | ≥ 85 (floor only)    |
| Accessibility           | ≥ 90         | ≥ 95                 |
| Best Practices          | ≥ 95         | ≥ 98                 |
| SEO                     | ≥ 95         | ≥ 98                 |

**Performance score is split per framework** (sprint-009): Astro pages hold the stretch ≥ 98; Qwik pages target the measured-realistic ≥ 85 floor because Qwik 2 beta.32 LH-throttled measures 83–90 — the framework runtime parse + chunk graph dominates the throttled-CPU critical path. See [`packages/perf-harness/cli_helpers.ts`](../packages/perf-harness/cli_helpers.ts) `QWIK_LH_PERF_FLOOR` and [`apps/qwik/docs/QWIK2_NOTES.md`](../apps/qwik/docs/QWIK2_NOTES.md) for the audit. The aspirational ≥ 98 target for Qwik returns when Qwik 2 stable ships.
