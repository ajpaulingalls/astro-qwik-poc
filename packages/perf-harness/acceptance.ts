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
import { SECTION_PAGE_SIZE } from '@aje-poc/shared-types';
import { waitForPort, type Target } from './cli_helpers.ts';
import { APP_PORT, MOCK_API_PORT, killService, spawnApp, spawnMockApi } from './spawn.ts';

interface Viewport {
  width: number;
  height: number;
}

const MOBILE: Viewport = { width: 320, height: 568 };
const DESKTOP: Viewport = { width: 1280, height: 800 };

// Each variant requires the matching ArchipelagoSingleArticleQuery--<last
// segment of slug>.json fixture. The gallery/instagram fixtures' article.link
// fields claim a `-for-m7-fixture` suffix that does NOT exist in the actual
// filename — the mock-api resolves on filename, so use the filename here.
interface ArticleVariant {
  name: string;
  slug: string;
  signature: string;
}
const ARTICLE_VARIANTS: ArticleVariant[] = [
  {
    name: 'twitter',
    slug: 'features/2026/4/24/russian-oil-exports-slump-as-ukraine-hammers-ports-and-refineries',
    signature: 'blockquote.twitter-tweet',
  },
  {
    name: 'gallery',
    slug: '2026/4/25/sample-article-with-gallery-embed',
    signature: '.wp-block-gallery',
  },
  {
    name: 'instagram',
    slug: '2026/4/25/sample-article-with-instagram-embed',
    signature: 'blockquote.instagram-media',
  },
  {
    name: 'youtube',
    slug: '2026/4/27/sample-article-with-youtube-embed',
    signature: 'iframe[src*="youtube.com/embed"]',
  },
  {
    name: 'brightcove',
    slug: '2026/4/21/trump-announces-extending-iran-ceasefire-but-says-blockade-remains',
    signature: 'video-js',
  },
];
const MIN_RELATED = 4;
const MAX_RELATED = 6;
// Stand-alone constant — independent of ARTICLE_VARIANTS so reordering the
// variants doesn't silently retarget the 404 / preload / cap tests.
const KNOWN_ARTICLE_SLUG =
  'features/2026/4/24/russian-oil-exports-slump-as-ukraine-hammers-ports-and-refineries';

// Section Front capstone (story-003): both apps must render /{section} from
// the same fixtures with the same dispatch (geographic vs topic). LoadMore
// click must append without navigation and meet the M8 INP <=100ms gate.
interface SectionVariant {
  name: 'geographic' | 'topic';
  slug: string;
  expectedTitle: string;
}
const SECTION_VARIANTS: SectionVariant[] = [
  { name: 'geographic', slug: 'middle-east', expectedTitle: 'Middle East' },
  { name: 'topic', slug: 'opinion', expectedTitle: 'Opinion' },
];
// Click → DOM-mutation budget. Pragmatic INP proxy: measures the same UX
// semantic (user clicks → user sees the result) rather than relying on
// PerformanceObserver event-timing entries, which fire unreliably for
// synthetic puppeteer clicks. Includes localhost-fast network round-trip;
// 500ms gives headroom for slow CI without hiding real regressions. The M8
// done-state names INP <=100ms; that's the real-user metric the perf harness
// will need to enforce separately when it grows onINP capture (deferred).
const SECTION_LOADMORE_LATENCY_BUDGET_MS = 500;

// Asserted on both /news/[slug] and /{section} HTML responses. Both apps
// emit `<link rel="preload" as="image" href=".../?w=800&...">` for the LCP
// image — a single tag where rel and as appear in this order. If either app
// ever reorders the attributes, relax the regex to use lookahead instead of
// chained character classes.
const LCP_IMAGE_PRELOAD_RE = /<link\b[^>]*\brel=["']preload["'][^>]*\bas=["']image["']/;

// Live-blog capstone (story-005): both apps' Updater islands must poll the
// shell, fetch new entries, and prepend them with no CLS regression.
//
// Determinism: SSR fetches go server→mock-api with no special headers and
// LIVEBLOG_SNAPSHOT_INDEX=0 in the env (test:acceptance script), pinning
// every server-side fetch to snapshot-0 (25 children). The browser then
// adds `x-liveblog-snapshot: 2` via setExtraHTTPHeaders before the Updater
// starts polling; mock-api's per-request header overrides the env, so polls
// see snapshot-2 (27 children) and the diff yields the 2 new entries that
// triggered the prepend. Wall-clock auto-rotation is OFF in tests because
// it can cycle backwards (snapshot-2 → snapshot-0 = no new ids = test hangs).
//
// Both apps' builds also bake PUBLIC_LIVEBLOG_POLL_INTERVAL_MS=500 so the
// Updater's setInterval fires within ~1s instead of waiting for the
// production 30s cadence.
const LIVEBLOG_SLUG =
  '2026/4/22/iran-war-live-trump-says-ceasefire-extended-as-talks-with-tehran-in-limbo';
const LIVEBLOG_PATH = `/news/liveblog/${LIVEBLOG_SLUG}`;
// CLS-during-prepend gate from execution_plan.json M9 done-state.
const CLS_PREPEND_BUDGET = 0.05;

// BreakingTicker capstone (story-005, M10): the ticker is the first global
// addition since the layout — verify it hydrates on every page type and
// honors the snapshot-pinned active/inactive contract across both apps.
// Snapshot pinning reuses the x-liveblog-snapshot header proven by the
// liveblog test below; the mock-api's snapshot rotation is operation-agnostic
// (variants.ts marks ArchipelagoBreakingTickerQuery as snapshotted: true).
// The build bakes PUBLIC_LIVEBLOG_POLL_INTERVAL_MS=500 and BreakingTicker
// reads the same env var via the shared resolvePollIntervalMs helper, so the
// polling-detects-change probe sees the next tick within ~1s.
const TICKER_PAGE_TYPES: { name: string; path: string }[] = [
  { name: 'homepage', path: '/' },
  { name: 'article', path: `/news/${KNOWN_ARTICLE_SLUG}` },
  { name: 'section', path: `/${SECTION_VARIANTS[0].slug}` },
  { name: 'liveblog', path: LIVEBLOG_PATH },
];
// Snapshot fixture text — kept in sync with
// packages/mock-api/fixtures/ArchipelagoBreakingTickerQuery--snapshot-{1,2}.json.
// If the fixtures are re-recorded, update these strings.
const TICKER_TEXT_SNAPSHOT_1 =
  'Lebanon ceasefire collapses as Israeli strikes resume across the south.';
const TICKER_TEXT_SNAPSHOT_2 =
  'UN Security Council convenes emergency session as Lebanon casualties rise above 50.';
// Wait long enough that one acceptance-build poll cycle has surely fired
// (PUBLIC_LIVEBLOG_POLL_INTERVAL_MS=500 baked into both apps' test:acceptance
// scripts; 1500ms gives ~3 cycles of headroom for slow CI).
const POLL_WAIT_MS = 1_500;

// HTML5 forbids nested <main> landmarks. Qwik's layout wraps every route in
// <main>; per-route components must NOT add another (use <div> with the
// content-width classes instead). Astro's BaseLayout doesn't add <main>, so
// the per-page <main> is the only landmark. Either way: exactly 1.
function expectSingleMain(html: string, label: string): void {
  const mainCount = (html.match(/<main\b/g) ?? []).length;
  expect(mainCount, `${label} should have exactly 1 <main> landmark`).toBe(1);
}

export function runAcceptanceSuite(target: Target): void {
  const APP_URL = `http://127.0.0.1:${APP_PORT[target]}/`;

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

    // Waits for the BreakingTicker banner's text content to include the given
    // string. Used by the snapshot-1 assertion + polling-detects-change probe.
    async function waitForBannerText(page: Page, text: string, timeoutMs = 10_000): Promise<void> {
      await page.waitForFunction(
        (txt: string) => {
          const el = document.querySelector('[data-breaking-ticker-banner] .breaking-ticker-text');
          return !!el && (el.textContent ?? '').includes(txt);
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

    // The article LCP image must be preloaded so the browser starts the
    // fetch before parsing reaches the <img>. fetchpriority=high alone
    // reorders after parser discovery; preload starts it immediately.
    // Both apps emit `<link rel="preload" as="image" href=".../?w=800&...">`
    // matching LeadImage's 800w srcset entry so the browser reuses the
    // preloaded bytes.
    it('preloads the article LCP image with rel=preload as=image', async () => {
      const html = await fetch(
        `http://127.0.0.1:${APP_PORT[target]}/news/${KNOWN_ARTICLE_SLUG}`,
      ).then((r) => r.text());
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
      const html = await fetch(
        `http://127.0.0.1:${APP_PORT[target]}/news/${KNOWN_ARTICLE_SLUG}`,
      ).then((r) => r.text());
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

    // Section Front capstone (story-003): both apps must serve /{section}
    // for both geographic and topic dispatch, append on LoadMore click
    // without URL change, and meet the M8 INP gate.

    it('returns HTTP 404 for an unknown section slug', async () => {
      const response = await fetch(`http://127.0.0.1:${APP_PORT[target]}/garbage-xyz-no-fixture`);
      expect(response.status).toBe(404);
    });

    for (const variant of SECTION_VARIANTS) {
      it(`returns HTTP 200 + renders ${SECTION_PAGE_SIZE} cards + section heading at /${variant.slug} (${variant.name})`, async () => {
        const response = await fetch(`http://127.0.0.1:${APP_PORT[target]}/${variant.slug}`);
        // Pin the status explicitly — the body assertions below would also
        // catch a 4xx (since the title/article markers wouldn't render), but
        // an explicit 200 check fails closer to the actual problem when the
        // response shape changes for any other reason.
        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain('<h1');
        expect(html).toContain(variant.expectedTitle);
        const articleCount = (html.match(/<article\b/g) ?? []).length;
        expect(articleCount).toBe(SECTION_PAGE_SIZE);
        // The first card's featured image is the LCP candidate for the 3-col
        // grid layout — both apps' [section] route emits a <link rel=preload
        // as=image> for it. Mirrors the article-page assertion above.
        expect(html).toMatch(LCP_IMAGE_PRELOAD_RE);
        expectSingleMain(html, `${variant.name} section page`);
      });

      it(
        `appends ${SECTION_PAGE_SIZE} cards on Load More click without navigation under ${SECTION_LOADMORE_LATENCY_BUDGET_MS}ms (${variant.name})`,
        { timeout: 30_000 },
        async () => {
          const url = `http://127.0.0.1:${APP_PORT[target]}/${variant.slug}`;
          const result = await withPage(
            DESKTOP,
            async (page) => {
              // Wait for `data-hydrated="true"` on the LoadMore button before
              // clicking. The contract: a LoadMoreButton emits this attribute
              // once its click handler is bound (Astro Preact mount, Qwik
              // useVisibleTask$ with document-ready strategy). aria-busy alone
              // matches even at SSR time, so a click on aria-busy could race
              // the framework and either drop the click (Astro pre-idle) or
              // burn the latency budget on a QRL chunk download (Qwik).
              // Waiting on data-hydrated removes both timing windows.
              await page.waitForFunction(
                (size: number) =>
                  document.querySelectorAll('article').length === size &&
                  !!document.querySelector('button[data-hydrated="true"]'),
                { timeout: 10_000 },
                SECTION_PAGE_SIZE,
              );
              // Capture URL after navigation (Qwik 301-redirects /middle-east →
              // /middle-east/, so the post-click URL is compared to this resolved
              // value, not the original goto URL).
              const urlBeforeClick = page.url();

              const t0 = Date.now();
              await page.click('button[data-hydrated="true"]');

              await page.waitForFunction(
                (size: number) => document.querySelectorAll('article').length >= size * 2,
                { timeout: 15_000 },
                SECTION_PAGE_SIZE,
              );
              const elapsedMs = Date.now() - t0;

              const finalState = await page.evaluate(() => ({
                cardCount: document.querySelectorAll('article').length,
                url: window.location.href,
              }));
              return { ...finalState, urlBeforeClick, elapsedMs };
            },
            url,
          );
          // Production constraint: pagination is client-side offset only — the
          // URL must not change as a result of the click (no ?page=N, ?offset=N,
          // path mutation, or hash). Compare to the post-navigation URL so a
          // 301 trailing-slash redirect (Qwik) doesn't false-fail.
          expect(result.url).toBe(result.urlBeforeClick);
          expect(result.elapsedMs).toBeLessThanOrEqual(SECTION_LOADMORE_LATENCY_BUDGET_MS);
        },
      );
    }

    // Live blog capstone (story-005, M9 done-state): the Updater island
    // must poll, prepend new entries, and not break the CLS-on-prepend
    // budget. Mock-api auto-rotates snapshots every 200ms (env override);
    // both apps' builds bake PUBLIC_LIVEBLOG_POLL_INTERVAL_MS=500 so the
    // Updater fires within ~1s. The PerformanceObserver with buffered:false
    // captures only layout-shift entries that fire AFTER the observer is
    // installed — scoped to the prepend window, not page load (which would
    // include initial render shifts that are not the polling-prepend's
    // fault). hadRecentInput excludes shifts attributable to user input.
    it(
      'live-blog Updater polls + prepends new entries with no CLS regression',
      { timeout: 30_000 },
      async () => {
        const url = `http://127.0.0.1:${APP_PORT[target]}${LIVEBLOG_PATH}`;
        // setExtraHTTPHeaders applies to ALL outgoing browser requests,
        // including the navigation request. The header on the SSR
        // navigation is harmless: the app server hits mock-api with its
        // own Node fetch (no header forwarding), so SSR resolves at
        // env-pinned snapshot-0 regardless. Only the browser-originated
        // polling fetches carry the header — those resolve at snapshot-2.
        await withPageAndHeaders(
          { 'x-liveblog-snapshot': '2' },
          async (page) => {
            await waitUntilHydrated(page, 'section[data-live-blog-updater]');

            // Bootstrap: snapshot initial entry IDs AND install the layout-
            // shift observer in one round-trip. buffered:false skips shifts
            // that fired before this point (initial render, font swap) so we
            // only measure the polling-prepend window.
            const initialEntryIds = await page.evaluate(() => {
              const w = window as unknown as { __cls: number; __obs: PerformanceObserver };
              w.__cls = 0;
              const obs = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  const ls = entry as PerformanceEntry & {
                    value: number;
                    hadRecentInput: boolean;
                  };
                  if (!ls.hadRecentInput) w.__cls += ls.value;
                }
              });
              obs.observe({ type: 'layout-shift', buffered: false });
              w.__obs = obs;
              return Array.from(document.querySelectorAll('[data-entry-id]')).map(
                (el) => el.getAttribute('data-entry-id') ?? '',
              );
            });

            // Wait for the Updater to prepend at least one new entry — the
            // count of [data-entry-id] elements grows because both apps'
            // Updater section appends polled entries with the same data-
            // entry-id wrapper as the SSR'd entries below.
            await page.waitForFunction(
              (initial: number) => document.querySelectorAll('[data-entry-id]').length > initial,
              { timeout: 15_000 },
              initialEntryIds.length,
            );

            // Teardown: disconnect observer, return CLS + final IDs in one
            // round-trip.
            const { cls, finalEntryIds } = await page.evaluate(() => {
              const w = window as unknown as { __cls: number; __obs: PerformanceObserver };
              w.__obs.disconnect();
              return {
                cls: w.__cls,
                finalEntryIds: Array.from(document.querySelectorAll('[data-entry-id]')).map(
                  (el) => el.getAttribute('data-entry-id') ?? '',
                ),
              };
            });

            expect(initialEntryIds.length).toBeGreaterThan(0);
            expect(finalEntryIds.length).toBeGreaterThan(initialEntryIds.length);
            expect(cls).toBeLessThanOrEqual(CLS_PREPEND_BUDGET);
          },
          url,
        );
      },
    );

    // BreakingTicker capstone (story-005, M10): four page types × two
    // snapshots each — verifies hydration + active/inactive contract across
    // both apps. Header pinning works because BreakingTicker's first poll is
    // browser-originated (post-hydration); SSR fetches go server→mock-api
    // with no header forwarding so the SSR HTML always sees env-pinned
    // snapshot-0 (test:acceptance pins SNAPSHOT_INDEX=0). The component
    // useState(null) means SSR never renders the banner regardless — only
    // the post-hydration first poll surfaces snapshot-N's content.
    for (const pageType of TICKER_PAGE_TYPES) {
      it(
        `renders [data-breaking-ticker] hydrated on ${pageType.name} with snapshot-0 (no banner)`,
        { timeout: 20_000 },
        async () => {
          const url = `http://127.0.0.1:${APP_PORT[target]}${pageType.path}`;
          await withPageAndHeaders(
            { 'x-liveblog-snapshot': '0' },
            async (page) => {
              await waitUntilHydrated(page, 'section[data-breaking-ticker]');
              // Sleep so the first browser poll has surely completed; banner
              // must remain absent because snapshot-0 is the empty fixture.
              await new Promise((r) => setTimeout(r, POLL_WAIT_MS));
              const bannerExists = await page.evaluate(
                () => !!document.querySelector('[data-breaking-ticker-banner]'),
              );
              expect(bannerExists, `${pageType.name}: snapshot-0 must not render banner`).toBe(
                false,
              );
            },
            url,
          );
        },
      );

      it(
        `renders banner with snapshot-1 tickerText + dismiss button on ${pageType.name}`,
        { timeout: 20_000 },
        async () => {
          const url = `http://127.0.0.1:${APP_PORT[target]}${pageType.path}`;
          await withPageAndHeaders(
            { 'x-liveblog-snapshot': '1' },
            async (page) => {
              await waitForBannerText(page, TICKER_TEXT_SNAPSHOT_1);
              const dismissExists = await page.evaluate(
                () => !!document.querySelector('button[data-breaking-ticker-dismiss]'),
              );
              expect(dismissExists, `${pageType.name}: dismiss button missing`).toBe(true);
            },
            url,
          );
        },
      );
    }

    // Polling-detects-change: load with snapshot-1 header, wait for the
    // banner to render snapshot-1 text, flip the header to snapshot-2, wait
    // for the next browser poll (500ms cadence) to swap the banner text.
    // Single test on the homepage — the per-page-type assertions above
    // already proved hydration on every page.
    it(
      'breaking-ticker polling detects snapshot change and updates banner text',
      { timeout: 30_000 },
      async () => {
        await withPageAndHeaders({ 'x-liveblog-snapshot': '1' }, async (page) => {
          await waitForBannerText(page, TICKER_TEXT_SNAPSHOT_1);
          // Subsequent browser fetches (the next poll) carry the new header.
          await page.setExtraHTTPHeaders({ 'x-liveblog-snapshot': '2' });
          await waitForBannerText(page, TICKER_TEXT_SNAPSHOT_2);
        });
      },
    );

    // Dismiss is component-local state — once clicked, the banner must not
    // return on subsequent polls even though the server still says active.
    it(
      'breaking-ticker dismiss removes banner and it does not return on next poll',
      { timeout: 20_000 },
      async () => {
        await withPageAndHeaders({ 'x-liveblog-snapshot': '1' }, async (page) => {
          await waitForBannerText(page, TICKER_TEXT_SNAPSHOT_1);
          await page.click('button[data-breaking-ticker-dismiss]');
          await page.waitForFunction(
            () => !document.querySelector('[data-breaking-ticker-banner]'),
            { timeout: 5_000 },
          );
          // Sleep so the next snapshot-1 poll has fired; banner must remain
          // absent because dismissed is local state, not server-driven.
          await new Promise((r) => setTimeout(r, POLL_WAIT_MS));
          const bannerExists = await page.evaluate(
            () => !!document.querySelector('[data-breaking-ticker-banner]'),
          );
          expect(bannerExists, 'banner returned after dismiss').toBe(false);
        });
      },
    );

    // Capstone article suite (story-008): one navigated DOM probe per
    // fixture variant, asserting the article shell, the embed-specific DOM
    // signature, and the related-stories module. Cross-app divergence here
    // is the fairness signal — both apps must render the same set of
    // structural elements from identical fixture data.
    for (const variant of ARTICLE_VARIANTS) {
      it(`renders ${variant.name} embed + related-stories at /news/${variant.slug}`, async () => {
        const url = `http://127.0.0.1:${APP_PORT[target]}/news/${variant.slug}`;
        const result = await withPage(
          DESKTOP,
          (page) =>
            page.evaluate(
              (sig) => ({
                article: !!document.querySelector('article'),
                embed: !!document.querySelector(sig),
                relatedCount: document.querySelectorAll('section.related-stories a').length,
              }),
              variant.signature,
            ),
          url,
        );
        expect(result.article, `${variant.name}: <article> missing`).toBe(true);
        expect(result.embed, `${variant.name}: ${variant.signature} missing`).toBe(true);
        expect(
          result.relatedCount,
          `${variant.name}: related-stories link count out of bounds`,
        ).toBeGreaterThanOrEqual(MIN_RELATED);
        expect(result.relatedCount).toBeLessThanOrEqual(MAX_RELATED);
      });
    }
  });
}
