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
import { startTestServer, type TestServerHandle } from '@aje-poc/shared-test-helpers';
import { withChrome } from '../chrome.ts';
import { collectWebVitals } from '../web_vitals_collector.ts';

const SMOKE_ENABLED = process.env.PERF_SMOKE === '1';

// Hand-rolled LCP observer that mirrors the real apps' globalThis.__webVitals
// contract. Single-sourced so the contract drift between the LCP smoke and
// the CSP positive control stays impossible.
const LCP_OBSERVER_SCRIPT = `<script>
  globalThis.__webVitals = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      globalThis.__webVitals.push({ name: 'LCP', value: e.startTime, id: 'lcp', entries: [e] });
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });
</script>`;

// Minimal page: a large text block (guaranteed LCP-eligible in headless
// Chrome — data: URL images often don't emit LCP entries) + the shared
// LCP observer.
const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>smoke</title></head>
<body>
<h1 id="hero" style="font-size:96px;width:800px;color:#fa9000">Smoke test heading large enough to be the largest contentful paint</h1>
${LCP_OBSERVER_SCRIPT}
</body></html>`;

describe.skipIf(!SMOKE_ENABLED)('collectWebVitals smoke (real Chrome)', () => {
  let handle: TestServerHandle;

  beforeAll(async () => {
    handle = await startTestServer(() => ({
      status: 200,
      body: PAGE,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }));
  });

  afterAll(async () => {
    await handle.close();
  });

  // INP wait may time out here (no full web-vitals shim) — collectWebVitals'
  // TimeoutError swallow is what makes this test resolve at all. So the test
  // also implicitly proves that swallow path against real Chrome.
  it('returns an LCP sample from real Chrome (puppeteer→CDP→PerformanceObserver chain)', async () => {
    const result = await withChrome((port) => collectWebVitals(handle.url, port));
    expect(result.samples.map((s) => s.name)).toContain('LCP');
  }, 15_000);
});

// Positive control for the CSP-violation collector. mock-only tests can't
// catch the failure mode where the listener silently no-ops in real Chrome
// (CDP race, evaluateOnNewDocument injection lost across navigation,
// browsing-context swap quirk). This test serves a page with a deliberately
// strict img-src 'self' CSP plus an external image; loads it through the
// real-Chrome collector; asserts the violation lands. If this test goes
// silent the SECURITY.md "zero violations observed" claim is unprovable.
const CSP_HEADER =
  "default-src 'self'; img-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";

// img-src 'self' blocks the external pixel and fires securitypolicyviolation.
// script-src 'self' 'unsafe-inline' lets the LCP observer below run so the
// collector's LCP wait resolves rather than timing out — that timeout would
// throw before we got to inspect cspViolations.
const CSP_VIOLATION_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>csp-positive-control</title></head>
<body>
<h1 id="hero" style="font-size:96px;width:800px;color:#fa9000">Heading large enough to be the LCP element</h1>
<img id="blocked-pixel" src="http://example.invalid/blocked.png" alt="csp-blocked" style="display:none">
${LCP_OBSERVER_SCRIPT}
</body></html>`;

describe.skipIf(!SMOKE_ENABLED)('CSP-violation collector positive control (real Chrome)', () => {
  let handle: TestServerHandle;

  beforeAll(async () => {
    handle = await startTestServer(() => ({
      status: 200,
      body: CSP_VIOLATION_PAGE,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': CSP_HEADER,
      },
    }));
  });

  afterAll(async () => {
    await handle.close();
  });

  it('captures the img-src violation fired by a deliberately-blocked external image', async () => {
    const result = await withChrome((port) => collectWebVitals(handle.url, port));
    // Listener actually attached AND saw the violation — the audit signal.
    expect(result.cspViolations.length).toBeGreaterThan(0);
    // The violation must name the directive that blocked the image. If
    // Chrome ever changes effectiveDirective to something other than
    // 'img-src' for this case, the positive control is the canary.
    const imgViolation = result.cspViolations.find((v) => v.effectiveDirective === 'img-src');
    expect(imgViolation).toBeDefined();
    expect(imgViolation!.blockedURI).toContain('example.invalid');
  }, 15_000);
});
