# Performance Instrumentation — Cross-App Notes

Shared performance-measurement notes that apply identically to both the Astro and Qwik PoCs. Per-framework caveats live in `apps/<framework>/docs/ARCHITECTURE.md`; framework-agnostic methodology + measurement-honesty callouts live here so they don't drift between two copies.

## INP measurement divergence

> **Read before tuning interactive components.** Two distinct INP code paths exist today:
>
> 1. **Acceptance suite** (`packages/perf-harness/acceptance.ts`) measures a synthetic **click → DOM-mutation latency** budget (`SECTION_LOADMORE_LATENCY_BUDGET_MS = 500ms`). This is a pragmatic INP _proxy_ — the same UX semantic (user clicks, user sees the result) as INP but driven by puppeteer instead of `PerformanceObserver`. Synthetic puppeteer clicks don't reliably emit `event-timing` entries, so the proxy is the only viable signal in CI today.
> 2. **Real INP capture** is a future perf-harness item (deferred; see `acceptance.ts:84-90`). When `onINP` lands in the harness, it will measure the real Web Vital from `web-vitals` event-timing entries, separately from the click→mutation budget above.
>
> The M8 done-state names INP ≤ 100ms — that's the real-user metric the future perf-harness gate will enforce. The 500ms acceptance budget is a different, looser, synthetic check. Don't assume one number constrains the other; they instrument different things.

Applies to both apps. Each app's `ARCHITECTURE.md` cross-links here rather than restating.
