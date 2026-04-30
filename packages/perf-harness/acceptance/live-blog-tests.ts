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

import { it, expect } from 'vitest';
import {
  type AcceptanceContext,
  CLS_PREPEND_BUDGET,
  LIVEBLOG_PATH,
  appHttpBase,
  installClsObserver,
} from './shared.ts';

export function registerLiveBlogTests(ctx: AcceptanceContext): void {
  // The Updater island must poll, prepend new entries, and not break the
  // CLS-on-prepend budget. Mock-api auto-rotates snapshots every 200ms (env
  // override); both apps' builds bake PUBLIC_LIVEBLOG_POLL_INTERVAL_MS=500 so
  // the Updater fires within ~1s. The PerformanceObserver with buffered:false
  // captures only layout-shift entries that fire AFTER the observer is
  // installed — scoped to the prepend window, not page load (which would
  // include initial render shifts that are not the polling-prepend's fault).
  // hadRecentInput excludes shifts attributable to user input.
  it(
    'live-blog Updater polls + prepends new entries with no CLS regression',
    { timeout: 30_000 },
    async () => {
      const url = `${appHttpBase(ctx.target)}${LIVEBLOG_PATH}`;
      // setExtraHTTPHeaders applies to ALL outgoing browser requests,
      // including the navigation request. The header on the SSR
      // navigation is harmless: the app server hits mock-api with its
      // own Node fetch (no header forwarding), so SSR resolves at
      // env-pinned snapshot-0 regardless. Only the browser-originated
      // polling fetches carry the header — those resolve at snapshot-2.
      await ctx.withPageAndHeaders(
        { 'x-liveblog-snapshot': '2' },
        async (page) => {
          await ctx.waitUntilHydrated(page, 'section[data-live-blog-updater]');
          const readCls = await installClsObserver(page);

          const initialEntryIds = await page.evaluate(() =>
            Array.from(document.querySelectorAll('[data-entry-id]')).map(
              (el) => el.getAttribute('data-entry-id') ?? '',
            ),
          );

          // Wait for the Updater to prepend at least one new entry — the
          // count of [data-entry-id] elements grows because both apps'
          // Updater section appends polled entries with the same data-
          // entry-id wrapper as the SSR'd entries below.
          await page.waitForFunction(
            (initial: number) => document.querySelectorAll('[data-entry-id]').length > initial,
            { timeout: 15_000 },
            initialEntryIds.length,
          );

          const finalEntryIds = await page.evaluate(() =>
            Array.from(document.querySelectorAll('[data-entry-id]')).map(
              (el) => el.getAttribute('data-entry-id') ?? '',
            ),
          );
          const cls = await readCls();

          expect(initialEntryIds.length).toBeGreaterThan(0);
          expect(finalEntryIds.length).toBeGreaterThan(initialEntryIds.length);
          expect(cls).toBeLessThanOrEqual(CLS_PREPEND_BUDGET);
        },
        url,
      );
    },
  );
}
