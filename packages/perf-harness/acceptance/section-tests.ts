// Section Front capstone (story-003): both apps must serve /{section} for
// both geographic and topic dispatch, append on LoadMore click without URL
// change, and meet the M8 INP gate.

import { it, expect } from 'vitest';
import { SECTION_PAGE_SIZE } from '@aje-poc/shared-types';
import {
  type AcceptanceContext,
  DESKTOP,
  LCP_IMAGE_PRELOAD_RE,
  appHttpBase,
  expectSingleMain,
} from './shared.ts';

interface SectionVariant {
  name: 'geographic' | 'topic';
  slug: string;
  expectedTitle: string;
}
export const SECTION_VARIANTS: SectionVariant[] = [
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

export function registerSectionTests(ctx: AcceptanceContext): void {
  it('returns HTTP 404 for an unknown section slug', async () => {
    const response = await fetch(`${appHttpBase(ctx.target)}/garbage-xyz-no-fixture`);
    expect(response.status).toBe(404);
  });

  for (const variant of SECTION_VARIANTS) {
    it(`returns HTTP 200 + renders ${SECTION_PAGE_SIZE} cards + section heading at /${variant.slug} (${variant.name})`, async () => {
      const response = await fetch(`${appHttpBase(ctx.target)}/${variant.slug}`);
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
        const url = `${appHttpBase(ctx.target)}/${variant.slug}`;
        const result = await ctx.withPage(
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
}
