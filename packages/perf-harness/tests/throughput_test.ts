import { describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { parseDuration, runBench } from '../throughput.ts';

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
