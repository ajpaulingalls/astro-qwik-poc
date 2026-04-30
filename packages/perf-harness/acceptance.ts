// Shared browser acceptance suite for the AJE PoC apps.
//
// Both Astro and Qwik render the same UI from the same fixture data, so
// "what the page does in a real browser" should be expressible once and
// asserted against either target. This module owns the describe + lifecycle;
// each app's `tests/acceptance.test.ts` is a 3-line wrapper that calls
// `runAcceptanceSuite('astro' | 'qwik')`.
//
// Per-capstone test groups live in sibling files under `acceptance/`. They
// receive an AcceptanceContext built here so the lifecycle-owned helpers
// (withPage, withPageAndHeaders, waitUntilHydrated, waitForBannerText) close
// over the live `browser` reference even though the register* functions are
// defined elsewhere.
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
import {
  type AcceptanceContext,
  type Viewport,
  MOBILE,
  DESKTOP,
  KNOWN_ARTICLE_SLUG,
  MAX_RELATED,
  LCP_IMAGE_PRELOAD_RE,
  appHttpBase,
  expectSingleMain,
} from './acceptance/shared.ts';
import { registerArticleVariantTests } from './acceptance/article-variant-tests.ts';
import { registerBreakingTickerTests } from './acceptance/breaking-ticker-tests.ts';
import { registerLiveBlogTests } from './acceptance/live-blog-tests.ts';
import { registerSectionTests } from './acceptance/section-tests.ts';

export function runAcceptanceSuite(target: Target): void {
  const APP_URL = `${appHttpBase(target)}/`;

  describe(`${target} homepage acceptance`, () => {
    let mockApi: ChildProcess;
    let appProc: ChildProcess;
    let chrome: chromeLauncher.LaunchedChrome;
    let browser: Browser;
    let setupMs = 0;
    let testsStart = 0;

    // Open a page at the given viewport, navigate to url (defaults to APP_URL
    // homepage), run fn, always close. Without the finally a failed assertion
    // leaks pages into the shared Browser and can hold the chrome process
    // open across tests.
    async function withPage<T>(
      viewport: Viewport,
      fn: (page: Page) => Promise<T>,
      url: string = APP_URL,
    ): Promise<T> {
      const page = await browser.newPage();
      try {
        await page.setViewport(viewport);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
        return await fn(page);
      } finally {
        await page.close();
      }
    }

    // Variant for polling-island tests (live-blog, breaking-ticker) where
    // a snapshot-pinning header must be set BEFORE navigation and the page
    // never reaches networkidle (continuous polling). Waits on
    // domcontentloaded + an explicit hydration signal in fn instead.
    async function withPageAndHeaders<T>(
      headers: Record<string, string>,
      fn: (page: Page) => Promise<T>,
      url: string = APP_URL,
    ): Promise<T> {
      const page = await browser.newPage();
      try {
        await page.setViewport(DESKTOP);
        await page.setExtraHTTPHeaders(headers);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        return await fn(page);
      } finally {
        await page.close();
      }
    }

    // Waits for a `data-hydrated="true"` flip on the given selector. Both
    // apps' islands emit this attribute once their visible task / useEffect
    // arms — single cross-app signal for "ready to interact." Used by every
    // post-hydration probe (LoadMore, live-blog Updater, BreakingTicker).
    async function waitUntilHydrated(
      page: Page,
      selector: string,
      timeoutMs = 10_000,
    ): Promise<void> {
      await page.waitForFunction(
        (sel: string) => document.querySelector(sel)?.getAttribute('data-hydrated') === 'true',
        { timeout: timeoutMs },
        selector,
      );
    }

    // Waits for the BreakingTicker banner's text content to equal the given
    // string (trimmed). Used by the snapshot-1 assertion + polling-detects-
    // change probe. Equality (not substring) so a future fixture where one
    // snapshot's text contains another's as a prefix can't false-pass.
    async function waitForBannerText(page: Page, text: string, timeoutMs = 10_000): Promise<void> {
      await page.waitForFunction(
        (txt: string) => {
          const el = document.querySelector('[data-breaking-ticker-banner] .breaking-ticker-text');
          return !!el && (el.textContent ?? '').trim() === txt;
        },
        { timeout: timeoutMs },
        text,
      );
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

    const ctx: AcceptanceContext = {
      target,
      appUrl: APP_URL,
      withPage,
      withPageAndHeaders,
      waitUntilHydrated,
      waitForBannerText,
    };

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
      const probe = await fetch(`${appHttpBase(target)}/wp-content/uploads/probe.png`);
      expect(probe.status).toBe(200);
      expect(probe.headers.get('content-type')).toBe('image/png');
    });

    // CSP must reach the browser with the runtime apiBase substituted in,
    // not just the build-time default. Carriers per target:
    // - Qwik: HTTP header set by server.ts. Header is the only emit point.
    // - Astro: Astro 6's security.csp emits via TWO paths — page.js sets the
    //   HTTP header AND head.js injects a <meta http-equiv> tag. Either is
    //   sufficient (a meta tag is what matters to the browser when the
    //   adapter strips response headers, which the @deno/astro-adapter has
    //   been observed to do). Assert OR for Astro to match the framework's
    //   own redundancy; assert HEADER ONLY for Qwik (no meta path exists).
    it('serves Content-Security-Policy with apiBase substituted at request time', async () => {
      const expectedApiBase = `http://localhost:${MOCK_API_PORT[target]}`;
      const response = await fetch(APP_URL);
      const html = await response.text();

      const headerCsp = response.headers.get('content-security-policy');
      // Match either attribute order (http-equiv before content, or vice versa)
      // so a template tweak that swaps them doesn't silently null-match.
      const metaMatch =
        html.match(
          /<meta\s+http-equiv=["']content-security-policy["']\s+content=["']([^"']+)["']/i,
        ) ??
        html.match(
          /<meta\s+content=["']([^"']+)["']\s+http-equiv=["']content-security-policy["']/i,
        );
      const metaCsp = metaMatch ? metaMatch[1] : null;

      const csp = target === 'qwik' ? headerCsp : (headerCsp ?? metaCsp);
      const carrierMessage =
        target === 'qwik'
          ? 'Qwik must serve CSP via HTTP header (server.ts setHeader)'
          : 'Astro must emit CSP via HTTP header or <meta http-equiv> tag (security.csp config)';
      expect(csp, carrierMessage).not.toBeNull();

      // Three properties prove the wiring end-to-end:
      // - default-src 'self' is the canonical baseline both builders emit;
      // - apiBase substituted into img-src/connect-src proves the runtime
      //   PUBLIC_API_BASE flowed through to the served CSP;
      // - frame-src includes a known embed origin (youtube), proving
      //   FRAME_SRC_ORIGINS made it into the directive list.
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain(expectedApiBase);
      expect(csp).toContain('https://www.youtube.com');
    });

    // The /wp-content/uploads/* proxy must forward the query string so the
    // ?w=&resize= resize hints reach mock-api. LeadImage emits srcset URLs
    // carrying these params; if the proxy strips them, every srcset entry
    // would resolve to the same fallback PNG.
    it('forwards ?w= and ?resize= through the uploads proxy (returns SVG at requested dims)', async () => {
      const probe = await fetch(
        `${appHttpBase(target)}/wp-content/uploads/probe.png?w=400&resize=400%2C267`,
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
      const response = await fetch(`${appHttpBase(target)}/news/this-slug-has-no-fixture`);
      expect(response.status).toBe(404);
    });

    // The article LCP image must be preloaded so the browser starts the
    // fetch before parsing reaches the <img>. fetchpriority=high alone
    // reorders after parser discovery; preload starts it immediately.
    // Both apps emit `<link rel="preload" as="image" href=".../?w=800&...">`
    // matching LeadImage's 800w srcset entry so the browser reuses the
    // preloaded bytes.
    it('preloads the article LCP image with rel=preload as=image', async () => {
      const html = await fetch(`${appHttpBase(target)}/news/${KNOWN_ARTICLE_SLUG}`).then((r) =>
        r.text(),
      );
      const headEnd = html.indexOf('</head>');
      expect(headEnd, 'no </head> in SSR HTML').toBeGreaterThan(-1);
      const head = html.slice(0, headEnd);
      // Regex tolerates attribute ordering but assumes the <link ...> tag is
      // emitted on a single line — both apps' SSR output satisfies that today.
      // A future minifier/formatter that wraps long tags could break this.
      expect(head).toMatch(LCP_IMAGE_PRELOAD_RE);
      // Must point at a resize URL so the browser reuses the bytes for the
      // matching srcset entry — bare /wp-content/uploads/foo.jpg would only
      // be reused if the LeadImage src happened to match.
      expect(head).toMatch(/<link\b[^>]*\bas=["']image["'][^>]*\?w=800/);
      expectSingleMain(html, 'article page');
    });

    // Both apps cap related stories at 6: Astro slices in the route loader,
    // Qwik via MAX_RELATED in both loader + component (defense-in-depth).
    // Without the cap a future curated-feed expansion could silently render
    // dozens of related links. SSR-only content, so bare fetch + HTML scan
    // beats spinning up puppeteer.
    it(`caps related-stories at ${MAX_RELATED} entries on the article page`, async () => {
      const html = await fetch(`${appHttpBase(target)}/news/${KNOWN_ARTICLE_SLUG}`).then((r) =>
        r.text(),
      );
      const start = html.indexOf('related-stories');
      expect(start, 'related-stories section missing from SSR HTML').toBeGreaterThan(-1);
      const section = html.slice(start, html.indexOf('</section>', start));
      const linkCount = (section.match(/<a\b/g) ?? []).length;
      expect(linkCount).toBeGreaterThan(0);
      expect(linkCount).toBeLessThanOrEqual(MAX_RELATED);
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

    registerSectionTests(ctx);
    registerLiveBlogTests(ctx);
    registerBreakingTickerTests(ctx);
    registerArticleVariantTests(ctx);
  });
}
