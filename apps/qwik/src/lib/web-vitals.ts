import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

declare global {
  var __webVitals: Metric[];
}

globalThis.__webVitals = [];

const push = (m: Metric): void => {
  globalThis.__webVitals.push(m);
};

const opts = { reportAllChanges: true };
onLCP(push, opts);
onCLS(push, opts);
// durationThreshold:0 — the web-vitals default of 40ms drops fast
// interactions (e.g. perf-harness's keyboard.press('Tab') probe with no
// handler) from the underlying PerformanceObserver, leaving INP never to
// fire. Capture every interaction event; INP itself still picks the slowest.
onINP(push, { ...opts, durationThreshold: 0 });
