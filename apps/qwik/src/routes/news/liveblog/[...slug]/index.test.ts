// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RequestEventLoader } from '@qwik.dev/router';
import { mockFetchSequence, type MockedFetch } from '@aje-poc/shared-test-helpers';
import { LIVEBLOG_INITIAL_ENTRY_COUNT } from '@aje-poc/shared-types';
import { GraphqlHttpError } from '../../../../lib/graphql';
import { loadLiveBlogData } from './index';

type LoaderCtx = Pick<RequestEventLoader, 'params' | 'fail'>;

function makeCtx(slug: string): LoaderCtx {
  const fail = vi.fn((status: number, payload: object) => ({
    ...payload,
    _status: status,
  })) as unknown as RequestEventLoader['fail'];
  return { params: { slug }, fail };
}

const SHELL = {
  id: '12345',
  title: 'Iran war live: ceasefire extended',
  link: '/news/liveblog/2026/4/22/iran-war-live',
  slug: 'iran-war-live',
  date: '2026-04-22T00:00:00',
  content: '',
  author: [],
  categories: [],
  postType: 'liveblog',
  isLive: true,
  children: [4514963, 4514943, 4512107, 4512099, 4512131],
  childrenMeta: [
    { id: '4514963', publishedTime: '1776832000' },
    { id: '4514943', publishedTime: '1776831000' },
    { id: '4512107', publishedTime: '1776830000' },
    { id: '4512099', publishedTime: '1776829000' },
    { id: '4512131', publishedTime: '1776828000' },
  ],
};

function makeUpdate(id: string, title: string) {
  return {
    id,
    title,
    shouldDisplayTitle: true,
    date: '2026-04-22T12:00:00',
    content: `<p>Body for ${id}</p>`,
  };
}

describe('loadLiveBlogData', () => {
  let mock: MockedFetch | undefined;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    mock = undefined;
    vi.unstubAllEnvs();
  });

  it('fetches shell then LIVEBLOG_INITIAL_ENTRY_COUNT LiveBlogUpdate calls in parallel and returns trimmed payload', async () => {
    mock = mockFetchSequence([
      { body: { data: { article: SHELL } } },
      { body: { data: { posts: makeUpdate('4514963', 'Newest') } } },
      { body: { data: { posts: makeUpdate('4514943', 'Older') } } },
      { body: { data: { posts: makeUpdate('4512107', 'Older still') } } },
      { body: { data: { posts: makeUpdate('4512099', 'Even older') } } },
      { body: { data: { posts: makeUpdate('4512131', 'Oldest') } } },
    ]);
    const ctx = makeCtx('2026/4/22/iran-war-live');
    const result = await loadLiveBlogData(ctx);

    expect(mock.calls).toHaveLength(6);

    const shellUrl = new URL(mock.calls[0]!.url);
    expect(shellUrl.searchParams.get('operationName')).toBe('ArchipelagoSingleLiveBlogQuery');
    expect(JSON.parse(shellUrl.searchParams.get('variables')!)).toEqual({
      name: 'iran-war-live',
      preview: '',
    });

    const updateUrl = new URL(mock.calls[1]!.url);
    expect(updateUrl.searchParams.get('operationName')).toBe('LiveBlogUpdateQuery');
    expect(JSON.parse(updateUrl.searchParams.get('variables')!)).toEqual({
      postID: 4514963,
      postType: 'liveblog-update',
      preview: '',
      isAmp: false,
    });

    expect('header' in result).toBe(true);
    if (!('header' in result)) throw new Error('expected loader success');
    expect(result.header.title).toBe('Iran war live: ceasefire extended');
    expect(result.header.isLive).toBe(true);
    expect(result.entries).toHaveLength(LIVEBLOG_INITIAL_ENTRY_COUNT);
    expect(result.entries[0]!.id).toBe('4514963');
    expect(result.entries[4]!.id).toBe('4512131');
    expect(result.initialChildIds).toEqual([4514963, 4514943, 4512107, 4512099, 4512131]);
    expect(result.slug).toBe('iran-war-live');
  });

  it('returns notFound via fail(404) when shell fetch 404s', async () => {
    mock = mockFetchSequence([{ status: 404, rawBody: 'No fixture' }]);
    const ctx = makeCtx('2026/4/22/missing-blog');
    const result = await loadLiveBlogData(ctx);
    expect(ctx.fail).toHaveBeenCalledWith(404, {
      notFound: true,
      slug: 'missing-blog',
    });
    expect(result).toMatchObject({ notFound: true, slug: 'missing-blog' });
  });

  it('shell fetch 500 re-throws (not notFound)', async () => {
    mock = mockFetchSequence([{ status: 500, rawBody: 'oops' }]);
    await expect(loadLiveBlogData(makeCtx('2026/4/22/some-blog'))).rejects.toBeInstanceOf(
      GraphqlHttpError,
    );
  });

  it('skips per-update 404s gracefully (Promise.allSettled)', async () => {
    // Snapshot-0's first 5 children include ids without per-update fixtures
    // (only 4512107 has one). The loader should keep the 1 successful entry
    // and drop the 4 missing ones rather than failing the whole route.
    mock = mockFetchSequence([
      { body: { data: { article: SHELL } } },
      { status: 404, rawBody: 'no fixture' },
      { status: 404, rawBody: 'no fixture' },
      { body: { data: { posts: makeUpdate('4512107', 'Lone survivor') } } },
      { status: 404, rawBody: 'no fixture' },
      { status: 404, rawBody: 'no fixture' },
    ]);
    const result = await loadLiveBlogData(makeCtx('2026/4/22/iran-war-live'));
    if (!('header' in result)) throw new Error('expected success');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.id).toBe('4512107');
  });

  it('drops per-update results whose payload is null (production no_posts_found per id)', async () => {
    mock = mockFetchSequence([
      { body: { data: { article: SHELL } } },
      { body: { data: { posts: null } } },
      { body: { data: { posts: makeUpdate('4514943', 'Survived') } } },
      { body: { data: { posts: null } } },
      { body: { data: { posts: makeUpdate('4512099', 'Also survived') } } },
      { body: { data: { posts: null } } },
    ]);
    const result = await loadLiveBlogData(makeCtx('2026/4/22/iran-war-live'));
    if (!('header' in result)) throw new Error('expected success');
    expect(result.entries.map((e) => e.id)).toEqual(['4514943', '4512099']);
  });

  it('logs and surfaces non-404 per-update rejections via degraded marker', async () => {
    mock = mockFetchSequence([
      { body: { data: { article: SHELL } } },
      { body: { data: { posts: makeUpdate('4514963', 'One') } } },
      { status: 500, rawBody: 'upstream broken' },
      { body: { data: { posts: makeUpdate('4512107', 'Three') } } },
      { body: { data: { posts: makeUpdate('4512099', 'Four') } } },
      { body: { data: { posts: makeUpdate('4512131', 'Five') } } },
    ]);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await loadLiveBlogData(makeCtx('2026/4/22/iran-war-live'));
    if (!('header' in result)) throw new Error('expected success');

    expect(result.entries.map((e) => e.id)).toEqual(['4514963', '4512107', '4512099', '4512131']);
    expect(result.degraded?.failedUpdateIds).toEqual([4514943]);
    expect(errSpy).toHaveBeenCalledWith(
      'liveblog-route: per-update fetch failed:',
      expect.objectContaining({ id: 4514943 }),
    );
    errSpy.mockRestore();
  });

  it('omits degraded marker when only 404s occur (intentional, not a failure)', async () => {
    mock = mockFetchSequence([
      { body: { data: { article: SHELL } } },
      { body: { data: { posts: makeUpdate('4514963', 'One') } } },
      { status: 404, rawBody: 'no fixture' },
      { body: { data: { posts: makeUpdate('4512107', 'Three') } } },
      { body: { data: { posts: makeUpdate('4512099', 'Four') } } },
      { body: { data: { posts: makeUpdate('4512131', 'Five') } } },
    ]);
    const result = await loadLiveBlogData(makeCtx('2026/4/22/iran-war-live'));
    if (!('header' in result)) throw new Error('expected success');
    expect(result.degraded).toBeUndefined();
  });

  it('handles shells with no childrenMeta (skips per-update fan-out)', async () => {
    mock = mockFetchSequence([
      { body: { data: { article: { ...SHELL, children: [], childrenMeta: undefined } } } },
    ]);
    const result = await loadLiveBlogData(makeCtx('2026/4/22/iran-war-live'));
    if (!('header' in result)) throw new Error('expected success');
    expect(result.entries).toEqual([]);
    expect(result.initialChildIds).toEqual([]);
  });

  it('uses the empty string when slug param is absent', async () => {
    mock = mockFetchSequence([{ status: 404, rawBody: 'No fixture' }]);
    const ctx = makeCtx('');
    const result = await loadLiveBlogData(ctx);
    expect(ctx.fail).toHaveBeenCalledWith(404, { notFound: true, slug: '' });
    expect(result).toMatchObject({ notFound: true, slug: '' });
  });
});
