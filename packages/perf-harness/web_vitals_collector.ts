import puppeteer, { TimeoutError } from 'puppeteer-core';
import type { Metric } from 'web-vitals';

export interface LcpElementSummary {
  tagName: string;
  id?: string;
  className?: string;
  src?: string;
}

export type EnrichedMetric = Metric & { lcpElement?: LcpElementSummary };

// Subset of DOM SecurityPolicyViolationEvent serialized across the puppeteer
// boundary. Skips originalPolicy (already in source — bloats reports) and
// referrer (not actionable for the audit). Captured by the runtime listener
// the collector attaches before navigation.
export interface SerializedCspViolation {
  violatedDirective: string;
  effectiveDirective: string;
  blockedURI: string;
  disposition: 'enforce' | 'report';
  documentURI: string;
  sourceFile: string;
  lineNumber: number;
  columnNumber: number;
  sample: string;
}

type WebVitalsGlobal = { __webVitals?: Metric[] };

const NAV_TIMEOUT_MS = 30_000;
const SHIM_READY_TIMEOUT_MS = 5_000;
const POST_LCP_TAIL_MS = 500;

// Extracted as a named function so the test can invoke it directly. page.evaluate
// serializes the callback to source — no closures over imports — so this only runs
// in the page context, never in Node at runtime.
export function enrichSamples(): EnrichedMetric[] {
  const raw = (globalThis as WebVitalsGlobal).__webVitals ?? [];
  return raw.map((m) => {
    if (m.name !== 'LCP') return m;
    const entry = m.entries?.[0] as { element?: Element & { currentSrc?: string; src?: string } };
    const el = entry?.element;
    if (!el || !el.tagName) return m;
    const lcpElement: LcpElementSummary = { tagName: el.tagName };
    if (el.id) lcpElement.id = el.id;
    if (el.className) lcpElement.className = el.className;
    const src = el.currentSrc || el.src;
    if (src) lcpElement.src = src;
    return { ...m, lcpElement };
  });
}

export async function collectWebVitals(url: string, port: number): Promise<EnrichedMetric[]> {
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(
      () => (globalThis as WebVitalsGlobal).__webVitals?.some((m) => m.name === 'LCP'),
      { timeout: SHIM_READY_TIMEOUT_MS },
    );
    // INP requires at least one interaction to fire. Press Tab so the
    // slowest-interaction-during-page-lifetime measurement records a value.
    // Tab is the deliberately-minimal probe: measures the runtime's
    // input-handling overhead (Astro: near-zero; Qwik: includes any QRL
    // resolution that fires on first interaction). Synthetic puppeteer
    // mouse clicks (page.click, page.mouse.click) do NOT generate
    // PerformanceEventTiming entries in headless Chrome (observed in
    // chrome-launcher's bundled Chrome + puppeteer-core 24.x); only real
    // keyboard events do. If a future Chrome release starts emitting
    // event-timing for synthetic clicks, this Tab probe still works.
    // Per-page meaningful interactions (LoadMore, dismiss) belong in
    // acceptance.ts, not here.
    await page.keyboard.press('Tab');
    // INP is enrichment on top of LCP; if the wait times out (no
    // PerformanceEventTiming, suppressed Tab handler, etc.) we still want the
    // LCP samples we already captured. Aggregator emits MISSING for the INP
    // slot. Only TimeoutError is swallowed — re-throw anything else so page
    // crashes or browser disconnects surface honestly. The 500ms tail runs
    // alongside the wait so a timed-out INP doesn't add 500ms on top of 5s.
    const inpWait = page
      .waitForFunction(
        () => (globalThis as WebVitalsGlobal).__webVitals?.some((m) => m.name === 'INP'),
        { timeout: SHIM_READY_TIMEOUT_MS },
      )
      .catch((err: unknown) => {
        if (!(err instanceof TimeoutError)) throw err;
      });
    const tail = new Promise((r) => setTimeout(r, POST_LCP_TAIL_MS));
    await Promise.all([inpWait, tail]);
    const samples = await page.evaluate(enrichSamples);
    await page.close();
    return samples;
  } finally {
    await browser.disconnect();
  }
}
