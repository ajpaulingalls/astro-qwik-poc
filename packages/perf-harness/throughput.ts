import type { ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { percentile } from './aggregator.ts';
import { MISSING_METRIC, REPORTS_DIR, formatJson, type AggregatedMetric } from './reporter.ts';
import { buildPageList, parseFlagMap, waitForPort, type Target } from './cli_helpers.ts';
import { spawnApp, spawnMockApi, killService, MOCK_API_PORT, APP_PORT } from './spawn.ts';

export interface BenchOptions {
  url: string;
  durationMs: number;
  concurrency: number;
}

/**
 * Result of a throughput bench run.
 *
 * Invariant: latencyMs.n + errors === totalRequests. Each started request
 * contributes to exactly one bucket — `latencyMs.n` for 2xx with a successful
 * body drain, `errors` for everything else (non-2xx, fetch throw, or
 * mid-body drain throw routed through the outer catch).
 */
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
    // totalRequests counts started attempts, not completed — a slow in-flight
    // fetch at the deadline is included so reqPerSecond stays consistent with
    // the wall-clock overshoot the MD report documents.
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

export interface ParsedThroughputArgs {
  target: Target;
  page: string;
  durationMs: number;
  concurrency: number;
}

export function parseArgv(argv: readonly string[]): ParsedThroughputArgs {
  const flags = parseFlagMap(argv);

  const target = flags.get('target');
  if (target !== 'astro' && target !== 'qwik') {
    throw new Error(`parseArgv: --target must be astro or qwik, got ${JSON.stringify(target)}`);
  }
  const page = flags.get('page');
  if (!page) throw new Error('parseArgv: --page=<name> is required');
  const duration = flags.get('duration');
  if (!duration) throw new Error('parseArgv: --duration=<e.g. 10s> is required');
  const concurrencyRaw = flags.get('concurrency');
  if (!concurrencyRaw) throw new Error('parseArgv: --concurrency=<positive int> is required');
  const concurrency = Number.parseInt(concurrencyRaw, 10);
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error(
      `parseArgv: --concurrency must be a positive integer, got ${JSON.stringify(concurrencyRaw)}`,
    );
  }
  return { target, page, durationMs: parseDuration(duration), concurrency };
}

export function buildTargetUrl(target: Target, pageName: string): string {
  const page = buildPageList(target).find((p) => p.name === pageName);
  if (!page) {
    const known = buildPageList(target)
      .map((p) => p.name)
      .join(', ');
    throw new Error(
      `buildTargetUrl: unknown page "${pageName}" for target ${target}. Known: ${known}`,
    );
  }
  return `http://localhost:${APP_PORT[target]}${page.path}`;
}

export async function main(argv: readonly string[]): Promise<void> {
  const args = parseArgv(argv);
  const url = buildTargetUrl(args.target, args.page);
  const mockApi = spawnMockApi(args.target);
  let app: ChildProcess | null = null;

  // SIGINT/SIGTERM handler: a long bench interrupted with Ctrl-C must release
  // ports 4455/4456 + 8080/4173 or the next run fails to bind. The handler
  // body awaits killService to completion before exit(130), so the conventional
  // "interrupted" code reaches the parent shell after the children are reaped.
  const onSignal = async (signal: NodeJS.Signals) => {
    process.stderr.write(`\nthroughput: received ${signal}, cleaning up...\n`);
    if (app) await killService(app);
    await killService(mockApi);
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    await waitForPort(MOCK_API_PORT[args.target], { timeoutMs: 30_000 });
    app = spawnApp(args.target);
    await waitForPort(APP_PORT[args.target], { timeoutMs: 60_000 });

    const result = await runBench({
      url,
      durationMs: args.durationMs,
      concurrency: args.concurrency,
    });

    const report: ThroughputReport = {
      target: args.target,
      page: args.page,
      durationMs: args.durationMs,
      concurrency: args.concurrency,
      totalRequests: result.totalRequests,
      errors: result.errors,
      actualDurationSeconds: result.actualDurationSeconds,
      reqPerSecond: result.reqPerSecond,
      latencyMs: result.latencyMs,
    };

    mkdirSync(REPORTS_DIR, { recursive: true });
    const stem = path.join(REPORTS_DIR, `${args.target}-${args.page}-throughput`);
    writeFileSync(`${stem}.json`, formatThroughputJson(report));
    writeFileSync(`${stem}.md`, formatThroughputMarkdown(report));
    process.stdout.write(`wrote ${stem}.json + ${stem}.md\n`);
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    if (app) await killService(app);
    await killService(mockApi);
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`throughput: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
