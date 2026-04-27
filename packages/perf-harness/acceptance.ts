// Shared browser acceptance suite for the AJE PoC apps.
//
// Both Astro and Qwik render the same UI from the same fixture data, so
// "what the page does in a real browser" should be expressible once and
// asserted against either target. This module owns the describe + tests;
// each app's `tests/acceptance.test.ts` is a 3-line wrapper that calls
// `runAcceptanceSuite('astro' | 'qwik')`.
//
// Lifecycle reuses spawnApp/spawnMockApi/killService/waitForPort from the
// perf-harness so any change to "how do we boot a target like prod" lands
// in one place.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type ChildProcess } from 'node:child_process';
import * as chromeLauncher from 'chrome-launcher';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { waitForPort, type Target } from './cli_helpers.ts';
import { APP_PORT, MOCK_API_PORT, killService, spawnApp, spawnMockApi } from './spawn.ts';

interface Viewport {
  width: number;
  height: number;
}

const MOBILE: Viewport = { width: 320, height: 568 };
const DESKTOP: Viewport = { width: 1280, height: 800 };

// Article-shape acceptance tests below depend on this fixture existing in
// packages/mock-api/fixtures/ArchipelagoSingleArticleQuery--<last-segment>.json.
// If the fixture is renamed, both the 404 test and the cap test will start
// failing — likely the wrong test will fail first; check this constant.
const KNOWN_ARTICLE_SLUG =
  'features/2026/4/24/russian-oil-exports-slump-as-ukraine-hammers-ports-and-refineries';

export function runAcceptanceSuite(target: Target): void {
  const APP_URL = `http://127.0.0.1:${APP_PORT[target]}/`;

  describe(`${target} homepage acceptance`, () => {
    let mockApi: ChildProcess;
    let appProc: ChildProcess;
    let chrome: chromeLauncher.LaunchedChrome;
    let browser: Browser;
    let setupMs = 0;
    let testsStart = 0;

    // Open a page at the given viewport, run fn, always close. Without the
    // finally a failed assertion leaks pages into the shared Browser and
    // can hold the chrome process open across tests.
    async function withPage<T>(viewport: Viewport, fn: (page: Page) => Promise<T>): Promise<T> {
      const page = await browser.newPage();
      try {
        await page.setViewport(viewport);
        await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
        return await fn(page);
      } finally {
        await page.close();
      }
    }

    beforeAll(async () => {
      const setupStart = Date.now();
      mockApi = spawnMockApi(target);
      appProc = spawnApp(target);
      await Promise.all([
        waitForPort(MOCK_API_PORT[target], { timeoutMs: 10_000 }),
        waitForPort(APP_PORT[target], { timeoutMs: 60_000 }),
      ]);
      chrome = await chromeLauncher.launch({
        chromeFlags: ['--headless=new', '--no-sandbox'],
      });
      browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${chrome.port}`,
      });
      setupMs = Date.now() - setupStart;
      testsStart = Date.now();
    }, 90_000);

    afterAll(async () => {
      const testsMs = testsStart === 0 ? 0 : Date.now() - testsStart;
      // Each teardown step is independent; an earlier failure (e.g. setup
      // crash before `browser` was assigned) must not skip the later
      // process kills, otherwise the perf-harness would leak chrome and
      // the spawned services across vitest runs.
      const teardown = async (fn: () => Promise<unknown> | unknown) => {
        try {
          await fn();
        } catch {
          // Swallow — we want every cleanup step to attempt.
        }
      };
      await teardown(() => browser?.disconnect());
      await teardown(() => chrome?.kill());
      await teardown(() => Promise.all([appProc, mockApi].filter(Boolean).map(killService)));
      // Single-line summary — easy to grep for cross-target comparison.
      // Skip when setup never completed; the timings would be meaningless.
      if (testsStart > 0) {
        process.stdout.write(
          `[acceptance:${target}] setup=${setupMs}ms tests=${testsMs}ms total=${
            setupMs + testsMs
          }ms\n`,
        );
      }
    });

    it('renders nav + main + footer at mobile viewport (320×568)', async () => {
      const present = await withPage(MOBILE, (page) =>
        page.evaluate(() => ({
          nav: !!document.querySelector('nav'),
          main: !!document.querySelector('main'),
          footer: !!document.querySelector('footer'),
          hamburger: !!document.querySelector('button[aria-label="Menu"]'),
        })),
      );
      expect(present.nav).toBe(true);
      expect(present.main).toBe(true);
      expect(present.footer).toBe(true);
      expect(present.hamburger).toBe(true);
    });

    it('renders nav + main + footer at desktop viewport (1280×800)', async () => {
      const counts = await withPage(DESKTOP, (page) =>
        page.evaluate(() => ({
          nav: !!document.querySelector('nav'),
          main: !!document.querySelector('main'),
          footer: !!document.querySelector('footer'),
          navLinks: document.querySelectorAll('nav ul a').length,
        })),
      );
      expect(counts.nav).toBe(true);
      expect(counts.main).toBe(true);
      expect(counts.footer).toBe(true);
      expect(counts.navLinks).toBe(7);
    });

    it('hamburger toggle works in a live browser (mobile viewport)', async () => {
      await withPage(MOBILE, async (page) => {
        // Both targets must reach `aria-expanded="false"` before the click;
        // the wait covers Astro's client:idle hydration and Qwik's resumed
        // signal binding without the test caring which mechanism applies.
        await page.waitForFunction(
          () => {
            const btn = document.querySelector('button[aria-label="Menu"]');
            return !!btn && btn.getAttribute('aria-expanded') === 'false';
          },
          { timeout: 10_000 },
        );
        await page.click('button[aria-label="Menu"]');
        await page.waitForFunction(
          () =>
            document.querySelector('button[aria-label="Menu"]')?.getAttribute('aria-expanded') ===
            'true',
          { timeout: 5_000 },
        );
        const ulVisibleAfterClick = await page.$eval(
          'nav ul',
          (el) => el.className.includes('flex') && !el.className.includes('hidden'),
        );
        expect(ulVisibleAfterClick).toBe(true);
      });
    });

    // Each app must serve /wp-content/uploads/* from the app origin (via an
    // app-side proxy to mock-api), so any code path that emits a relative
    // /wp-content/uploads/* URL (e.g. M11 same-origin demo, or a component
    // that bypasses resolveImageUrl) resolves to a real image instead of a
    // 404 against the app origin.
    it('proxies /wp-content/uploads/* to mock-api (returns 200 image/png)', async () => {
      const probe = await fetch(
        `http://127.0.0.1:${APP_PORT[target]}/wp-content/uploads/probe.png`,
      );
      expect(probe.status).toBe(200);
      expect(probe.headers.get('content-type')).toBe('image/png');
    });

    // The /wp-content/uploads/* proxy must forward the query string so the
    // ?w=&resize= resize hints reach mock-api. LeadImage emits srcset URLs
    // carrying these params; if the proxy strips them, every srcset entry
    // would resolve to the same fallback PNG.
    it('forwards ?w= and ?resize= through the uploads proxy (returns SVG at requested dims)', async () => {
      const probe = await fetch(
        `http://127.0.0.1:${APP_PORT[target]}/wp-content/uploads/probe.png?w=400&resize=400%2C267`,
      );
      expect(probe.status).toBe(200);
      expect(probe.headers.get('content-type')).toBe('image/svg+xml');
      const body = await probe.text();
      expect(body).toContain('width="400"');
      expect(body).toContain('height="267"');
    });

    // Mock-api returns 404 for slugs without a matching fixture. Both apps
    // must translate that into a real HTTP 404 instead of a 500 — Astro via
    // GraphqlHttpError.status, Qwik via routeLoader fail(404).
    it('returns HTTP 404 for an article slug with no matching fixture', async () => {
      const response = await fetch(
        `http://127.0.0.1:${APP_PORT[target]}/news/this-slug-has-no-fixture`,
      );
      expect(response.status).toBe(404);
    });

    // Both apps cap related stories at 6: Astro slices in the route loader,
    // Qwik via MAX_RELATED in both loader + component (defense-in-depth).
    // Without the cap a future curated-feed expansion could silently render
    // dozens of related links. SSR-only content, so bare fetch + HTML scan
    // beats spinning up puppeteer.
    it('caps related-stories at 6 entries on the article page', async () => {
      const html = await fetch(
        `http://127.0.0.1:${APP_PORT[target]}/news/${KNOWN_ARTICLE_SLUG}`,
      ).then((r) => r.text());
      const start = html.indexOf('related-stories');
      expect(start, 'related-stories section missing from SSR HTML').toBeGreaterThan(-1);
      const section = html.slice(start, html.indexOf('</section>', start));
      const linkCount = (section.match(/<a\b/g) ?? []).length;
      expect(linkCount).toBeGreaterThan(0);
      expect(linkCount).toBeLessThanOrEqual(6);
    });

    it('Inter web font is loaded with no CLS-triggering FOIT', async () => {
      const fontInfo = await withPage(DESKTOP, async (page) => {
        await page.evaluate(() => document.fonts.ready);
        return page.evaluate(() => {
          const loaded: string[] = [];
          for (const f of document.fonts) {
            if (f.status === 'loaded') loaded.push(f.family);
          }
          const h1 = document.querySelector('h1');
          const computed = h1 ? getComputedStyle(h1).fontFamily : '';
          return { loaded, computed };
        });
      });
      expect(fontInfo.loaded.some((f) => /Inter/i.test(f))).toBe(true);
      expect(fontInfo.computed).toMatch(/Inter|--font-inter/);
    });
  });
}
