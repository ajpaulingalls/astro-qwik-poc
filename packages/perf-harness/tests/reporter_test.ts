import { describe, it, expect } from 'vitest';
import { formatReport, type AggregatedReport } from '../reporter.ts';

const fixture: AggregatedReport = {
  page: 'home',
  target: 'astro',
  metrics: {
    lcp: { median: 800, n: 5 },
    cls: { median: 0.001, n: 5 },
    inp: { median: 32, n: 5 },
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
        '    "inp": {',
        '      "median": 32,',
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
        '| inp     |     32 |',
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
    expect(Object.keys(parsed.metrics).sort()).toEqual(['cls', 'inp', 'jsBytes', 'lcp', 'lhPerf']);
    expect(parsed.metrics.lcp).toEqual({ median: 800, n: 5 });
  });
});
