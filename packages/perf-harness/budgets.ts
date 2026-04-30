// Per-page budget enforcement for the perf harness. checkBudgets returns the
// list of human-readable violation strings for a single page's aggregated
// report; the runner accumulates across pages and throws once at the end so
// reports always land on disk before the failure surfaces.
//
// LCP source is the real-browser median (`webVitals.aggregated.lcp`), not the
// Lighthouse-throttled value — stretch CWV is what real users experience.
// SMM constraint be23cb2d0a70 / dual-LCP honesty.
//
// Missing-data (median === null, n === 0) skips the check for that metric
// rather than failing — silent missing data is a separate concern, already
// surfaced by reporter MISSING markers.

import type { AggregatedReport } from './reporter.ts';
import type { Target } from './cli_helpers.ts';

export interface PageBudgets {
  /** Real-browser LCP median ceiling, milliseconds. */
  lcp?: number;
  /** Real-browser INP median ceiling, milliseconds. Provoked by the
   *  body-click probe in collectWebVitals; MISSING when the click → INP-fire
   *  path didn't complete (skipped per the LCP missing-data convention). */
  inp?: number;
  /** Lighthouse-throttled CLS median ceiling, unitless 0-1. */
  cls?: number;
  /** Lighthouse Performance score floor, 0-100. */
  lhPerf?: number;
  /** Total JS network transfer size median ceiling, bytes (compressed). */
  jsBytes?: number;
}

export function checkBudgets(
  report: AggregatedReport,
  budgets: PageBudgets | undefined,
  target: Target,
  pageName: string,
): string[] {
  if (!budgets) return [];
  const prefix = `[${target}/${pageName}]`;
  const violations: string[] = [];

  const lcp = report.webVitals.aggregated.lcp;
  if (budgets.lcp !== undefined && lcp.median !== null && lcp.median > budgets.lcp) {
    violations.push(`${prefix} real-browser LCP ${lcp.median}ms > budget ${budgets.lcp}ms`);
  }

  const inp = report.webVitals.aggregated.inp;
  if (budgets.inp !== undefined && inp.median !== null && inp.median > budgets.inp) {
    violations.push(`${prefix} real-browser INP ${inp.median}ms > budget ${budgets.inp}ms`);
  }

  const cls = report.metrics.cls;
  if (budgets.cls !== undefined && cls.median !== null && cls.median > budgets.cls) {
    violations.push(`${prefix} CLS ${cls.median} > budget ${budgets.cls}`);
  }

  const lhPerf = report.metrics.lhPerf;
  if (budgets.lhPerf !== undefined && lhPerf.median !== null && lhPerf.median < budgets.lhPerf) {
    violations.push(`${prefix} Lighthouse Perf ${lhPerf.median} < budget ${budgets.lhPerf}`);
  }

  const jsBytes = report.metrics.jsBytes;
  if (
    budgets.jsBytes !== undefined &&
    jsBytes.median !== null &&
    jsBytes.median > budgets.jsBytes
  ) {
    violations.push(`${prefix} JS ${jsBytes.median} bytes > budget ${budgets.jsBytes} bytes`);
  }

  return violations;
}
