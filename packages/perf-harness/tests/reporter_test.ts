import { describe, it, expect } from 'vitest';
import { formatReport, type AggregatedReport } from '../reporter.ts';
import type { EnrichedMetric } from '../web_vitals_collector.ts';

const fixture: AggregatedReport = {
  page: 'home',
  target: 'astro',
  metrics: {
    lcp: { median: 800, n: 5 },
    cls: { median: 0.001, n: 5 },
    lhPerf: { median: 99, n: 5 },
    jsBytes: { median: 12345, n: 5 },
  },
  webVitals: { samples: [] },
};

describe('formatReport', () => {
  it('emits stable JSON with keys sorted at every level', () => {
    const { json } = formatReport(fixture);
    expect(json).toBe(
      [
        '{',
        '  "metrics": {',
        '    "cls": {',
        '      "median": 0.001,',
        '      "n": 5',
        '    },',
        '    "jsBytes": {',
        '      "median": 12345,',
        '      "n": 5',
        '    },',
        '    "lcp": {',
        '      "median": 800,',
        '      "n": 5',
        '    },',
        '    "lhPerf": {',
        '      "median": 99,',
        '      "n": 5',
        '    }',
        '  },',
        '  "page": "home",',
        '  "target": "astro",',
        '  "webVitals": {',
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
        '| metric  | median |',
        '| ------- | ------ |',
        '| cls     |  0.001 |',
        '| jsBytes |  12345 |',
        '| lcp     |    800 |',
        '| lhPerf  |     99 |',
        '',
        'web-vitals samples: 0',
        '',
      ].join('\n'),
    );
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
    expect(parsed.metrics.lcp).toEqual({ median: 800, n: 5 });
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
      },
    };
    const { markdown } = formatReport(withLcp);
    expect(markdown).toContain('lcp element: IMG#hero-img https://cdn.example/hero.jpg');
  });

  it('omits lcp element line when no sample has lcpElement', () => {
    const { markdown } = formatReport(fixture);
    expect(markdown).not.toContain('lcp element:');
  });
});
