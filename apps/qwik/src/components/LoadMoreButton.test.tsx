// @vitest-environment happy-dom
//
// Click → fetch → append behavior is NOT unit-testable in Qwik 2 beta.32:
// createDOM does not bootstrap qwikLoader, so onClick$ never fires (sprint-007
// SMM constraint d2dcc5b0900f). End-to-end coverage of the click path lives
// in the cross-app acceptance suite added by story-003 (capstone). Here we
// cover what IS unit-testable: render shell + the pure async fetchPage helper
// extracted from the $() closure (per plan-reviewer concern 4d4024861518).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { fetchPage, LoadMoreButton } from './LoadMoreButton';
import { GraphqlHttpError } from '../lib/graphql';
import { mockFetchOnce } from '../lib/test-helpers/mock-fetch';
import type { HomepagePost } from '@aje-poc/shared-types';

function makePosts(start: number, count: number): HomepagePost[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `post-${start + i}`,
    title: `Story ${start + i}`,
    link: `/news/story-${start + i}`,
  }));
}

describe('LoadMoreButton (render shell)', () => {
  it('renders the Load more button and no StoryCards initially', async () => {
    const { screen, render } = await createDOM();
    await render(
      <LoadMoreButton section="middle-east" categoryType="geographic" initialOffset={9} />,
    );
    const buttons = screen.querySelectorAll('button[type="button"]');
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain('Load more');
    expect(buttons[0].getAttribute('aria-busy')).toBe('false');
    expect(screen.querySelectorAll('article').length).toBe(0);
  });
});

describe('fetchPage (geographic)', () => {
  let mock: ReturnType<typeof mockFetchOnce>;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    vi.unstubAllEnvs();
  });

  it('calls ArchipelagoAjeSectionPostsQuery with category + offset and unwraps articles', async () => {
    mock = mockFetchOnce({ body: { data: { articles: makePosts(10, 9) } } });

    const result = await fetchPage('middle-east', 'geographic', 9);

    expect(result.length).toBe(9);
    expect(result[0].id).toBe('post-10');

    const url = new URL(mock.calls[0]!.url);
    expect(url.searchParams.get('operationName')).toBe('ArchipelagoAjeSectionPostsQuery');
    expect(JSON.parse(url.searchParams.get('variables')!)).toEqual({
      category: 'middle-east',
      categoryType: 'where',
      quantity: 9,
      offset: 9,
    });
  });

  it('honours subsequent offsets passed by the caller (e.g. 18, 27)', async () => {
    mock = mockFetchOnce({ body: { data: { articles: makePosts(20, 9) } } });

    await fetchPage('middle-east', 'geographic', 18);

    const url = new URL(mock.calls[0]!.url);
    expect(JSON.parse(url.searchParams.get('variables')!).offset).toBe(18);
  });
});

describe('fetchPage (topic)', () => {
  let mock: ReturnType<typeof mockFetchOnce>;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    vi.unstubAllEnvs();
  });

  it('calls ArchipelagoPaginatedTopicsFeedQuery with slug + offset and unwraps articles', async () => {
    mock = mockFetchOnce({
      body: { data: { topicsFeedData: { articles: makePosts(10, 9) } } },
    });

    const result = await fetchPage('opinion', 'topic', 9);

    expect(result.length).toBe(9);

    const url = new URL(mock.calls[0]!.url);
    expect(url.searchParams.get('operationName')).toBe('ArchipelagoPaginatedTopicsFeedQuery');
    expect(JSON.parse(url.searchParams.get('variables')!)).toEqual({
      slug: 'opinion',
      quantity: 9,
      offset: 9,
    });
  });

  it('slices PaginatedTopicsFeed.articles to first 9 even when fixture returns 10', async () => {
    mock = mockFetchOnce({
      body: { data: { topicsFeedData: { articles: makePosts(10, 10) } } },
    });

    const result = await fetchPage('opinion', 'topic', 9);

    expect(result.length).toBe(9);
  });
});

describe('fetchPage error path', () => {
  let mock: ReturnType<typeof mockFetchOnce>;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    vi.unstubAllEnvs();
  });

  it('throws GraphqlHttpError when the API responds 404 (caller branches on .status)', async () => {
    mock = mockFetchOnce({ status: 404, rawBody: 'No more' });

    await expect(fetchPage('middle-east', 'geographic', 9)).rejects.toBeInstanceOf(
      GraphqlHttpError,
    );
  });
});
