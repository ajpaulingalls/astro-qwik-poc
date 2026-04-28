// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockFetchSequence, type MockedFetch } from '@aje-poc/shared-test-helpers';
import { loadHomepageData } from './index';

describe('loadHomepageData', () => {
  let mock: MockedFetch | undefined;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    mock = undefined;
    vi.unstubAllEnvs();
  });

  it('issues HomePageQuery + HomePageCuratedFeedQuery in parallel and returns both wrapped', async () => {
    const pageData = {
      homepage: {
        layout: 'main',
        featuredPosts: [{ id: 'p1' }],
        mostPopular: [{ id: 'm1' }],
        verticalVideos: [],
        livestream: null,
      },
    };
    const curatedData = {
      homepage: { curatedCollection: [{ title: 'Top', posts: [{ id: 'c1' }] }] },
    };
    mock = mockFetchSequence([{ body: { data: pageData } }, { body: { data: curatedData } }]);

    const result = await loadHomepageData();

    expect(mock.calls).toHaveLength(2);

    const homePageUrl = new URL(mock.calls[0]!.url);
    expect(homePageUrl.searchParams.get('operationName')).toBe('HomePageQuery');
    expect(JSON.parse(homePageUrl.searchParams.get('variables')!)).toEqual({
      isAtf: true,
      atfLength: 2,
      slug: '',
      preview: '',
    });

    const curatedUrl = new URL(mock.calls[1]!.url);
    expect(curatedUrl.searchParams.get('operationName')).toBe('HomePageCuratedFeedQuery');
    expect(JSON.parse(curatedUrl.searchParams.get('variables')!)).toEqual({ offset: 0 });

    expect(result).toEqual({ page: pageData, curated: curatedData });
  });
});
