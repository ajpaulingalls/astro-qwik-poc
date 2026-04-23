import { describe, it, expect, vi, beforeEach } from 'vitest';

const { connectMock, browserMock, pageMock } = vi.hoisted(() => {
  const pageMock = {
    goto: vi.fn(),
    waitForFunction: vi.fn(),
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
});
