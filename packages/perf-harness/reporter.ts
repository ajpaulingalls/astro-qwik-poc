import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RawMetrics } from './lighthouse.ts';
import type { EnrichedMetric, SerializedCspViolation } from './web_vitals_collector.ts';

// Single source of truth for both runner.ts and throughput.ts; pinned by a
// reporter_test assertion so a file move can't silently desync the two CLIs.
// REPORTS_DIR_ENV override lets tests scope writes to a temp dir so committed
// reports/*.baseline.json are never touched by the test suite. Shared symbol
// keeps the env name typo-proof across the override and the consumer.
//
// REQUIRED PATTERN for new test files that import from this module: set
// process.env[REPORTS_DIR_ENV] to a temp path inside a `vi.hoisted(() => ...)`
// block BEFORE the import statement. REPORTS_DIR is captured at module init,
// so a test that imports without hoisting silently uses the committed
// `reports/` directory and may delete its contents. See `tests/runner_test.ts`
// for the canonical shape (vi.hoisted env setup + assertScopedReportsDir
// guard before any rmSync) — `tests/runner_e2e_test.ts` mirrors it.
export const REPORTS_DIR_ENV = 'PERF_REPORTS_DIR';
export const REPORTS_DIR =
  process.env[REPORTS_DIR_ENV] ?? resolve(dirname(fileURLToPath(import.meta.url)), 'reports');

// median/p95 both null iff n === 0 — the single missing signal (SMM concern be23cb2d0a70).
// p95 lands alongside median for stretch-CWV honesty: median + tail-latency shipped
// together (R type 7, see aggregator.percentile).
export interface AggregatedMetric {
  median: number | null;
  p95: number | null;
  n: number;
}

// Frozen so the missing-signal contract is unforgeable — used as both the
// runner.ts fallback and the test .toEqual reference; one mutation would
// silently corrupt every consumer.
export const MISSING_METRIC: AggregatedMetric = Object.freeze({
  median: null,
  p95: null,
  n: 0,
}) as AggregatedMetric;

export type MetricKey = keyof RawMetrics;

// `metrics.lcp` is Lighthouse-throttled (4G simulation) — what the lab reports.
// `webVitals.aggregated.lcp` is real-browser median — what real users experience.
// Both shipped together so M13 comparison is honest about which audience each number serves.
export interface AggregatedReport {
  page: string;
  target: string;
  // Operator-supplied --runs count. Tracked separately so MISSING denominators
  // stay accurate when a partial-failure path drives metric.n below it.
  runs: number;
  metrics: Record<MetricKey, AggregatedMetric>;
  webVitals: {
    samples: EnrichedMetric[];
    aggregated: { lcp: AggregatedMetric; inp: AggregatedMetric };
  };
  // Concatenation of every securitypolicyviolation event the collector
  // observed across the N runs of this page. Empty array means the listener
  // ran AND no violation fired — distinguishable from a missing listener
  // because tsc requires the field, so a runner.ts that forgot to populate
  // it would not compile.
  cspViolations: SerializedCspViolation[];
}

// Recursively sorts object keys for byte-stable JSON output (frozen-key contract:
// re-running an unchanged report must produce an identical file so PR diffs only
// reflect real metric changes, not key-order jitter).
export function sortKeys<T>(value: T): T {
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

export function formatJson<T>(value: T): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function formatMarkdown(report: AggregatedReport): string {
  const names = (Object.keys(report.metrics) as MetricKey[]).sort();
  const runs = report.runs;
  const nameWidth = Math.max(6, ...names.map((n) => n.length));
  const fmt = (v: number | null) => (v === null ? 'MISSING' : String(v));
  const medianStrings = names.map((name) => fmt(report.metrics[name].median));
  const p95Strings = names.map((name) => fmt(report.metrics[name].p95));
  const medianWidth = Math.max(6, ...medianStrings.map((s) => s.length));
  const p95Width = Math.max(3, ...p95Strings.map((s) => s.length));

  const lines: string[] = [];
  lines.push(`# perf report — ${report.target}/${report.page} (n=${runs})`);
  lines.push('');
  lines.push(
    `| ${'metric'.padEnd(nameWidth)} | ${'median'.padStart(medianWidth)} | ${'p95'.padStart(p95Width)} |`,
  );
  lines.push(`| ${'-'.repeat(nameWidth)} | ${'-'.repeat(medianWidth)} | ${'-'.repeat(p95Width)} |`);
  for (let i = 0; i < names.length; i++) {
    lines.push(
      `| ${names[i].padEnd(nameWidth)} | ${medianStrings[i].padStart(medianWidth)} | ${p95Strings[i].padStart(p95Width)} |`,
    );
  }
  lines.push('');
  lines.push(`web-vitals samples: ${report.webVitals.samples.length}`);
  // runs is the operator-supplied --runs count, the honest MISSING denominator.
  const aggLcp = report.webVitals.aggregated.lcp;
  if (aggLcp.n === 0) {
    lines.push(`real-browser lcp median: MISSING (0/${runs} runs)`);
  } else {
    lines.push(`real-browser lcp median: ${aggLcp.median}ms p95: ${aggLcp.p95}ms (n=${aggLcp.n})`);
  }
  // INP is single-source (no LH-throttled equivalent — Lighthouse INP is
  // field-only). The shim's onINP fires after collectWebVitals provokes a
  // keyboard.press('Tab'); MISSING here means the press → INP-fire path
  // didn't complete.
  const aggInp = report.webVitals.aggregated.inp;
  if (aggInp.n === 0) {
    lines.push(`real-browser inp median: MISSING (0/${runs} runs)`);
  } else {
    lines.push(`real-browser inp median: ${aggInp.median}ms p95: ${aggInp.p95}ms (n=${aggInp.n})`);
  }
  // className intentionally omitted — Tailwind class soup would bloat the line.
  const lcpElement = report.webVitals.samples.find((s) => s.lcpElement)?.lcpElement;
  if (lcpElement) {
    const id = lcpElement.id ? `#${lcpElement.id}` : '';
    const src = lcpElement.src ? ` ${lcpElement.src}` : '';
    lines.push(`lcp element: ${lcpElement.tagName}${id}${src}`);
  }
  // CSP violations counted across all N runs. Surfaced even when 0 — that
  // IS the audit signal SECURITY.md cites. Per-violation detail (directive,
  // blockedURI, sample) lives in the JSON cspViolations array; MD stays
  // a one-line summary so the report scans at a glance.
  lines.push(`csp violations: ${report.cspViolations.length} (across ${runs} runs)`);
  if (report.cspViolations.length > 0) {
    const summary = summarizeCspViolations(report.cspViolations);
    for (const line of summary) {
      lines.push(`  ${line}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

// Sentinel rendered when blockedURI is empty — matches the spec-defined
// empty-string case (inline scripts/styles where there's no URI to report).
// Tests reference this constant rather than the raw literal.
export const INLINE_BLOCKED_URI_LABEL = '(inline)';

// Group violations by (effectiveDirective, blockedURI) so a repeated
// directive/source pair counts as one MD line with a multiplier instead of
// flooding the report when the page repeatedly violates the same rule.
function summarizeCspViolations(violations: SerializedCspViolation[]): string[] {
  const counts = new Map<string, number>();
  for (const v of violations) {
    const key = `${v.effectiveDirective} ← ${v.blockedURI || INLINE_BLOCKED_URI_LABEL}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, n]) => `${key} × ${n}`);
}

export function formatReport(report: AggregatedReport): { json: string; markdown: string } {
  return { json: formatJson(report), markdown: formatMarkdown(report) };
}
