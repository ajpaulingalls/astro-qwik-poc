import { describe, it, expect } from 'vitest';
import { checkBudgets, type PageBudgets } from '../budgets.ts';
import { MISSING_METRIC, type AggregatedReport } from '../reporter.ts';

function reportFixture(overrides: Partial<AggregatedReport['metrics']> = {}): AggregatedReport {
  return {
    page: 'index',
    target: 'astro',
    metrics: {
      lcp: { median: 800, n: 5 },
      cls: { median: 0.02, n: 5 },
      lhPerf: { median: 99, n: 5 },
      jsBytes: { median: 10000, n: 5 },
      ...overrides,
    },
    webVitals: {
      samples: [],
      aggregated: { lcp: { median: 1200, n: 5 }, inp: MISSING_METRIC },
    },
  };
}

describe('checkBudgets', () => {
  it('returns no violations when budgets are undefined', () => {
    expect(checkBudgets(reportFixture(), undefined, 'astro', 'index')).toEqual([]);
  });

  it('returns no violations when all metrics are within budget', () => {
    const budgets: PageBudgets = { lcp: 1500, cls: 0.05, lhPerf: 98, jsBytes: 30 * 1024 };
    expect(checkBudgets(reportFixture(), budgets, 'astro', 'index')).toEqual([]);
  });

  it('reports a violation when real-browser LCP exceeds budget', () => {
    const r = reportFixture();
    r.webVitals.aggregated.lcp = { median: 2000, n: 5 };
    const v = checkBudgets(r, { lcp: 1500 }, 'astro', 'index');
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('LCP 2000ms');
    expect(v[0]).toContain('1500ms');
    expect(v[0]).toContain('[astro/index]');
  });

  it('reports a violation when real-browser INP exceeds budget', () => {
    const r = reportFixture();
    r.webVitals.aggregated.inp = { median: 150, n: 5 };
    const v = checkBudgets(r, { inp: 100 }, 'qwik', 'liveblog');
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('INP 150ms');
    expect(v[0]).toContain('100ms');
    expect(v[0]).toContain('[qwik/liveblog]');
  });

  it('skips INP check when real-browser median is null (missing data)', () => {
    const r = reportFixture();
    // Fixture default already has inp: MISSING_METRIC.
    const v = checkBudgets(r, { inp: 100 }, 'astro', 'index');
    expect(v).toEqual([]);
  });

  it('reports a violation when CLS exceeds budget', () => {
    const v = checkBudgets(
      reportFixture({ cls: { median: 0.1, n: 5 } }),
      { cls: 0.05 },
      'qwik',
      'article',
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('CLS 0.1');
    expect(v[0]).toContain('budget 0.05');
    expect(v[0]).toContain('[qwik/article]');
  });

  it('reports a violation when Lighthouse Perf falls below budget', () => {
    const v = checkBudgets(
      reportFixture({ lhPerf: { median: 90, n: 5 } }),
      { lhPerf: 98 },
      'qwik',
      'index',
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('Lighthouse Perf 90');
    expect(v[0]).toContain('< budget 98');
  });

  it('reports a violation when jsBytes exceeds budget', () => {
    const v = checkBudgets(
      reportFixture({ jsBytes: { median: 200_000, n: 5 } }),
      { jsBytes: 155 * 1024 },
      'qwik',
      'article',
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('JS 200000 bytes');
    expect(v[0]).toContain(`budget ${155 * 1024} bytes`);
  });

  it('aggregates multiple violations in a single report', () => {
    const r = reportFixture({
      cls: { median: 0.2, n: 5 },
      lhPerf: { median: 80, n: 5 },
      jsBytes: { median: 999_999, n: 5 },
    });
    r.webVitals.aggregated.lcp = { median: 2500, n: 5 };
    const v = checkBudgets(
      r,
      { lcp: 1500, cls: 0.05, lhPerf: 98, jsBytes: 30 * 1024 },
      'astro',
      'article',
    );
    expect(v).toHaveLength(4);
  });

  it('skips a metric whose budget field is undefined', () => {
    const v = checkBudgets(
      reportFixture({ jsBytes: { median: 999_999, n: 5 } }),
      { lcp: 1500 },
      'astro',
      'index',
    );
    expect(v).toEqual([]);
  });

  it('skips LCP check when real-browser median is null (missing data)', () => {
    const r = reportFixture();
    r.webVitals.aggregated.lcp = { median: null, n: 0 };
    const v = checkBudgets(r, { lcp: 1500 }, 'astro', 'index');
    expect(v).toEqual([]);
  });

  it('skips other-metric check when their median is null', () => {
    const v = checkBudgets(
      reportFixture({ cls: { median: null, n: 0 } }),
      { cls: 0.05 },
      'astro',
      'index',
    );
    expect(v).toEqual([]);
  });
});
