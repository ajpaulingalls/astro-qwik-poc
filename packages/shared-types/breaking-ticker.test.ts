import { describe, it, expect } from 'vitest';
import { type BreakingTicker, isBreakingTickerActive, TICKER_POLL_INTERVAL_MS } from './index';

const inactive: BreakingTicker = {
  post: null,
  tickerTitle: null,
  tickerText: null,
  modified: null,
  link: null,
};

const active: BreakingTicker = {
  post: {
    id: '4515210',
    title: 'Lebanon ceasefire collapses; aid corridor closed',
    link: '/news/2026/4/29/lebanon-ceasefire-collapses-aid-corridor-closed',
  },
  tickerTitle: 'Breaking',
  tickerText: 'Lebanon ceasefire collapses as Israeli strikes resume across the south.',
  modified: '2026-04-29T08:15:00',
  link: '/news/2026/4/29/lebanon-ceasefire-collapses-aid-corridor-closed',
};

describe('isBreakingTickerActive', () => {
  it('returns false when ticker is null', () => {
    expect(isBreakingTickerActive(null)).toBe(false);
  });

  it('returns false when tickerText is null (empty no-banner snapshot)', () => {
    expect(isBreakingTickerActive(inactive)).toBe(false);
  });

  it('returns false when tickerText is whitespace-only (defensive guard)', () => {
    expect(isBreakingTickerActive({ ...active, tickerText: '   ' })).toBe(false);
  });

  it('returns false when tickerText is the empty string (defensive guard)', () => {
    expect(isBreakingTickerActive({ ...active, tickerText: '' })).toBe(false);
  });

  it('returns true when tickerText contains real content', () => {
    expect(isBreakingTickerActive(active)).toBe(true);
  });
});

describe('TICKER_POLL_INTERVAL_MS', () => {
  it('is 30s', () => {
    expect(TICKER_POLL_INTERVAL_MS).toBe(30_000);
  });
});

// Shape parity is enforced by the typed `active` and `inactive` literals at
// the top of this file — adding/removing a required key on BreakingTicker
// would fail tsc (lefthook gate) before vitest runs. No separate runtime
// shape test needed.
