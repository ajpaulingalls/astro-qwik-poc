// Cross-file types, constants, and helpers for the per-capstone acceptance
// test groups. Each register*Tests function takes an AcceptanceContext so
// the lifecycle-owned helpers (withPage, withPageAndHeaders, waitUntilHydrated,
// waitForBannerText) are passed in once at orchestration time.

import { expect } from 'vitest';
import { type Page } from 'puppeteer-core';
import { type Target } from '../cli_helpers.ts';
import { APP_PORT } from '../spawn.ts';

export interface Viewport {
  width: number;
  height: number;
}

export const MOBILE: Viewport = { width: 320, height: 568 };
export const DESKTOP: Viewport = { width: 1280, height: 800 };

export interface AcceptanceContext {
  target: Target;
  appUrl: string;
  withPage: <T>(viewport: Viewport, fn: (page: Page) => Promise<T>, url?: string) => Promise<T>;
  withPageAndHeaders: <T>(
    headers: Record<string, string>,
    fn: (page: Page) => Promise<T>,
    url?: string,
  ) => Promise<T>;
  waitUntilHydrated: (page: Page, selector: string, timeoutMs?: number) => Promise<void>;
  waitForBannerText: (page: Page, text: string, timeoutMs?: number) => Promise<void>;
}

// Stand-alone constant — independent of any *_VARIANTS list so reordering
// variants never silently retargets the 404 / preload / cap tests.
export const KNOWN_ARTICLE_SLUG =
  'features/2026/4/24/russian-oil-exports-slump-as-ukraine-hammers-ports-and-refineries';

export const MIN_RELATED = 4;
export const MAX_RELATED = 6;

// CLS-during-prepend gate from execution_plan.json M9 done-state. Used by
// both the live-blog Updater test and the BreakingTicker appearance test.
export const CLS_PREPEND_BUDGET = 0.05;

// Asserted on both /news/[slug] and /{section} HTML responses. Both apps
// emit `<link rel="preload" as="image" href=".../?w=800&...">` for the LCP
// image — a single tag where rel and as appear in this order. If either app
// ever reorders the attributes, relax the regex to use lookahead instead of
// chained character classes.
export const LCP_IMAGE_PRELOAD_RE = /<link\b[^>]*\brel=["']preload["'][^>]*\bas=["']image["']/;

// HTML5 forbids nested <main> landmarks. Qwik's layout wraps every route in
// <main>; per-route components must NOT add another (use <div> with the
// content-width classes instead). Astro's BaseLayout doesn't add <main>, so
// the per-page <main> is the only landmark. Either way: exactly 1.
export function expectSingleMain(html: string, label: string): void {
  const mainCount = (html.match(/<main\b/g) ?? []).length;
  expect(mainCount, `${label} should have exactly 1 <main> landmark`).toBe(1);
}

export function appHttpBase(target: Target): string {
  return `http://127.0.0.1:${APP_PORT[target]}`;
}

// Install a layout-shift observer in the page context that excludes shifts
// attributable to user input. Returns a teardown that disconnects the
// observer and resolves with the accumulated CLS. Used by both the live-blog
// Updater regression guard and the BreakingTicker appearance guard;
// buffered:false ensures we only measure shifts that fire AFTER install,
// scoping each test to its own mutation window (not initial render / font
// swap, which are not the polling-prepend's fault).
export async function installClsObserver(page: Page): Promise<() => Promise<number>> {
  await page.evaluate(() => {
    const w = window as unknown as { __cls: number; __obs: PerformanceObserver };
    w.__cls = 0;
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const ls = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!ls.hadRecentInput) w.__cls += ls.value;
      }
    });
    obs.observe({ type: 'layout-shift', buffered: false });
    w.__obs = obs;
  });
  return () =>
    page.evaluate(() => {
      const w = window as unknown as { __cls: number; __obs: PerformanceObserver };
      w.__obs.disconnect();
      return w.__cls;
    });
}
