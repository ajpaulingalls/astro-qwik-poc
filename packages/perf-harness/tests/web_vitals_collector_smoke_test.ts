/**
 * Real-Chrome smoke test for collectWebVitals.
 *
 * Why: mock tests can't catch puppeteer/headless-Chrome runtime-contract
 * drift. Episode (commit fdcd718): collectWebVitals mock-passed but in
 * production produced no PerformanceEventTiming. This smoke test exercises
 * the connect → goto → waitForFunction(LCP) → page.evaluate path against
 * real headless Chrome, catching that whole chain.
 *
 * Scope: LCP only. INP requires the full web-vitals npm package machinery
 * (reportAllChanges, interactionId tracking) which only the real apps wire
 * up; INP coverage lives in acceptance.test.ts, which drives the built
 * apps end-to-end. Don't try to hand-roll INP here — it false-fails.
 *
 * Skipped by default (PERF_SMOKE=1 to enable). Run `bun run test:smoke`
 * from packages/perf-harness/.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { withChrome } from '../chrome.ts';
import { collectWebVitals } from '../web_vitals_collector.ts';

const SMOKE_ENABLED = process.env.PERF_SMOKE === '1';

// Minimal page: a large text block (guaranteed LCP-eligible in headless
// Chrome — data: URL images often don't emit LCP entries) + a hand-rolled
// LCP observer that mirrors the real apps' globalThis.__webVitals contract.
const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>smoke</title></head>
<body>
<h1 id="hero" style="font-size:96px;width:800px;color:#fa9000">Smoke test heading large enough to be the largest contentful paint</h1>
<script>
  globalThis.__webVitals = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      globalThis.__webVitals.push({ name: 'LCP', value: e.startTime, id: 'lcp', entries: [e] });
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });
</script>
</body></html>`;

describe.skipIf(!SMOKE_ENABLED)('collectWebVitals smoke (real Chrome)', () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(PAGE);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error(`server.address() returned ${typeof addr}; expected AddressInfo with port`);
    }
    url = `http://127.0.0.1:${addr.port}/`;
  });

  afterAll(async () => {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  });

  // INP wait may time out here (no full web-vitals shim) — collectWebVitals'
  // TimeoutError swallow is what makes this test resolve at all. So the test
  // also implicitly proves that swallow path against real Chrome.
  it('returns an LCP sample from real Chrome (puppeteer→CDP→PerformanceObserver chain)', async () => {
    const samples = await withChrome((port) => collectWebVitals(url, port));
    expect(samples.map((s) => s.name)).toContain('LCP');
  }, 15_000);
});
