// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RequestEventLoader } from '@qwik.dev/router';
import { GEO_API_CATEGORY_TYPE, SECTION_PAGE_SIZE } from '@aje-poc/shared-types';
import { mockFetchOnce, type MockedFetch } from '../../lib/test-helpers/mock-fetch';
import { GraphqlHttpError } from '../../lib/graphql';
import { loadSectionData } from './index';

type LoaderCtx = Pick<RequestEventLoader, 'params' | 'fail'>;

function makeCtx(section: string): LoaderCtx {
  // The fake `fail` returns the payload as-is (with status attached) so
  // assertions can both check `expect(fail).toHaveBeenCalledWith(...)` AND
  // `expect(result).toMatchObject({...})`. The cast is at the boundary only.
  const fail = vi.fn((status: number, payload: object) => ({
    ...payload,
    _status: status,
  })) as unknown as RequestEventLoader['fail'];
  return { params: { section }, fail };
}

describe('loadSectionData', () => {
  let mock: MockedFetch | undefined;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    mock = undefined;
    vi.unstubAllEnvs();
  });

  it('geographic slug calls ArchipelagoSectionQuery with categoryType=where, qty=9, offset=0', async () => {
    mock = mockFetchOnce({
      body: {
        data: {
          category: { name: 'Middle East' },
          articles: [{ id: 'a1' }, { id: 'a2' }],
        },
      },
    });
    const ctx = makeCtx('middle-east');
    const result = await loadSectionData(ctx);

    expect(mock.calls).toHaveLength(1);
    const url = new URL(mock.calls[0]!.url);
    expect(url.searchParams.get('operationName')).toBe('ArchipelagoSectionQuery');
    expect(JSON.parse(url.searchParams.get('variables')!)).toEqual({
      name: 'middle-east',
      categoryType: GEO_API_CATEGORY_TYPE,
      quantity: SECTION_PAGE_SIZE,
      offset: 0,
    });
    expect(result).toEqual({
      slug: 'middle-east',
      sectionType: 'geographic',
      title: 'Middle East',
      cards: [{ id: 'a1' }, { id: 'a2' }],
    });
    expect(ctx.fail).not.toHaveBeenCalled();
  });

  it('topic slug calls ArchipelagoTopicsPageQuery with just slug', async () => {
    mock = mockFetchOnce({
      body: {
        data: {
          topicsPage: {
            name: 'Opinion',
            featuredPosts: [{ id: 'op-1' }],
          },
        },
      },
    });
    const ctx = makeCtx('opinion');
    const result = await loadSectionData(ctx);

    expect(mock.calls).toHaveLength(1);
    const url = new URL(mock.calls[0]!.url);
    expect(url.searchParams.get('operationName')).toBe('ArchipelagoTopicsPageQuery');
    expect(JSON.parse(url.searchParams.get('variables')!)).toEqual({ slug: 'opinion' });
    expect(result).toEqual({
      slug: 'opinion',
      sectionType: 'topic',
      title: 'Opinion',
      cards: [{ id: 'op-1' }],
    });
    expect(ctx.fail).not.toHaveBeenCalled();
  });

  it('falls back to slug when geographic category name is absent', async () => {
    mock = mockFetchOnce({ body: { data: { category: null, articles: null } } });
    const result = await loadSectionData(makeCtx('europe'));
    expect(result).toEqual({
      slug: 'europe',
      sectionType: 'geographic',
      title: 'europe',
      cards: [],
    });
  });

  it('falls back to slug when topic page name is absent', async () => {
    mock = mockFetchOnce({ body: { data: { topicsPage: null } } });
    const result = await loadSectionData(makeCtx('economy'));
    expect(result).toEqual({
      slug: 'economy',
      sectionType: 'topic',
      title: 'economy',
      cards: [],
    });
  });

  it('GraphqlHttpError 404 → fail(404, {notFound, slug})', async () => {
    mock = mockFetchOnce({ status: 404, rawBody: 'No such section' });
    const ctx = makeCtx('unknown-xyz');
    const result = await loadSectionData(ctx);
    expect(ctx.fail).toHaveBeenCalledWith(404, { notFound: true, slug: 'unknown-xyz' });
    expect(result).toMatchObject({ notFound: true, slug: 'unknown-xyz' });
  });

  it('GraphqlHttpError 500 → re-throws', async () => {
    mock = mockFetchOnce({ status: 500, rawBody: 'oops' });
    const ctx = makeCtx('middle-east');
    await expect(loadSectionData(ctx)).rejects.toBeInstanceOf(GraphqlHttpError);
    expect(ctx.fail).not.toHaveBeenCalled();
  });
});
