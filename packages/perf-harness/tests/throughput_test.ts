import { describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import {
  parseDuration,
  runBench,
  formatThroughputJson,
  formatThroughputMarkdown,
  parseArgv,
  buildTargetUrl,
  type ThroughputReport,
} from '../throughput.ts';

async function startServer(
  handler: (count: number) => { status: number; body: string },
): Promise<{ url: string; close: () => Promise<void> }> {
  let count = 0;
  const server: Server = createServer((_req, res) => {
    count += 1;
    const { status, body } = handler(count);
    res.writeHead(status, { 'content-type': 'text/plain' });
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

describe('parseDuration', () => {
  it('parses seconds suffix', () => {
    expect(parseDuration('10s')).toBe(10_000);
    expect(parseDuration('2s')).toBe(2_000);
    expect(parseDuration('1s')).toBe(1_000);
  });

  it('parses milliseconds suffix', () => {
    expect(parseDuration('500ms')).toBe(500);
    expect(parseDuration('1ms')).toBe(1);
  });

  it('rejects empty string', () => {
    expect(() => parseDuration('')).toThrow(/duration/i);
  });

  it('rejects bare numbers without unit', () => {
    expect(() => parseDuration('10')).toThrow(/duration/i);
  });

  it('rejects unknown unit', () => {
    expect(() => parseDuration('10x')).toThrow(/duration/i);
  });

  it('rejects negative values', () => {
    expect(() => parseDuration('-5s')).toThrow(/duration/i);
  });

  it('rejects zero', () => {
    expect(() => parseDuration('0s')).toThrow(/duration/i);
  });
});

describe('runBench', () => {
  it('drives concurrent GETs against an in-process server and reports honest req/s + latency', async () => {
    const { url, close } = await startServer(() => ({ status: 200, body: 'ok' }));
    try {
      const concurrency = 4;
      const durationMs = 300;

      const result = await runBench({ url, durationMs, concurrency });

      expect(result.reqPerSecond).toBeCloseTo(
        result.totalRequests / result.actualDurationSeconds,
        10,
      );
      expect(result.totalRequests).toBeGreaterThanOrEqual(concurrency);
      expect(result.latencyMs.n).toBe(result.totalRequests);
      expect(result.errors).toBe(0);
      expect(result.latencyMs.median).not.toBeNull();
      expect(result.latencyMs.p95).not.toBeNull();
      expect(result.actualDurationSeconds * 1000).toBeGreaterThanOrEqual(durationMs);
    } finally {
      await close();
    }
  });

  it('counts non-2xx responses as errors and excludes them from latency aggregates', async () => {
    const { url, close } = await startServer((n) =>
      n % 2 === 0 ? { status: 500, body: 'fail' } : { status: 200, body: 'ok' },
    );
    try {
      const result = await runBench({ url, durationMs: 300, concurrency: 4 });

      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.errors).toBeGreaterThan(0);
      // Honest invariant: errored requests do not contribute to latency samples
      expect(result.latencyMs.n + result.errors).toBe(result.totalRequests);
      expect(result.latencyMs.median).not.toBeNull();
      expect(result.latencyMs.p95).not.toBeNull();
    } finally {
      await close();
    }
  });
});

const sampleReport: ThroughputReport = {
  target: 'astro',
  page: 'index',
  durationMs: 10_000,
  concurrency: 20,
  totalRequests: 521,
  errors: 0,
  actualDurationSeconds: 10.234,
  reqPerSecond: 50.91,
  latencyMs: { median: 38, p95: 67, n: 521 },
};

describe('formatThroughputJson', () => {
  it('emits sorted keys with 2-space indent (byte-stable)', () => {
    const out = formatThroughputJson(sampleReport);
    // sorted keys: actualDurationSeconds, concurrency, durationMs, errors, latencyMs, page, reqPerSecond, target, totalRequests
    const parsed = JSON.parse(out);
    expect(Object.keys(parsed)).toEqual([
      'actualDurationSeconds',
      'concurrency',
      'durationMs',
      'errors',
      'latencyMs',
      'page',
      'reqPerSecond',
      'target',
      'totalRequests',
    ]);
    // nested object also sorted
    expect(Object.keys(parsed.latencyMs)).toEqual(['median', 'n', 'p95']);
    // 2-space indent — first nested line begins with two spaces
    expect(out.split('\n')[1].startsWith('  ')).toBe(true);
    // round-trips exactly
    expect(parsed).toEqual({
      actualDurationSeconds: 10.234,
      concurrency: 20,
      durationMs: 10_000,
      errors: 0,
      latencyMs: { median: 38, n: 521, p95: 67 },
      page: 'index',
      reqPerSecond: 50.91,
      target: 'astro',
      totalRequests: 521,
    });
  });
});

describe('formatThroughputMarkdown', () => {
  it('includes target/page heading, honesty header, and metric table', () => {
    const md = formatThroughputMarkdown(sampleReport);
    expect(md).toContain('# throughput — astro/index');
    // honesty header documents wall-clock overshoot + keep-alive cap
    expect(md).toMatch(/wall-clock/i);
    expect(md).toMatch(/overshoot/i);
    expect(md).toMatch(/keep-alive/i);
    // table rows for the key metrics
    expect(md).toMatch(/reqPerSecond.*50\.91/);
    expect(md).toMatch(/totalRequests.*521/);
    expect(md).toMatch(/errors.*0/);
    expect(md).toMatch(/latency p50.*38/);
    expect(md).toMatch(/latency p95.*67/);
  });

  it('renders MISSING when latency aggregates are null (n=0)', () => {
    const allErrors: ThroughputReport = {
      ...sampleReport,
      totalRequests: 5,
      errors: 5,
      latencyMs: { median: null, p95: null, n: 0 },
    };
    const md = formatThroughputMarkdown(allErrors);
    expect(md).toMatch(/latency p50.*MISSING/);
    expect(md).toMatch(/latency p95.*MISSING/);
  });
});

describe('parseArgv', () => {
  it('parses all four required flags', () => {
    expect(
      parseArgv(['--target=astro', '--page=index', '--duration=10s', '--concurrency=20']),
    ).toEqual({
      target: 'astro',
      page: 'index',
      durationMs: 10_000,
      concurrency: 20,
    });
  });

  it('accepts qwik as a target', () => {
    const args = parseArgv([
      '--target=qwik',
      '--page=index',
      '--duration=500ms',
      '--concurrency=4',
    ]);
    expect(args.target).toBe('qwik');
    expect(args.durationMs).toBe(500);
  });

  it('rejects missing target', () => {
    expect(() => parseArgv(['--page=index', '--duration=10s', '--concurrency=20'])).toThrow(
      /target/i,
    );
  });

  it('rejects unknown target', () => {
    expect(() =>
      parseArgv(['--target=svelte', '--page=index', '--duration=10s', '--concurrency=20']),
    ).toThrow(/target/i);
  });

  it('rejects missing page', () => {
    expect(() => parseArgv(['--target=astro', '--duration=10s', '--concurrency=20'])).toThrow(
      /page/i,
    );
  });

  it('rejects missing duration', () => {
    expect(() => parseArgv(['--target=astro', '--page=index', '--concurrency=20'])).toThrow(
      /duration/i,
    );
  });

  it('rejects missing concurrency', () => {
    expect(() => parseArgv(['--target=astro', '--page=index', '--duration=10s'])).toThrow(
      /concurrency/i,
    );
  });

  it('rejects non-positive concurrency', () => {
    expect(() =>
      parseArgv(['--target=astro', '--page=index', '--duration=10s', '--concurrency=0']),
    ).toThrow(/concurrency/i);
  });
});

describe('buildTargetUrl', () => {
  it('builds an Astro URL on APP_PORT.astro for a known page', () => {
    const url = buildTargetUrl('astro', 'index');
    expect(url).toMatch(/^http:\/\/localhost:\d+\//);
    expect(url).toContain(':8080');
  });

  it('builds a Qwik URL on APP_PORT.qwik for a known page', () => {
    const url = buildTargetUrl('qwik', 'index');
    expect(url).toContain(':4173');
  });

  it('throws on unknown page name', () => {
    expect(() => buildTargetUrl('astro', 'nonexistent-page-xyz')).toThrow(/page/i);
  });
});
