import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

declare global {
  // eslint-disable-next-line no-var
  var __webVitals: Metric[];
}

globalThis.__webVitals = [];

const push = (m: Metric): void => {
  globalThis.__webVitals.push(m);
};

onLCP(push);
onCLS(push);
onINP(push);
