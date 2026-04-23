import type { Metric } from 'web-vitals';
import type { RawMetrics } from './lighthouse.ts';

export interface AggregatedMetric {
  median: number;
  n: number;
}

export type MetricKey = keyof RawMetrics;

export interface AggregatedReport {
  page: string;
  target: string;
  metrics: Record<MetricKey, AggregatedMetric>;
  webVitals: { samples: Metric[] };
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
  const valueStrings = names.map((name) => String(report.metrics[name].median));
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
  lines.push('');
  return lines.join('\n');
}

export function formatReport(report: AggregatedReport): { json: string; markdown: string } {
  return { json: formatJson(report), markdown: formatMarkdown(report) };
}
