// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RequestEventLoader } from '@qwik.dev/router';
import { mockFetchOnce, mockFetchSequence, type MockedFetch } from '@aje-poc/shared-test-helpers';
import type { Article } from '@aje-poc/shared-types';
import { GraphqlHttpError } from '../../../lib/graphql';
import { loadArticleData } from './index';

type LoaderCtx = Pick<RequestEventLoader, 'params' | 'fail'>;

function makeCtx(slug: string): LoaderCtx {
  const fail = vi.fn((status: number, payload: object) => ({
    ...payload,
    _status: status,
  })) as unknown as RequestEventLoader['fail'];
  return { params: { slug }, fail };
}

const ARTICLE: Article = {
  id: 'a1',
  title: 'Russian oil exports slump',
  link: '/news/2026/4/24/russian-oil-exports-slump',
  date: '2026-04-24',
  content: '<p>body</p>',
  author: [],
  categories: [],
};

const CURATED_BODY = {
  data: {
    homepage: {
      curatedCollection: [
        { title: 'Top', posts: [{ id: 'r1' }, { id: 'r2' }] },
        { title: 'More', posts: [{ id: 'r3' }] },
      ],
    },
  },
};

describe('loadArticleData', () => {
  let mock: MockedFetch | undefined;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    mock = undefined;
    vi.unstubAllEnvs();
  });

  it('uses lastSegment(slug) for the article query and runs both fetches', async () => {
    mock = mockFetchSequence([{ body: { data: { article: ARTICLE } } }, { body: CURATED_BODY }]);
    const ctx = makeCtx('features/2026/4/24/russian-oil-exports-slump');
    const result = await loadArticleData(ctx);

    expect(mock.calls).toHaveLength(2);
    const articleUrl = new URL(mock.calls[0]!.url);
    expect(articleUrl.searchParams.get('operationName')).toBe('ArchipelagoSingleArticleQuery');
    expect(JSON.parse(articleUrl.searchParams.get('variables')!)).toEqual({
      name: 'russian-oil-exports-slump',
      preview: '',
    });

    const curatedUrl = new URL(mock.calls[1]!.url);
    expect(curatedUrl.searchParams.get('operationName')).toBe('HomePageCuratedFeedQuery');
    expect(JSON.parse(curatedUrl.searchParams.get('variables')!)).toEqual({ offset: 0 });

    expect(result).toEqual({
      article: ARTICLE,
      relatedPosts: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
    });
    expect(ctx.fail).not.toHaveBeenCalled();
  });

  it('returns empty relatedPosts when curated collection is empty', async () => {
    mock = mockFetchSequence([
      { body: { data: { article: ARTICLE } } },
      { body: { data: { homepage: { curatedCollection: [] } } } },
    ]);
    const result = await loadArticleData(makeCtx('2026/4/25/another-article'));
    expect(result).toEqual({ article: ARTICLE, relatedPosts: [] });
  });

  it('returns empty relatedPosts when curated collection is null (?? [] branch)', async () => {
    mock = mockFetchSequence([
      { body: { data: { article: ARTICLE } } },
      { body: { data: { homepage: { curatedCollection: null } } } },
    ]);
    const result = await loadArticleData(makeCtx('2026/4/25/another-article'));
    expect(result).toEqual({ article: ARTICLE, relatedPosts: [] });
  });

  it('GraphqlHttpError 404 → fail(404, {notFound, slug})', async () => {
    // Promise.all surfaces the first rejection; mockFetchOnce rejects ALL
    // pending fetches because both call the single stubbed fetch.
    mock = mockFetchOnce({ status: 404, rawBody: 'No fixture' });
    const ctx = makeCtx('2026/4/25/missing-article');
    const result = await loadArticleData(ctx);
    expect(ctx.fail).toHaveBeenCalledWith(404, {
      notFound: true,
      slug: 'missing-article',
    });
    expect(result).toMatchObject({ notFound: true, slug: 'missing-article' });
  });

  it('GraphqlHttpError 500 → re-throws', async () => {
    mock = mockFetchOnce({ status: 500, rawBody: 'oops' });
    const ctx = makeCtx('2026/4/25/some-article');
    await expect(loadArticleData(ctx)).rejects.toBeInstanceOf(GraphqlHttpError);
    expect(ctx.fail).not.toHaveBeenCalled();
  });

  it('uses the empty string when slug param is absent', async () => {
    mock = mockFetchSequence([{ body: { data: { article: ARTICLE } } }, { body: CURATED_BODY }]);
    await loadArticleData(makeCtx(''));
    const articleUrl = new URL(mock.calls[0]!.url);
    expect(JSON.parse(articleUrl.searchParams.get('variables')!).name).toBe('');
  });
});
