import type { RawMetrics } from './lighthouse.ts';
import type { EnrichedMetric } from './web_vitals_collector.ts';

// median is null iff n === 0 — the single missing signal (SMM concern be23cb2d0a70).
export interface AggregatedMetric {
  median: number | null;
  n: number;
}

export const MISSING_METRIC: AggregatedMetric = { median: null, n: 0 };

export type MetricKey = keyof RawMetrics;

// `metrics.lcp` is Lighthouse-throttled (4G simulation) — what the lab reports.
// `webVitals.aggregated.lcp` is real-browser median — what real users experience.
// Both shipped together so M13 comparison is honest about which audience each number serves.
export interface AggregatedReport {
  page: string;
  target: string;
  metrics: Record<MetricKey, AggregatedMetric>;
  webVitals: {
    samples: EnrichedMetric[];
    aggregated: { lcp: AggregatedMetric; inp: AggregatedMetric };
  };
}

function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sortKeys) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return sorted as unknown as T;
  }
  return value;
}

function formatJson(report: AggregatedReport): string {
  return JSON.stringify(sortKeys(report), null, 2);
}

function formatMarkdown(report: AggregatedReport): string {
  const names = (Object.keys(report.metrics) as MetricKey[]).sort();
  const n = names.length > 0 ? report.metrics[names[0]].n : 0;
  const nameWidth = Math.max(6, ...names.map((n) => n.length));
  const valueStrings = names.map((name) => {
    const m = report.metrics[name].median;
    return m === null ? 'MISSING' : String(m);
  });
  const valueWidth = Math.max(6, ...valueStrings.map((s) => s.length));

  const lines: string[] = [];
  lines.push(`# perf report — ${report.target}/${report.page} (n=${n})`);
  lines.push('');
  lines.push(`| ${'metric'.padEnd(nameWidth)} | ${'median'.padStart(valueWidth)} |`);
  lines.push(`| ${'-'.repeat(nameWidth)} | ${'-'.repeat(valueWidth)} |`);
  for (let i = 0; i < names.length; i++) {
    lines.push(`| ${names[i].padEnd(nameWidth)} | ${valueStrings[i].padStart(valueWidth)} |`);
  }
  lines.push('');
  lines.push(`web-vitals samples: ${report.webVitals.samples.length}`);
  const aggLcp = report.webVitals.aggregated.lcp;
  if (aggLcp.n === 0) {
    lines.push(`real-browser lcp median: MISSING (0/${report.metrics.lcp.n} runs)`);
  } else {
    lines.push(`real-browser lcp median: ${aggLcp.median}ms (n=${aggLcp.n})`);
  }
  // INP is single-source (no LH-throttled equivalent — Lighthouse INP is
  // field-only). The shim's onINP fires after collectWebVitals provokes a
  // body-click; MISSING here means the click → INP-fire path didn't complete.
  const aggInp = report.webVitals.aggregated.inp;
  if (aggInp.n === 0) {
    lines.push(`real-browser inp median: MISSING (0/${report.metrics.lcp.n} runs)`);
  } else {
    lines.push(`real-browser inp median: ${aggInp.median}ms (n=${aggInp.n})`);
  }
  // className intentionally omitted — Tailwind class soup would bloat the line.
  const lcpElement = report.webVitals.samples.find((s) => s.lcpElement)?.lcpElement;
  if (lcpElement) {
    const id = lcpElement.id ? `#${lcpElement.id}` : '';
    const src = lcpElement.src ? ` ${lcpElement.src}` : '';
    lines.push(`lcp element: ${lcpElement.tagName}${id}${src}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function formatReport(report: AggregatedReport): { json: string; markdown: string } {
  return { json: formatJson(report), markdown: formatMarkdown(report) };
}
