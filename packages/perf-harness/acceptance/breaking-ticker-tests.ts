// BreakingTicker capstone (story-005, M10): the ticker is the first global
// addition since the layout — verify it hydrates on every page type and
// honors the snapshot-pinned active/inactive contract across both apps.
// Snapshot pinning reuses the x-liveblog-snapshot header proven by the
// liveblog test; the mock-api's snapshot rotation is operation-agnostic
// (variants.ts marks ArchipelagoBreakingTickerQuery as snapshotted: true).
// The build bakes PUBLIC_LIVEBLOG_POLL_INTERVAL_MS=500 and BreakingTicker
// reads the same env var via the shared resolvePollIntervalMs helper, so the
// polling-detects-change probe sees the next tick within ~1s.

import { it, expect } from 'vitest';
import {
  type AcceptanceContext,
  CLS_PREPEND_BUDGET,
  KNOWN_ARTICLE_SLUG,
  appHttpBase,
  installClsObserver,
} from './shared.ts';
import { LIVEBLOG_PATH } from './live-blog-tests.ts';
import { SECTION_VARIANTS } from './section-tests.ts';

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

export function registerBreakingTickerTests(ctx: AcceptanceContext): void {
  // Four page types × two snapshots each — verifies hydration + active/
  // inactive contract across both apps. Header pinning works because
  // BreakingTicker's first poll is browser-originated (post-hydration); SSR
  // fetches go server→mock-api with no header forwarding so the SSR HTML
  // always sees env-pinned snapshot-0 (test:acceptance pins SNAPSHOT_INDEX=0).
  // The component useState(null) means SSR never renders the banner regardless
  // — only the post-hydration first poll surfaces snapshot-N's content.
  for (const pageType of TICKER_PAGE_TYPES) {
    it(
      `renders [data-breaking-ticker] hydrated on ${pageType.name} with snapshot-0 (no banner)`,
      { timeout: 20_000 },
      async () => {
        const url = `${appHttpBase(ctx.target)}${pageType.path}`;
        await ctx.withPageAndHeaders(
          { 'x-liveblog-snapshot': '0' },
          async (page) => {
            await ctx.waitUntilHydrated(page, 'section[data-breaking-ticker]');
            // Sleep so the first browser poll has surely completed; banner
            // must remain absent because snapshot-0 is the empty fixture.
            await new Promise((r) => setTimeout(r, POLL_WAIT_MS));
            const bannerExists = await page.evaluate(
              () => !!document.querySelector('[data-breaking-ticker-banner]'),
            );
            expect(bannerExists, `${pageType.name}: snapshot-0 must not render banner`).toBe(false);
          },
          url,
        );
      },
    );

    it(
      `renders banner with snapshot-1 tickerText + dismiss button on ${pageType.name}`,
      { timeout: 20_000 },
      async () => {
        const url = `${appHttpBase(ctx.target)}${pageType.path}`;
        await ctx.withPageAndHeaders(
          { 'x-liveblog-snapshot': '1' },
          async (page) => {
            await ctx.waitForBannerText(page, TICKER_TEXT_SNAPSHOT_1);
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

  // Polling-detects-change: load with snapshot-1 header, wait for the banner
  // to render snapshot-1 text, flip the header to snapshot-2, wait for the
  // next browser poll (500ms cadence) to swap the banner text. Single test
  // on the homepage — the per-page-type assertions above already proved
  // hydration on every page.
  it(
    'breaking-ticker polling detects snapshot change and updates banner text',
    { timeout: 30_000 },
    async () => {
      await ctx.withPageAndHeaders({ 'x-liveblog-snapshot': '1' }, async (page) => {
        await ctx.waitForBannerText(page, TICKER_TEXT_SNAPSHOT_1);
        // Subsequent browser fetches (the next poll) carry the new header.
        await page.setExtraHTTPHeaders({ 'x-liveblog-snapshot': '2' });
        await ctx.waitForBannerText(page, TICKER_TEXT_SNAPSHOT_2);
      });
    },
  );

  // Dismiss is component-local state — once clicked, the banner must not
  // return on subsequent polls even though the server still says active.
  it(
    'breaking-ticker dismiss removes banner and it does not return on next poll',
    { timeout: 20_000 },
    async () => {
      await ctx.withPageAndHeaders({ 'x-liveblog-snapshot': '1' }, async (page) => {
        await ctx.waitForBannerText(page, TICKER_TEXT_SNAPSHOT_1);
        await page.click('button[data-breaking-ticker-dismiss]');
        await page.waitForFunction(() => !document.querySelector('[data-breaking-ticker-banner]'), {
          timeout: 5_000,
        });
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

  // CLS regression guard: BreakingTicker is overlaid via position:fixed
  // (packages/shared-styles/breaking-ticker.css .breaking-ticker) so the
  // banner appearing post-hydration must not push document content. Mirrors
  // the live-blog Updater CLS gate. Without this probe a future CSS change
  // that drops position:fixed could re-introduce the regression that
  // story-005 measured at CLS 0.081 across article + section-topic.
  it('breaking-ticker banner appearance does not regress CLS', { timeout: 20_000 }, async () => {
    await ctx.withPageAndHeaders({ 'x-liveblog-snapshot': '1' }, async (page) => {
      await ctx.waitUntilHydrated(page, 'section[data-breaking-ticker]');
      // Install observer BEFORE the polled banner appears so we measure only
      // the appear window (not initial render / font swap).
      const readCls = await installClsObserver(page);
      await ctx.waitForBannerText(page, TICKER_TEXT_SNAPSHOT_1);
      const cls = await readCls();
      expect(cls).toBeLessThanOrEqual(CLS_PREPEND_BUDGET);
    });
  });
}
