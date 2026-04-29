// @vitest-environment happy-dom
//
// createDOM does fire useVisibleTask$ but with no qwikLoader bootstrap and no
// fake-timer support for the polling loop (SMM risk d2dcc5b0900f). These
// tests cover render shell + post-initial-fetch state; polling cadence and
// dismiss interaction are verified end-to-end in story-005's acceptance
// suite, mirroring the LiveBlogUpdater test scope.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { mockFetchOnce, type MockedFetch } from '@aje-poc/shared-test-helpers';
import type { BreakingTicker as Data } from '@aje-poc/shared-types';
import { BreakingTicker } from './BreakingTicker';

const ACTIVE: Data = {
  post: {
    id: '4515210',
    title: 'Lebanon ceasefire collapses',
    link: '/news/2026/4/29/lebanon-ceasefire-collapses',
  },
  tickerTitle: 'Breaking',
  tickerText: 'Lebanon ceasefire collapses as Israeli strikes resume across the south.',
  modified: '2026-04-29T08:15:00',
  link: '/news/2026/4/29/lebanon-ceasefire-collapses',
};

function tickerResponse(ticker: Data | null) {
  return { body: { data: { breakingNews: ticker } } };
}

describe('BreakingTicker (render shell)', () => {
  let mock: MockedFetch | undefined;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    mock = undefined;
    vi.unstubAllEnvs();
  });

  it('renders [data-breaking-ticker] with role=status + aria-live=polite', async () => {
    mock = mockFetchOnce(tickerResponse(null));
    const { screen, render } = await createDOM();
    await render(<BreakingTicker />);
    const region = screen.querySelector('[data-breaking-ticker]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-live')).toBe('polite');
  });

  it('hides banner when fetched ticker is null', async () => {
    mock = mockFetchOnce(tickerResponse(null));
    const { screen, render } = await createDOM();
    await render(<BreakingTicker />);
    expect(screen.querySelector('[data-breaking-ticker-banner]') ?? null).toBeNull();
  });

  it('renders banner with tickerText + dismiss button after active fetch settles', async () => {
    mock = mockFetchOnce(tickerResponse(ACTIVE));
    const { screen, render } = await createDOM();
    await render(<BreakingTicker />);
    // createDOM has no waitFor; spin the microtask queue past the chain
    // (fetch resolve → mock body parse → signal assignment → re-render).
    // Brittle to extra awaits in tick() — extract to a helper if a third
    // Qwik test needs it.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    const banner = screen.querySelector('[data-breaking-ticker-banner]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain(ACTIVE.tickerText!);
    expect(screen.querySelector('button[data-breaking-ticker-dismiss]')).not.toBeNull();
  });
});
