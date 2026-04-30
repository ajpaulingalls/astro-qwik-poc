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

// Mock createPollLoop so the wiring-options test can capture what the
// component passes. Default impl runs a single immediate tick (mimicking
// the real helper's immediate:true behavior the BreakingTicker uses) so
// the render-shell tests still see the post-fetch banner state.
const { createPollLoopMock } = vi.hoisted(() => ({
  createPollLoopMock: vi.fn((opts: Record<string, unknown>) => {
    const tick = opts.tick as () => unknown;
    const onResult = opts.onResult as ((v: unknown) => void) | undefined;
    const onEmpty = opts.onEmpty as (() => void) | undefined;
    void Promise.resolve(tick()).then((v) => {
      if (v === null || v === undefined) onEmpty?.();
      else onResult?.(v);
    });
    return { stop: vi.fn() };
  }),
}));
vi.mock('@aje-poc/shared-types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aje-poc/shared-types')>();
  return { ...actual, createPollLoop: createPollLoopMock };
});

import {
  type BreakingTicker as Data,
  type PollLoopOptions,
  MAX_CONSECUTIVE_EMPTY_POLLS,
  TICKER_POLL_INTERVAL_MS,
  resolvePollIntervalMs,
} from '@aje-poc/shared-types';
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

// Wiring contract: Qwik BreakingTicker must pass the ticker-specific options
// to the shared createPollLoop helper. Diverges from LiveBlogUpdater on two
// keys — immediate:true (banner populates on first paint, no SSR seed) and
// onEmpty (active→null transition must clear the displayed banner). Without
// onEmpty the helper's null short-circuit would leave the prior banner up.
describe('BreakingTicker createPollLoop wiring', () => {
  let mock: MockedFetch | undefined;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
    createPollLoopMock.mockClear();
    mock = mockFetchOnce(tickerResponse(null));
  });

  afterEach(() => {
    mock?.restore();
    mock = undefined;
    vi.unstubAllEnvs();
  });

  it('passes ticker-specific label, immediate, onEmpty, onError, shouldSkip + concurrency knobs', async () => {
    const { render } = await createDOM();
    await render(<BreakingTicker />);

    expect(createPollLoopMock).toHaveBeenCalledOnce();
    const calls = createPollLoopMock.mock.calls as unknown as Array<[PollLoopOptions<Data>]>;
    const opts = calls[0]![0];

    expect(opts.label).toBe('breaking-ticker');
    expect(opts.maxConsecutiveEmpty).toBe(MAX_CONSECUTIVE_EMPTY_POLLS);
    expect(opts.intervalMs).toBe(
      resolvePollIntervalMs(
        import.meta.env.PUBLIC_LIVEBLOG_POLL_INTERVAL_MS,
        TICKER_POLL_INTERVAL_MS,
      ),
    );
    expect(opts.immediate).toBe(true); // diverges from LiveBlogUpdater — no SSR seed
    expect(typeof opts.tick).toBe('function');
    expect(typeof opts.onResult).toBe('function');
    expect(typeof opts.onEmpty).toBe('function'); // active→null clears banner

    expect(opts.shouldSkip).toBeTypeOf('function');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    expect(opts.shouldSkip!()).toBe(true);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    expect(opts.shouldSkip!()).toBe(false);

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    opts.onError!(new Error('boom'));
    expect(errSpy).toHaveBeenCalledWith('breaking-ticker: poll tick failed:', expect.any(Error));
    errSpy.mockRestore();
  });
});
