import puppeteer from 'puppeteer-core';

type WebVitalsGlobal = { __webVitals?: unknown[] };

const NAV_TIMEOUT_MS = 30_000;
const SHIM_READY_TIMEOUT_MS = 5_000;
const POST_LCP_TAIL_MS = 500;

export async function collectWebVitals(url: string, port: number): Promise<unknown[]> {
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(
      () =>
        (globalThis as WebVitalsGlobal).__webVitals?.some(
          (m) => (m as { name?: string }).name === 'LCP',
        ),
      { timeout: SHIM_READY_TIMEOUT_MS },
    );
    await new Promise((r) => setTimeout(r, POST_LCP_TAIL_MS));
    const samples = await page.evaluate(() => (globalThis as WebVitalsGlobal).__webVitals ?? []);
    await page.close();
    return samples;
  } finally {
    await browser.disconnect();
  }
}
