// M11 capstone (story-005): live-endpoint acceptance tests asserting all
// four page types render against https://www.aljazeera.com when the operator
// opts in via LIVE_ENDPOINT=1. Default-off so CI/pre-commit loops never
// reach live.
//
// Live homepage articles rotate ~weekly (smoke report §F3), so hardcoded
// slugs would force docs treadmill. Discovery at runtime is the trade-off:
// the test self-heals across rotation but fails noisily on a no-liveblog
// day. DEMO.md §"Liveblog availability" names the operator's recourse.

import { describe, it, expect } from 'vitest';
import { type Page } from 'puppeteer-core';
import { LIVEBLOG_PATH_PREFIX, NEWS_PATH_PREFIX } from '@aje-poc/shared-types';
import { type AcceptanceContext, DESKTOP, appHttpBase, expectSingleMain } from './shared.ts';

export interface FirstLivePaths {
  article: string;
  liveblog: string;
}

// Walks `hrefs` once and picks the first matching anchor for each surface.
// `/news/liveblog/...` is checked BEFORE `/news/...` so a liveblog href is
// not misclassified as an article (the liveblog prefix is a strict subpath
// of the article prefix).
export function parseFirstLivePaths(hrefs: readonly string[]): FirstLivePaths {
  let article: string | undefined;
  let liveblog: string | undefined;
  for (const href of hrefs) {
    if (!href.startsWith('/')) continue;
    if (!liveblog && href.startsWith(LIVEBLOG_PATH_PREFIX)) {
      liveblog = href;
      continue;
    }
    if (!article && href.startsWith(NEWS_PATH_PREFIX) && !href.startsWith(LIVEBLOG_PATH_PREFIX)) {
      article = href;
    }
    if (article && liveblog) break;
  }

  if (!article) {
    throw new Error(
      `parseFirstLivePaths: no article link found (no anchor matching ${NEWS_PATH_PREFIX}<...>)`,
    );
  }
  if (!liveblog) {
    const sample = hrefs
      .filter((h) => h.startsWith(NEWS_PATH_PREFIX))
      .slice(0, 5)
      .join(', ');
    throw new Error(
      `parseFirstLivePaths: no liveblog link found (no anchor matching ${LIVEBLOG_PATH_PREFIX}<...>). First 5 article links seen: ${sample || '(none)'}`,
    );
  }
  return { article, liveblog };
}

// Reads the homepage anchor list via puppeteer and resolves it through
// parseFirstLivePaths. Kept thin so the parsing logic stays unit-testable
// in isolation.
async function findLivePaths(ctx: AcceptanceContext): Promise<FirstLivePaths> {
  return ctx.withPage(DESKTOP, async (page) => {
    const hrefs = await page.$$eval('a[href]', (anchors) =>
      anchors.map((a) => a.getAttribute('href') ?? ''),
    );
    return parseFirstLivePaths(hrefs);
  });
}

// Errors that signal "the route's data fetch failed" — the upstream
// drift scenario this live suite is designed to catch. Pattern matches
// the ACQ wording verbatim so a console error like "GraphQL response
// missing data" still trips the regex.
const RUNTIME_ERROR_RE = /Failed to fetch|GraphQL/i;

async function navigateAndCaptureErrors(
  ctx: AcceptanceContext,
  url: string,
  assert: (page: Page) => Promise<void> | void,
): Promise<string[]> {
  const errors: string[] = [];
  await ctx.withFreshPage(DESKTOP, async (page) => {
    page.on('pageerror', (err) => errors.push(String(err.message)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
    // ACQ requires HTTP 200 on every page-type route. networkidle2 alone
    // resolves on 4xx/5xx too — assert the status explicitly.
    expect(response?.status(), `expected HTTP 200 from ${url}`).toBe(200);
    await assert(page);
  });
  return errors.filter((m) => RUNTIME_ERROR_RE.test(m));
}

// Tests that DOM/HTML invariants hold against live data, and that no
// fatal runtime errors fire during page load (catches the upstream-drift
// scenario where GraphQL silently returns no_posts_found and the route
// renders an empty shell). Render correctness only — CWV thresholds are
// out of scope (perf budgets need deterministic fixtures, see DEMO.md
// §"Demo vs perf").
//
// Wrapped in a `live-endpoint` describe so the test:acceptance:live
// npm script can scope `vitest -t live-endpoint` to JUST these tests —
// the rest of the suite asserts mock-fixture invariants that don't hold
// against live (CSP localhost:4455, fixture slugs, probe.png proxy, etc.).
//
// `it.skipIf` is defense-in-depth: even without the -t filter, the suite
// is silent unless LIVE_ENDPOINT=1 is exported. The skipIf reads
// process.env at test time (not module-load) so wrapper scripts flipping
// the env between runs take effect.
export function registerLiveEndpointTests(ctx: AcceptanceContext): void {
  describe('live-endpoint', () => {
    const skipIfDisabled = it.skipIf(process.env.LIVE_ENDPOINT !== '1');

    skipIfDisabled('homepage renders against aljazeera.com', async () => {
      const fatal = await navigateAndCaptureErrors(ctx, appHttpBase(ctx.target), async (page) => {
        const html = await page.content();
        expectSingleMain(html, 'live homepage');
        const articleCount = (html.match(/<article\b/g) ?? []).length;
        expect(articleCount).toBeGreaterThan(0);
      });
      expect(fatal, `runtime errors on homepage: ${fatal.join(' | ')}`).toEqual([]);
    });

    skipIfDisabled('geographic section /middle-east renders against aljazeera.com', async () => {
      const fatal = await navigateAndCaptureErrors(
        ctx,
        `${appHttpBase(ctx.target)}/middle-east`,
        async (page) => {
          const html = await page.content();
          expectSingleMain(html, 'live /middle-east');
          expect(html).toMatch(/<h1\b/);
          const articleCount = (html.match(/<article\b/g) ?? []).length;
          expect(articleCount).toBeGreaterThan(0);
        },
      );
      expect(fatal, `runtime errors on /middle-east: ${fatal.join(' | ')}`).toEqual([]);
    });

    skipIfDisabled('article (discovered slug) renders against aljazeera.com', async () => {
      const { article } = await findLivePaths(ctx);
      const fatal = await navigateAndCaptureErrors(
        ctx,
        `${appHttpBase(ctx.target)}${article}`,
        async (page) => {
          const html = await page.content();
          expectSingleMain(html, `live article ${article}`);
          expect(html).toMatch(/<h1\b/);
        },
      );
      expect(fatal, `runtime errors on ${article}: ${fatal.join(' | ')}`).toEqual([]);
    });

    skipIfDisabled('liveblog (discovered slug) renders against aljazeera.com', async () => {
      const { liveblog } = await findLivePaths(ctx);
      const fatal = await navigateAndCaptureErrors(
        ctx,
        `${appHttpBase(ctx.target)}${liveblog}`,
        async (page) => {
          const html = await page.content();
          expectSingleMain(html, `live liveblog ${liveblog}`);
          // Liveblog routes render at minimum the title heading + the
          // parent <article> shell. Update items hydrate after polling
          // kicks in; asserting the shell is the most stable cross-app
          // invariant.
          expect(html).toMatch(/<h1\b/);
        },
      );
      expect(fatal, `runtime errors on ${liveblog}: ${fatal.join(' | ')}`).toEqual([]);
    });
  });
}
