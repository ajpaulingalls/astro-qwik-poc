import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeoutError } from 'puppeteer-core';

const { connectMock, browserMock, pageMock } = vi.hoisted(() => {
  const keyboardMock = { press: vi.fn() };
  const pageMock = {
    goto: vi.fn(),
    waitForFunction: vi.fn(),
    keyboard: keyboardMock,
    evaluate: vi.fn(),
    close: vi.fn(),
    exposeFunction: vi.fn(),
    evaluateOnNewDocument: vi.fn(),
  };
  const browserMock = {
    newPage: vi.fn(async () => pageMock),
    disconnect: vi.fn(),
  };
  const connectMock = vi.fn(async () => browserMock);
  return { connectMock, browserMock, pageMock };
});

vi.mock('puppeteer-core', async () => {
  // Re-export the real TimeoutError class so production-code instanceof checks
  // work in tests; only the default export's connect method is faked.
  const actual = await vi.importActual<typeof import('puppeteer-core')>('puppeteer-core');
  return {
    default: { connect: connectMock },
    TimeoutError: actual.TimeoutError,
  };
});

import { collectWebVitals, type SerializedCspViolation } from '../web_vitals_collector.ts';

describe('collectWebVitals', () => {
  beforeEach(() => {
    pageMock.goto.mockReset();
    // Default to a resolved promise — collectWebVitals chains .catch on the
    // INP wait, which would explode on undefined.
    pageMock.waitForFunction.mockReset().mockResolvedValue(undefined);
    pageMock.keyboard.press.mockReset();
    pageMock.evaluate.mockReset();
    pageMock.close.mockReset();
    pageMock.exposeFunction.mockReset().mockResolvedValue(undefined);
    pageMock.evaluateOnNewDocument.mockReset().mockResolvedValue(undefined);
    browserMock.newPage.mockClear();
    browserMock.disconnect.mockClear();
    connectMock.mockClear();
  });

  it('connects to chrome on the given port and returns evaluated samples', async () => {
    pageMock.evaluate.mockResolvedValueOnce([
      { name: 'LCP', value: 800 },
      { name: 'CLS', value: 0.001 },
    ]);

    const result = await collectWebVitals('http://localhost:8080/', 9876);

    expect(connectMock).toHaveBeenCalledWith({ browserURL: 'http://127.0.0.1:9876' });
    expect(pageMock.goto).toHaveBeenCalledWith(
      'http://localhost:8080/',
      expect.objectContaining({ waitUntil: 'networkidle2' }),
    );
    expect(result.samples).toEqual([
      { name: 'LCP', value: 800 },
      { name: 'CLS', value: 0.001 },
    ]);
    // No violation events fired during this navigation → empty array.
    expect(result.cspViolations).toEqual([]);
  });

  it('presses Tab between the LCP wait and the INP wait', async () => {
    pageMock.evaluate.mockResolvedValueOnce([]);
    await collectWebVitals('http://localhost:8080/', 9876);
    expect(pageMock.keyboard.press).toHaveBeenCalledWith('Tab');
    // INP can only fire AFTER an interaction. The runtime contract is
    // strict: wait-LCP, press Tab, wait-INP. Asserting both bounds catches
    // a refactor that moves the press below both waits — that would
    // mock-pass with only a one-sided check but timeout in production
    // because the INP wait would never resolve. Synthetic puppeteer mouse
    // clicks (page.click, page.mouse.click) don't generate event-timing
    // entries in headless Chrome; keyboard.press('Tab') does.
    const [firstWait, secondWait] = pageMock.waitForFunction.mock.invocationCallOrder;
    const [press] = pageMock.keyboard.press.mock.invocationCallOrder;
    expect(press).toBeGreaterThan(firstWait);
    expect(press).toBeLessThan(secondWait);
  });

  it('waits twice (LCP then INP) before returning', async () => {
    pageMock.evaluate.mockResolvedValueOnce([]);
    await collectWebVitals('http://localhost:8080/', 9876);
    // Two waitForFunction calls: first LCP arrival, second INP arrival.
    // Discriminating which metric each call waits for would require
    // matching the predicate's source string — brittle to bundler /
    // minification transforms. The runner aggregation tests (next chunk)
    // will fail loudly if INP samples never arrive.
    expect(pageMock.waitForFunction).toHaveBeenCalledTimes(2);
  });

  it('returns the page-evaluated samples (empty array fallback handled in-page)', async () => {
    pageMock.evaluate.mockResolvedValueOnce([]);
    const result = await collectWebVitals('http://localhost:8080/', 9876);
    expect(result.samples).toEqual([]);
    expect(result.cspViolations).toEqual([]);
  });

  it('disconnects browser even if waitForFunction throws (timeout)', async () => {
    pageMock.waitForFunction.mockRejectedValueOnce(new Error('TimeoutError'));

    await expect(collectWebVitals('http://localhost:8080/', 9876)).rejects.toThrow(/TimeoutError/);
    expect(browserMock.disconnect).toHaveBeenCalled();
  });

  it('swallows INP-wait timeout so LCP samples still surface (MISSING aggregator path)', async () => {
    // INP is enrichment on top of LCP; an INP-wait timeout must not lose
    // the LCP samples we already captured. Aggregator handles MISSING.
    pageMock.waitForFunction
      .mockResolvedValueOnce(undefined) // LCP wait succeeds
      .mockRejectedValueOnce(new TimeoutError('5000ms exceeded')); // INP wait times out
    pageMock.evaluate.mockResolvedValueOnce([{ name: 'LCP', value: 800 }]);

    const result = await collectWebVitals('http://localhost:8080/', 9876);

    expect(result.samples).toEqual([{ name: 'LCP', value: 800 }]);
    expect(browserMock.disconnect).toHaveBeenCalled();
  });

  it('re-throws non-timeout errors from the INP wait (page crash, browser disconnect)', async () => {
    // Narrow catch: only TimeoutError is enrichment-can-fail. Other errors
    // would mean the page is degraded, so honest failure beats silent partial data.
    pageMock.waitForFunction
      .mockResolvedValueOnce(undefined) // LCP wait succeeds
      .mockRejectedValueOnce(new Error('Target closed')); // not a TimeoutError

    await expect(collectWebVitals('http://localhost:8080/', 9876)).rejects.toThrow(/Target closed/);
    expect(browserMock.disconnect).toHaveBeenCalled();
  });

  it('closes the page before returning', async () => {
    pageMock.evaluate.mockResolvedValueOnce([]);
    await collectWebVitals('http://localhost:8080/', 9876);
    expect(pageMock.close).toHaveBeenCalled();
  });

  it('captures CSP violations bridged via the exposed function', async () => {
    // Behavior, not implementation: capture the handler the collector
    // hands to exposeFunction (the Node-side bridge that page-side
    // securitypolicyviolation listeners call into), invoke it twice
    // mid-flow with synthetic violation objects, and assert both land
    // in the returned cspViolations array. This pins the Node-side
    // accumulation contract without coupling to the page-side script
    // text — that lives in the M0d real-Chrome smoke test.
    const synthetic1: SerializedCspViolation = {
      violatedDirective: "script-src 'self'",
      effectiveDirective: 'script-src',
      blockedURI: '',
      disposition: 'enforce',
      documentURI: 'http://localhost:8080/',
      sourceFile: 'http://localhost:8080/',
      lineNumber: 12,
      columnNumber: 4,
      sample: '',
    };
    const synthetic2: SerializedCspViolation = {
      violatedDirective: "img-src 'self'",
      effectiveDirective: 'img-src',
      blockedURI: 'http://evil.example/pixel.gif',
      disposition: 'enforce',
      documentURI: 'http://localhost:8080/',
      sourceFile: 'http://localhost:8080/',
      lineNumber: 0,
      columnNumber: 0,
      sample: '',
    };
    let bridgeName: string | undefined;
    let capturedHandler: ((v: SerializedCspViolation) => void) | undefined;
    pageMock.exposeFunction.mockImplementation((name: string, handler: unknown) => {
      bridgeName = name;
      capturedHandler = handler as (v: SerializedCspViolation) => void;
      return Promise.resolve();
    });
    pageMock.evaluateOnNewDocument.mockImplementation(() => {
      // Simulate the page-side listener firing: invoke the bridge twice,
      // exactly as the real script would when the browser dispatches
      // securitypolicyviolation events.
      capturedHandler!(synthetic1);
      capturedHandler!(synthetic2);
      return Promise.resolve();
    });
    pageMock.evaluate.mockResolvedValueOnce([]);

    const result = await collectWebVitals('http://localhost:8080/', 9876);

    expect(bridgeName).toBeDefined();
    expect(result.cspViolations).toEqual([synthetic1, synthetic2]);
  });

  it('attaches the CSP listener BEFORE goto so first-paint violations are caught', async () => {
    // Pin the call order: exposeFunction → evaluateOnNewDocument → goto.
    // If the collector ever moves goto ahead of evaluateOnNewDocument,
    // the listener attaches too late and the very first violation
    // (often the most informative one — initial inline-script eval)
    // slips by silently. This test stops that regression.
    pageMock.evaluate.mockResolvedValueOnce([]);
    await collectWebVitals('http://localhost:8080/', 9876);
    const exposeOrder = pageMock.exposeFunction.mock.invocationCallOrder[0];
    const onNewDocOrder = pageMock.evaluateOnNewDocument.mock.invocationCallOrder[0];
    const gotoOrder = pageMock.goto.mock.invocationCallOrder[0];
    expect(exposeOrder).toBeLessThan(onNewDocOrder);
    expect(onNewDocOrder).toBeLessThan(gotoOrder);
  });

  // Run the enrichment callback page.evaluate would have invoked, with a
  // simulated `globalThis.__webVitals`. Returns whatever the callback produced.
  async function runEnrichmentWith(webVitals: unknown[]): Promise<Array<Record<string, unknown>>> {
    let evalCallback: ((..._a: unknown[]) => unknown) | undefined;
    pageMock.evaluate.mockImplementation((cb: (..._a: unknown[]) => unknown) => {
      evalCallback = cb;
      return Promise.resolve([]);
    });
    await collectWebVitals('http://localhost:8080/', 9876);
    const g = globalThis as unknown as { __webVitals?: unknown[] };
    g.__webVitals = webVitals;
    try {
      return evalCallback!() as Array<Record<string, unknown>>;
    } finally {
      delete g.__webVitals;
    }
  }

  it('extracts LCP element details (tagName/id/className/src) from entries[0].element', async () => {
    const result = await runEnrichmentWith([
      {
        name: 'LCP',
        value: 800,
        entries: [
          {
            element: {
              tagName: 'IMG',
              id: 'hero',
              className: 'card',
              currentSrc: '/hero.jpg',
              src: '/hero.jpg',
            },
          },
        ],
      },
      { name: 'CLS', value: 0.001, entries: [] },
    ]);
    expect(result[0]).toMatchObject({
      name: 'LCP',
      lcpElement: { tagName: 'IMG', id: 'hero', className: 'card', src: '/hero.jpg' },
    });
    expect(result[1]).not.toHaveProperty('lcpElement');
  });

  it('omits id/className/src from lcpElement when the element does not have them', async () => {
    const result = await runEnrichmentWith([
      { name: 'LCP', value: 800, entries: [{ element: { tagName: 'H1' } }] },
    ]);
    expect(result[0].lcpElement).toEqual({ tagName: 'H1' });
  });

  it('does not add lcpElement when LCP entry has no element (e.g. cross-origin)', async () => {
    const result = await runEnrichmentWith([{ name: 'LCP', value: 800, entries: [{}] }]);
    expect(result[0]).not.toHaveProperty('lcpElement');
  });
});
