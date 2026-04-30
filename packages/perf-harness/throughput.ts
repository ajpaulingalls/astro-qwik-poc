import { percentile } from './aggregator.ts';
import { MISSING_METRIC, formatJson, type AggregatedMetric } from './reporter.ts';

export interface BenchOptions {
  url: string;
  durationMs: number;
  concurrency: number;
}

export interface BenchResult {
  totalRequests: number;
  errors: number;
  actualDurationSeconds: number;
  reqPerSecond: number;
  // Reuses AggregatedMetric: median is percentile(latencies, 0.5) per aggregator R7 invariant.
  latencyMs: AggregatedMetric;
}

export async function runBench(opts: BenchOptions): Promise<BenchResult> {
  const { url, durationMs, concurrency } = opts;
  const latencies: number[] = [];
  let totalRequests = 0;
  let errors = 0;
  const benchStart = Date.now();
  const deadline = benchStart + durationMs;

  async function attemptRequest(): Promise<void> {
    const reqStart = Date.now();
    totalRequests += 1;
    try {
      const res = await fetch(url);
      // Drain body before recording latency: keeps the socket reusable AND
      // ensures a mid-body throw routes to the error counter, not a phantom
      // success-with-latency.
      await res.arrayBuffer();
      if (res.ok) latencies.push(Date.now() - reqStart);
      else errors += 1;
    } catch {
      errors += 1;
    }
  }

  async function worker(): Promise<void> {
    while (Date.now() < deadline) {
      await attemptRequest();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const actualDurationSeconds = (Date.now() - benchStart) / 1000;
  const reqPerSecond = actualDurationSeconds > 0 ? totalRequests / actualDurationSeconds : 0;
  const n = latencies.length;
  const latencyMs: AggregatedMetric =
    n === 0
      ? MISSING_METRIC
      : { median: percentile(latencies, 0.5), p95: percentile(latencies, 0.95), n };
  return { totalRequests, errors, actualDurationSeconds, reqPerSecond, latencyMs };
}

export interface ThroughputReport {
  target: string;
  page: string;
  durationMs: number;
  concurrency: number;
  totalRequests: number;
  errors: number;
  actualDurationSeconds: number;
  reqPerSecond: number;
  latencyMs: AggregatedMetric;
}

export function formatThroughputJson(report: ThroughputReport): string {
  return formatJson(report);
}

export function formatThroughputMarkdown(report: ThroughputReport): string {
  const fmt = (v: number | null) => (v === null ? 'MISSING' : String(v));
  const rows: Array<[string, string]> = [
    ['target', report.target],
    ['page', report.page],
    ['durationMs', String(report.durationMs)],
    ['concurrency', String(report.concurrency)],
    ['actualDurationSeconds', String(report.actualDurationSeconds)],
    ['totalRequests', String(report.totalRequests)],
    ['errors', String(report.errors)],
    ['reqPerSecond', String(report.reqPerSecond)],
    ['latency p50 (ms)', fmt(report.latencyMs.median)],
    ['latency p95 (ms)', fmt(report.latencyMs.p95)],
    ['latency n', String(report.latencyMs.n)],
  ];
  const keyWidth = Math.max(...rows.map(([k]) => k.length));
  const valWidth = Math.max(...rows.map(([, v]) => v.length));
  const lines: string[] = [];
  lines.push(`# throughput — ${report.target}/${report.page}`);
  lines.push('');
  lines.push(
    '> Durations measured wall-clock; may overshoot --duration by up to one in-flight request.',
  );
  lines.push(
    '> --concurrency is the requested worker count; bun/undici keep-alive may cap actual concurrent sockets.',
  );
  lines.push('');
  lines.push(`| ${'metric'.padEnd(keyWidth)} | ${'value'.padEnd(valWidth)} |`);
  lines.push(`| ${'-'.repeat(keyWidth)} | ${'-'.repeat(valWidth)} |`);
  for (const [k, v] of rows) {
    lines.push(`| ${k.padEnd(keyWidth)} | ${v.padEnd(valWidth)} |`);
  }
  lines.push('');
  return lines.join('\n');
}

export function parseDuration(s: string): number {
  const match = /^([1-9]\d*)(ms|s)$/.exec(s);
  if (!match) {
    throw new Error(
      `invalid duration: ${JSON.stringify(s)} (expected positive integer with unit, e.g. "10s" or "500ms")`,
    );
  }
  const value = Number.parseInt(match[1], 10);
  return match[2] === 's' ? value * 1000 : value;
}
