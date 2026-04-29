// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetchOnce, type MockedFetch } from '@aje-poc/shared-test-helpers';
import { fetchBreakingTicker } from './ticker-api';

const ACTIVE_TICKER = {
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

describe('fetchBreakingTicker', () => {
  let mock: MockedFetch | undefined;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    mock = undefined;
    vi.unstubAllEnvs();
  });

  it('issues ArchipelagoBreakingTickerQuery with empty variables and returns breakingNews', async () => {
    mock = mockFetchOnce({ body: { data: { breakingNews: ACTIVE_TICKER } } });
    const ticker = await fetchBreakingTicker();
    expect(mock.calls).toHaveLength(1);
    const url = new URL(mock.calls[0]!.url);
    expect(url.searchParams.get('operationName')).toBe('ArchipelagoBreakingTickerQuery');
    expect(url.searchParams.get('variables')).toBe('{}');
    expect(ticker).toEqual(ACTIVE_TICKER);
  });

  it('returns null when breakingNews payload is null (no active banner)', async () => {
    mock = mockFetchOnce({ body: { data: { breakingNews: null } } });
    const ticker = await fetchBreakingTicker();
    expect(ticker).toBeNull();
  });
});
