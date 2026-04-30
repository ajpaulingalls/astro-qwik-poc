import { percentile } from './aggregator.ts';
import { MISSING_METRIC, type AggregatedMetric } from './reporter.ts';

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
