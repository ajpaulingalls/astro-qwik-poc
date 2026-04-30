// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/preact';
import { mockFetchOnce, mockFetchSequence } from '@aje-poc/shared-test-helpers';
import {
  MAX_CONSECUTIVE_EMPTY_POLLS,
  TICKER_POLL_INTERVAL_MS,
  type BreakingTicker as Data,
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

const ACTIVE_2: Data = {
  ...ACTIVE,
  post: { ...ACTIVE.post!, id: '4515247' },
  tickerText: 'UN Security Council convenes emergency session as Lebanon ceasefire fails.',
  modified: '2026-04-29T11:42:00',
};

function tickerResponse(ticker: Data | null) {
  return { body: { data: { breakingNews: ticker } } };
}

describe('BreakingTicker', () => {
  let mock: ReturnType<typeof mockFetchOnce> | undefined;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    mock?.restore();
    vi.unstubAllEnvs();
    cleanup();
  });

  it('renders the [data-breaking-ticker] region with data-hydrated flipped after first fetch', async () => {
    mock = mockFetchOnce(tickerResponse(null));
    const { container } = render(<BreakingTicker />);
    const region = container.querySelector('[data-breaking-ticker]');
    expect(region).not.toBeNull();
    await waitFor(() => {
      expect(region!.getAttribute('data-hydrated')).toBe('true');
    });
  });

  it('hides banner when fetched ticker is null', async () => {
    mock = mockFetchOnce(tickerResponse(null));
    const { container } = render(<BreakingTicker />);
    await waitFor(() =>
      expect(
        container.querySelector('[data-breaking-ticker][data-hydrated="true"]'),
      ).not.toBeNull(),
    );
    expect(container.querySelector('[data-breaking-ticker-banner]')).toBeNull();
  });

  it('hides banner when tickerText is whitespace-only', async () => {
    mock = mockFetchOnce(tickerResponse({ ...ACTIVE, tickerText: '   ' }));
    const { container } = render(<BreakingTicker />);
    await waitFor(() =>
      expect(
        container.querySelector('[data-breaking-ticker][data-hydrated="true"]'),
      ).not.toBeNull(),
    );
    expect(container.querySelector('[data-breaking-ticker-banner]')).toBeNull();
  });

  it('shows banner with tickerText and dismiss button when active', async () => {
    mock = mockFetchOnce(tickerResponse(ACTIVE));
    const { container } = render(<BreakingTicker />);
    await waitFor(() =>
      expect(container.querySelector('[data-breaking-ticker-banner]')).not.toBeNull(),
    );
    const banner = container.querySelector('[data-breaking-ticker-banner]')!;
    expect(banner.textContent).toContain(ACTIVE.tickerText!);
    expect(container.querySelector('button[data-breaking-ticker-dismiss]')).not.toBeNull();
  });

  it('removes banner from DOM when dismiss button is clicked', async () => {
    mock = mockFetchOnce(tickerResponse(ACTIVE));
    const { container } = render(<BreakingTicker />);
    await waitFor(() =>
      expect(container.querySelector('[data-breaking-ticker-banner]')).not.toBeNull(),
    );
    container.querySelector<HTMLButtonElement>('button[data-breaking-ticker-dismiss]')!.click();
    await waitFor(() =>
      expect(container.querySelector('[data-breaking-ticker-banner]')).toBeNull(),
    );
  });

  it('polls every TICKER_POLL_INTERVAL_MS and updates banner content', async () => {
    mock = mockFetchSequence([tickerResponse(ACTIVE), tickerResponse(ACTIVE_2)]);
    const { container } = render(<BreakingTicker />);
    await waitFor(() =>
      expect(container.querySelector('[data-breaking-ticker-banner]')?.textContent).toContain(
        ACTIVE.tickerText!,
      ),
    );
    await vi.advanceTimersByTimeAsync(TICKER_POLL_INTERVAL_MS);
    await waitFor(() =>
      expect(container.querySelector('[data-breaking-ticker-banner]')?.textContent).toContain(
        ACTIVE_2.tickerText!,
      ),
    );
  });

  it('clears banner when polling later returns null (active→null transition)', async () => {
    mock = mockFetchSequence([tickerResponse(ACTIVE), tickerResponse(null)]);
    const { container } = render(<BreakingTicker />);
    await waitFor(() =>
      expect(container.querySelector('[data-breaking-ticker-banner]')).not.toBeNull(),
    );
    // Next tick: API returns null. Banner must clear, not stay stuck.
    await vi.advanceTimersByTimeAsync(TICKER_POLL_INTERVAL_MS);
    await waitFor(() =>
      expect(container.querySelector('[data-breaking-ticker-banner]')).toBeNull(),
    );
  });

  it('stops polling after MAX_CONSECUTIVE_EMPTY_POLLS null responses (deletion guard)', async () => {
    // Mock returns null banner (snapshot-0 equivalent) every poll → counter
    // increments each tick. After MAX cycles the interval clears; further
    // time advances must NOT produce additional fetches.
    const sequence = Array.from({ length: MAX_CONSECUTIVE_EMPTY_POLLS + 5 }, () =>
      tickerResponse(null),
    );
    mock = mockFetchSequence(sequence);
    render(<BreakingTicker />);

    for (let i = 0; i < MAX_CONSECUTIVE_EMPTY_POLLS; i++) {
      await vi.advanceTimersByTimeAsync(TICKER_POLL_INTERVAL_MS);
    }
    await waitFor(() => expect(mock!.calls.length).toBe(MAX_CONSECUTIVE_EMPTY_POLLS));

    const callsAtThreshold = mock!.calls.length;
    await vi.advanceTimersByTimeAsync(TICKER_POLL_INTERVAL_MS * 2);
    expect(mock!.calls.length).toBe(callsAtThreshold);
  });

  it('skips polling fetches while document.hidden is true', async () => {
    mock = mockFetchSequence([tickerResponse(null)]);
    render(<BreakingTicker />);
    await waitFor(() => expect(mock!.calls).toHaveLength(1));
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    try {
      await vi.advanceTimersByTimeAsync(TICKER_POLL_INTERVAL_MS);
      expect(mock!.calls).toHaveLength(1);
    } finally {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    }
  });
});
