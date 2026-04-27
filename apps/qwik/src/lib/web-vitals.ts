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
onINP(push, opts);
