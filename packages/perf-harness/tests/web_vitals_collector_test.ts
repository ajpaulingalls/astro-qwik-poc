import { describe, it, expect, vi, beforeEach } from 'vitest';

const { connectMock, browserMock, pageMock } = vi.hoisted(() => {
  const pageMock = {
    goto: vi.fn(),
    waitForFunction: vi.fn(),
    click: vi.fn(),
    evaluate: vi.fn(),
    close: vi.fn(),
  };
  const browserMock = {
    newPage: vi.fn(async () => pageMock),
    disconnect: vi.fn(),
  };
  const connectMock = vi.fn(async () => browserMock);
  return { connectMock, browserMock, pageMock };
});

vi.mock('puppeteer-core', () => ({
  default: { connect: connectMock },
}));

import { collectWebVitals } from '../web_vitals_collector.ts';

describe('collectWebVitals', () => {
  beforeEach(() => {
    pageMock.goto.mockReset();
    pageMock.waitForFunction.mockReset();
    pageMock.click.mockReset();
    pageMock.evaluate.mockReset();
    pageMock.close.mockReset();
    browserMock.newPage.mockClear();
    browserMock.disconnect.mockClear();
    connectMock.mockClear();
  });

  it('connects to chrome on the given port and returns evaluated samples', async () => {
    pageMock.evaluate.mockResolvedValueOnce([
      { name: 'LCP', value: 800 },
      { name: 'CLS', value: 0.001 },
    ]);

    const samples = await collectWebVitals('http://localhost:8080/', 9876);

    expect(connectMock).toHaveBeenCalledWith({ browserURL: 'http://127.0.0.1:9876' });
    expect(pageMock.goto).toHaveBeenCalledWith(
      'http://localhost:8080/',
      expect.objectContaining({ waitUntil: 'networkidle2' }),
    );
    expect(samples).toEqual([
      { name: 'LCP', value: 800 },
      { name: 'CLS', value: 0.001 },
    ]);
  });

  it('clicks the page body between the LCP wait and the INP wait', async () => {
    pageMock.evaluate.mockResolvedValueOnce([]);
    await collectWebVitals('http://localhost:8080/', 9876);
    expect(pageMock.click).toHaveBeenCalledWith('body');
    // INP can only fire AFTER an interaction. The runtime contract is
    // strict: wait-LCP, click, wait-INP. Asserting both bounds (click
    // after first wait AND before second wait) catches a refactor that
    // moves the click below both waits — that would mock-pass with only
    // a one-sided check but timeout in production because the INP wait
    // would never resolve.
    const [firstWait, secondWait] = pageMock.waitForFunction.mock.invocationCallOrder;
    const [click] = pageMock.click.mock.invocationCallOrder;
    expect(click).toBeGreaterThan(firstWait);
    expect(click).toBeLessThan(secondWait);
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
    const samples = await collectWebVitals('http://localhost:8080/', 9876);
    expect(samples).toEqual([]);
  });

  it('disconnects browser even if waitForFunction throws (timeout)', async () => {
    pageMock.waitForFunction.mockRejectedValueOnce(new Error('TimeoutError'));

    await expect(collectWebVitals('http://localhost:8080/', 9876)).rejects.toThrow(/TimeoutError/);
    expect(browserMock.disconnect).toHaveBeenCalled();
  });

  it('closes the page before returning', async () => {
    pageMock.evaluate.mockResolvedValueOnce([]);
    await collectWebVitals('http://localhost:8080/', 9876);
    expect(pageMock.close).toHaveBeenCalled();
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
