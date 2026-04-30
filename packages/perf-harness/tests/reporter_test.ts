import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  formatReport,
  INLINE_BLOCKED_URI_LABEL,
  MISSING_METRIC,
  REPORTS_DIR,
  type AggregatedReport,
} from '../reporter.ts';
import type { EnrichedMetric, SerializedCspViolation } from '../web_vitals_collector.ts';

describe('REPORTS_DIR', () => {
  it('resolves to packages/perf-harness/reports/', () => {
    // path.join uses the OS separator so the pin survives a Windows runner.
    expect(REPORTS_DIR.endsWith(join('packages', 'perf-harness', 'reports'))).toBe(true);
  });
});

const fixture: AggregatedReport = {
  page: 'home',
  target: 'astro',
  runs: 5,
  metrics: {
    lcp: { median: 800, p95: 850, n: 5 },
    cls: { median: 0.001, p95: 0.002, n: 5 },
    lhPerf: { median: 99, p95: 99, n: 5 },
    jsBytes: { median: 12345, p95: 13000, n: 5 },
  },
  webVitals: { samples: [], aggregated: { lcp: MISSING_METRIC, inp: MISSING_METRIC } },
  cspViolations: [],
};

describe('formatReport', () => {
  it('emits stable JSON with keys sorted at every level', () => {
    const { json } = formatReport(fixture);
    expect(json).toBe(
      [
        '{',
        '  "cspViolations": [],',
        '  "metrics": {',
        '    "cls": {',
        '      "median": 0.001,',
        '      "n": 5,',
        '      "p95": 0.002',
        '    },',
        '    "jsBytes": {',
        '      "median": 12345,',
        '      "n": 5,',
        '      "p95": 13000',
        '    },',
        '    "lcp": {',
        '      "median": 800,',
        '      "n": 5,',
        '      "p95": 850',
        '    },',
        '    "lhPerf": {',
        '      "median": 99,',
        '      "n": 5,',
        '      "p95": 99',
        '    }',
        '  },',
        '  "page": "home",',
        '  "runs": 5,',
        '  "target": "astro",',
        '  "webVitals": {',
        '    "aggregated": {',
        '      "inp": {',
        '        "median": null,',
        '        "n": 0,',
        '        "p95": null',
        '      },',
        '      "lcp": {',
        '        "median": null,',
        '        "n": 0,',
        '        "p95": null',
        '      }',
        '    },',
        '    "samples": []',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('emits stable Markdown with sorted metric names', () => {
    const { markdown } = formatReport(fixture);
    expect(markdown).toBe(
      [
        '# perf report — astro/home (n=5)',
        '',
        '| metric  | median |   p95 |',
        '| ------- | ------ | ----- |',
        '| cls     |  0.001 | 0.002 |',
        '| jsBytes |  12345 | 13000 |',
        '| lcp     |    800 |   850 |',
        '| lhPerf  |     99 |    99 |',
        '',
        'web-vitals samples: 0',
        'real-browser lcp median: MISSING (0/5 runs)',
        'real-browser inp median: MISSING (0/5 runs)',
        'csp violations: 0 (across 5 runs)',
        '',
      ].join('\n'),
    );
  });

  it('renders csp violations summary when non-empty (grouped + sorted)', () => {
    const violations: SerializedCspViolation[] = [
      {
        // blockedURI '' is the spec-defined inline case; the renderer
        // substitutes INLINE_BLOCKED_URI_LABEL via summarizeCspViolations.
        violatedDirective: "script-src 'self'",
        effectiveDirective: 'script-src',
        blockedURI: '',
        disposition: 'enforce',
        documentURI: 'http://localhost:8080/',
        sourceFile: 'http://localhost:8080/',
        lineNumber: 12,
        columnNumber: 4,
        sample: '',
      },
      {
        violatedDirective: "script-src 'self'",
        effectiveDirective: 'script-src',
        blockedURI: '',
        disposition: 'enforce',
        documentURI: 'http://localhost:8080/',
        sourceFile: 'http://localhost:8080/',
        lineNumber: 18,
        columnNumber: 4,
        sample: '',
      },
      {
        violatedDirective: "img-src 'self'",
        effectiveDirective: 'img-src',
        blockedURI: 'http://evil.example/pixel.gif',
        disposition: 'enforce',
        documentURI: 'http://localhost:8080/',
        sourceFile: 'http://localhost:8080/',
        lineNumber: 0,
        columnNumber: 0,
        sample: '',
      },
    ];
    const { markdown } = formatReport({ ...fixture, cspViolations: violations });
    expect(markdown).toContain('csp violations: 3 (across 5 runs)');
    expect(markdown).toContain('img-src ← http://evil.example/pixel.gif × 1');
    expect(markdown).toContain(`script-src ← ${INLINE_BLOCKED_URI_LABEL} × 2`);
  });

  it('is byte-identical for the same input across calls (determinism gate)', () => {
    const a = formatReport(fixture);
    const b = formatReport(fixture);
    expect(a.json).toBe(b.json);
    expect(a.markdown).toBe(b.markdown);
  });

  it('does not introduce keys not present in the input (no sortKeys data loss)', () => {
    const { json } = formatReport(fixture);
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed.metrics).sort()).toEqual(['cls', 'jsBytes', 'lcp', 'lhPerf']);
    expect(parsed.metrics.lcp).toEqual({ median: 800, p95: 850, n: 5 });
  });

  it('emits lcp element line in markdown when first sample has lcpElement', () => {
    const withLcp: AggregatedReport = {
      ...fixture,
      webVitals: {
        samples: [
          {
            name: 'LCP',
            value: 800,
            id: 'v3-1',
            delta: 800,
            entries: [],
            navigationType: 'navigate',
            rating: 'good',
            lcpElement: { tagName: 'IMG', id: 'hero-img', src: 'https://cdn.example/hero.jpg' },
          } as EnrichedMetric,
        ],
        aggregated: { lcp: MISSING_METRIC, inp: MISSING_METRIC },
      },
    };
    const { markdown } = formatReport(withLcp);
    expect(markdown).toContain('lcp element: IMG#hero-img https://cdn.example/hero.jpg');
  });

  it('omits lcp element line when no sample has lcpElement', () => {
    const { markdown } = formatReport(fixture);
    expect(markdown).not.toContain('lcp element:');
  });

  it('emits real-browser lcp median+p95 line in markdown when webVitals.aggregated.lcp present', () => {
    const withAgg: AggregatedReport = {
      ...fixture,
      webVitals: {
        samples: [],
        aggregated: {
          lcp: { median: 72, p95: 88, n: 10 },
          inp: { median: 18, p95: 24, n: 10 },
        },
      },
    };
    const { markdown } = formatReport(withAgg);
    expect(markdown).toContain('real-browser lcp median: 72ms p95: 88ms (n=10)');
    expect(markdown).toContain('real-browser inp median: 18ms p95: 24ms (n=10)');
  });

  it('includes webVitals.aggregated.lcp in JSON when present', () => {
    const withAgg: AggregatedReport = {
      ...fixture,
      webVitals: {
        samples: [],
        aggregated: {
          lcp: { median: 56.5, p95: 70.5, n: 10 },
          inp: { median: 22.5, p95: 30.5, n: 10 },
        },
      },
    };
    const { json } = formatReport(withAgg);
    const parsed = JSON.parse(json);
    expect(parsed.webVitals.aggregated.lcp).toEqual({ median: 56.5, p95: 70.5, n: 10 });
  });

  it('emits MISSING markdown line and preserves median+p95 null in JSON when aggregated.lcp.n === 0', () => {
    const withMissing: AggregatedReport = {
      ...fixture, // runs === 5 → denominator for "0/5 runs"
      webVitals: {
        samples: [],
        aggregated: { lcp: MISSING_METRIC, inp: MISSING_METRIC },
      },
    };
    const { markdown, json } = formatReport(withMissing);
    expect(markdown).toContain('real-browser lcp median: MISSING (0/5 runs)');
    expect(markdown).not.toContain('real-browser lcp median: null');
    const parsed = JSON.parse(json);
    expect(parsed.webVitals.aggregated.lcp).toEqual({ median: null, p95: null, n: 0 });
  });

  it('uses report.runs as MISSING denominator independent of metric n drift', () => {
    const driftReport: AggregatedReport = {
      ...fixture,
      runs: 7,
      metrics: {
        lcp: { median: 800, p95: 900, n: 3 }, // partial failure simulated
        cls: { median: 0.001, p95: 0.002, n: 5 },
        lhPerf: { median: 99, p95: 99, n: 5 },
        jsBytes: { median: 12345, p95: 13000, n: 5 },
      },
      webVitals: {
        samples: [],
        aggregated: { lcp: MISSING_METRIC, inp: MISSING_METRIC },
      },
    };
    const { markdown } = formatReport(driftReport);
    expect(markdown).toContain('# perf report — astro/home (n=7)');
    expect(markdown).toContain('real-browser lcp median: MISSING (0/7 runs)');
    expect(markdown).toContain('real-browser inp median: MISSING (0/7 runs)');
  });
});
