import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetchSequence } from '@aje-poc/shared-test-helpers';
import { LIVEBLOG_DATE_PREFIX, LIVEBLOG_SLUG as SLUG } from '@aje-poc/shared-types';
import { loadLiveBlogData, type LiveBlogPageData, type LiveBlogNotFound } from './load-liveblog';

function expectFound(result: LiveBlogPageData | LiveBlogNotFound): LiveBlogPageData {
  if ('notFound' in result) throw new Error('expected loadLiveBlogData to return page data');
  return result;
}

interface ShellChildMeta {
  id: string;
  publishedTime: string;
}

function shellResponse(childMeta: ShellChildMeta[]) {
  return {
    body: {
      data: {
        article: {
          id: '4511785',
          title: 'Iran war live',
          link: `/news/liveblog/${LIVEBLOG_DATE_PREFIX}/${SLUG}`,
          slug: SLUG,
          date: '2026-04-22T00:00:00',
          content: '<ul><li>Summary bullet</li></ul>',
          author: [],
          categories: [],
          postType: 'liveblog',
          isLive: true,
          children: childMeta.map((c) => Number(c.id)),
          childrenMeta: childMeta,
        },
      },
    },
  };
}

function updateResponse(id: string, title: string) {
  return {
    body: {
      data: {
        posts: {
          id,
          link: `/news/liveblog/${LIVEBLOG_DATE_PREFIX}/${SLUG}`,
          postType: 'liveblog-update',
          title,
          content: `<p>${title}</p>`,
          author: [],
          showAuthor: false,
          date: '2026-04-22T00:00:00',
          shouldDisplayTitle: true,
          postLabel: [],
        },
      },
    },
  };
}

function notFoundResponse() {
  return {
    body: {
      errors: [{ message: 'no_posts_found', extensions: {} }],
      data: { posts: null },
    },
  };
}

describe('loadLiveBlogData', () => {
  let mock: ReturnType<typeof mockFetchSequence>;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    vi.unstubAllEnvs();
  });

  it('fetches the shell then the first 5 children in parallel and returns shaped data', async () => {
    const childMeta = [
      { id: '4001', publishedTime: '1700000005' },
      { id: '4002', publishedTime: '1700000004' },
      { id: '4003', publishedTime: '1700000003' },
      { id: '4004', publishedTime: '1700000002' },
      { id: '4005', publishedTime: '1700000001' },
      { id: '4006', publishedTime: '1700000000' }, // beyond first 5; should NOT be fetched
    ];
    mock = mockFetchSequence([
      shellResponse(childMeta),
      updateResponse('4001', 'Update one'),
      updateResponse('4002', 'Update two'),
      updateResponse('4003', 'Update three'),
      updateResponse('4004', 'Update four'),
      updateResponse('4005', 'Update five'),
    ]);

    const result = expectFound(await loadLiveBlogData(SLUG));

    expect(result.shell.title).toBe('Iran war live');
    expect(result.shell.postType).toBe('liveblog');
    expect(result.shell.isLive).toBe(true);
    expect(result.shell.childrenMeta?.length).toBe(6);
    expect(result.entries.length).toBe(5);
    expect(result.entries.map((e) => e.id)).toEqual(['4001', '4002', '4003', '4004', '4005']);

    expect(mock.calls.length).toBe(6);
    const shellUrl = new URL(mock.calls[0]!.url);
    expect(shellUrl.searchParams.get('operationName')).toBe('ArchipelagoSingleLiveBlogQuery');
    expect(JSON.parse(shellUrl.searchParams.get('variables')!)).toEqual({
      name: SLUG,
      postType: 'liveblog',
      preview: '',
    });
    const firstUpdateUrl = new URL(mock.calls[1]!.url);
    expect(firstUpdateUrl.searchParams.get('operationName')).toBe('LiveBlogUpdateQuery');
    expect(JSON.parse(firstUpdateUrl.searchParams.get('variables')!)).toEqual({
      postID: 4001,
      postType: 'liveblog-update',
      preview: '',
      isAmp: false,
    });
  });

  it('skips per-update fetches that 404 (allSettled, not all) without marking degraded', async () => {
    const childMeta = [
      { id: '4001', publishedTime: '1700000005' },
      { id: '4002', publishedTime: '1700000004' },
      { id: '4003', publishedTime: '1700000003' },
    ];
    mock = mockFetchSequence([
      shellResponse(childMeta),
      updateResponse('4001', 'One'),
      { status: 404, body: { error: 'not found' } }, // 4002 fetch fails
      updateResponse('4003', 'Three'),
    ]);

    const result = expectFound(await loadLiveBlogData(SLUG));

    expect(result.entries.map((e) => e.id)).toEqual(['4001', '4003']);
    // 404 is intentional (post deleted / no_posts_found) — NOT a degraded state.
    expect(result.degraded).toBeUndefined();
  });

  it('skips per-update fetches that return no_posts_found despite HTTP 200 without marking degraded', async () => {
    const childMeta = [
      { id: '4001', publishedTime: '1700000002' },
      { id: '4002', publishedTime: '1700000001' },
    ];
    mock = mockFetchSequence([
      shellResponse(childMeta),
      updateResponse('4001', 'Real update'),
      notFoundResponse(),
    ]);

    const result = expectFound(await loadLiveBlogData(SLUG));

    expect(result.entries.length).toBe(1);
    expect(result.entries[0]!.id).toBe('4001');
    // no_posts_found is intentional — NOT a degraded state.
    expect(result.degraded).toBeUndefined();
  });

  it('logs and surfaces non-404 per-update rejections via degraded marker', async () => {
    const childMeta = [
      { id: '4001', publishedTime: '1700000002' },
      { id: '4002', publishedTime: '1700000001' },
    ];
    mock = mockFetchSequence([
      shellResponse(childMeta),
      updateResponse('4001', 'One'),
      { status: 500, body: { error: 'upstream broken' } }, // 4002 5xx — transient, should surface
    ]);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = expectFound(await loadLiveBlogData(SLUG));

    expect(result.entries.map((e) => e.id)).toEqual(['4001']);
    expect(result.degraded?.failedUpdateIds).toEqual([4002]);
    expect(errSpy).toHaveBeenCalledWith(
      'load-liveblog: per-update fetch failed:',
      expect.objectContaining({ id: 4002 }),
    );
    errSpy.mockRestore();
  });

  it('returns notFound when the shell GraphQL response 404s', async () => {
    mock = mockFetchSequence([{ status: 404, body: { error: 'not found' } }]);
    const result = await loadLiveBlogData(SLUG);
    expect('notFound' in result && result.notFound).toBe(true);
    if ('notFound' in result) {
      expect(result.slug).toBe(SLUG);
    }
  });

  it('returns notFound when the shell response has no article (production null shape)', async () => {
    mock = mockFetchSequence([{ body: { data: { article: null } } }]);
    const result = await loadLiveBlogData(SLUG);
    expect('notFound' in result && result.notFound).toBe(true);
  });
});
