// @vitest-environment happy-dom
//
// Note on coverage scope: tests below verify (a) the pure fetchPollUpdate
// helper, (b) initial render shape (data-hydrated marker, aria-live), and
// (c) prepend behavior when fresh entries arrive. CLS verification (the
// binding M9 perf gate) is deferred to story-005 capstone — measuring real
// layout-shift requires a real browser, not happy-dom.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/preact';
import { mockFetchSequence } from '@aje-poc/shared-test-helpers';
import { LIVEBLOG_POLL_INTERVAL_MS, MAX_CONSECUTIVE_EMPTY_POLLS } from '@aje-poc/shared-types';
import { LiveBlogUpdater, fetchPollUpdate } from './LiveBlogUpdater';

const SLUG = 'iran-war-live-trump-says-ceasefire-extended-as-talks-with-tehran-in-limbo';

function shellResponse(childIds: number[]) {
  return {
    body: {
      data: {
        article: {
          id: '4511785',
          title: 'Iran war live',
          link: `/news/liveblog/2026/4/22/${SLUG}`,
          slug: SLUG,
          date: '2026-04-22T00:00:00',
          content: '<ul><li>Summary</li></ul>',
          author: [],
          categories: [],
          postType: 'liveblog',
          isLive: true,
          children: childIds,
          childrenMeta: childIds.map((id) => ({ id: String(id), publishedTime: '0' })),
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
          link: `/news/liveblog/2026/4/22/${SLUG}`,
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

describe('fetchPollUpdate', () => {
  let mock: ReturnType<typeof mockFetchSequence>;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    vi.unstubAllEnvs();
  });

  it('returns no entries when shell.children matches currentIds (no new updates)', async () => {
    mock = mockFetchSequence([shellResponse([4001, 4002, 4003])]);
    const result = await fetchPollUpdate(SLUG, [4001, 4002, 4003]);
    expect(result).toEqual([]);
    expect(mock.calls.length).toBe(1);
  });

  it('fetches per-update for ids new since the last poll', async () => {
    mock = mockFetchSequence([
      shellResponse([4099, 4001, 4002, 4003]),
      updateResponse('4099', 'Brand new'),
    ]);
    const result = await fetchPollUpdate(SLUG, [4001, 4002, 4003]);
    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe('4099');
  });

  it('skips per-update fetches that 404 (allSettled, not all) without logging', async () => {
    mock = mockFetchSequence([
      shellResponse([4099, 4100, 4001]),
      updateResponse('4099', 'Visible'),
      { status: 404, body: { error: 'not found' } },
    ]);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await fetchPollUpdate(SLUG, [4001]);
    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe('4099');
    // 404 is intentional (no_posts_found) — must NOT log.
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('logs non-404 per-update rejections to console.error (5xx case)', async () => {
    mock = mockFetchSequence([
      shellResponse([4099, 4100, 4001]),
      updateResponse('4099', 'Visible'),
      { status: 500, body: { error: 'upstream broken' } }, // 4100 5xx — transient
    ]);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await fetchPollUpdate(SLUG, [4001]);

    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe('4099');
    expect(errSpy).toHaveBeenCalledWith(
      'liveblog-updater: per-update fetch failed:',
      expect.objectContaining({ id: 4100 }),
    );
    errSpy.mockRestore();
  });
});

describe('LiveBlogUpdater', () => {
  let mock: ReturnType<typeof mockFetchSequence>;

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

  it('renders an empty live region with data-hydrated marker on mount', async () => {
    const { container } = render(<LiveBlogUpdater slug={SLUG} initialChildIds={[4001, 4002]} />);
    // Allow useEffect to run.
    await Promise.resolve();
    const region = container.querySelector('section[data-live-blog-updater]');
    expect(region).not.toBeNull();
    expect(region!.getAttribute('aria-live')).toBe('polite');
    expect(region!.getAttribute('aria-relevant')).toBe('additions');
    await waitFor(() => {
      expect(region!.getAttribute('data-hydrated')).toBe('true');
    });
    expect(region!.children.length).toBe(0);
  });

  it('skips overlapping ticks while a previous fetch is in flight (concurrency guard)', async () => {
    let pendingResolve: ((r: Response) => void) | undefined;
    let pendingFetch: Promise<Response> | undefined;
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(() => {
      pendingFetch = new Promise<Response>((resolve) => {
        pendingResolve = resolve;
      });
      return pendingFetch;
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      render(<LiveBlogUpdater slug={SLUG} initialChildIds={[4001]} />);
      await vi.advanceTimersByTimeAsync(LIVEBLOG_POLL_INTERVAL_MS);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      // Tick 2 fires while the prior fetch is still pending — guard skips it.
      await vi.advanceTimersByTimeAsync(LIVEBLOG_POLL_INTERVAL_MS);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      // Resolve tick 1's fetch and await it explicitly so the awaiter chain
      // (response.json → fetchPollUpdate → finally{} clearing pollingRef)
      // settles before we advance to tick 3. waitFor polls the assertion to
      // tolerate any extra microtask the chain might add later.
      pendingResolve!(new Response(JSON.stringify(shellResponse([4001]).body), { status: 200 }));
      await pendingFetch;
      await vi.advanceTimersByTimeAsync(LIVEBLOG_POLL_INTERVAL_MS);
      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('stops polling after MAX_CONSECUTIVE_EMPTY_POLLS empty responses (deletion/quiet-blog guard)', async () => {
    // Shell returns the same children every poll → fetchPollUpdate returns
    // []. After MAX consecutive empties the interval should clear; one more
    // interval tick must NOT trigger a new fetch.
    const emptyShell = shellResponse([4001, 4002]);
    const sequence = Array.from({ length: MAX_CONSECUTIVE_EMPTY_POLLS + 5 }, () => emptyShell);
    mock = mockFetchSequence(sequence);
    render(<LiveBlogUpdater slug={SLUG} initialChildIds={[4001, 4002]} />);

    for (let i = 0; i < MAX_CONSECUTIVE_EMPTY_POLLS; i++) {
      await vi.advanceTimersByTimeAsync(LIVEBLOG_POLL_INTERVAL_MS);
    }
    // All N empty polls fired (one shell fetch each).
    await waitFor(() => expect(mock.calls.length).toBe(MAX_CONSECUTIVE_EMPTY_POLLS));

    const callsAtThreshold = mock.calls.length;
    // Past the threshold: interval should be cleared. Two more cadences must
    // not produce additional shell fetches.
    await vi.advanceTimersByTimeAsync(LIVEBLOG_POLL_INTERVAL_MS * 2);
    expect(mock.calls.length).toBe(callsAtThreshold);
  });

  it('polls every 30s, prepends fetched updates, and inserts newest at the top', async () => {
    mock = mockFetchSequence([
      // First poll tick: 4099 is new
      shellResponse([4099, 4001, 4002]),
      updateResponse('4099', 'First poll'),
      // Second poll tick: 4100 is new on top of 4099
      shellResponse([4100, 4099, 4001, 4002]),
      updateResponse('4100', 'Second poll'),
    ]);

    const { container } = render(<LiveBlogUpdater slug={SLUG} initialChildIds={[4001, 4002]} />);
    const region = container.querySelector('section[data-live-blog-updater]')!;
    expect(region.children.length).toBe(0);

    await vi.advanceTimersByTimeAsync(LIVEBLOG_POLL_INTERVAL_MS);
    await waitFor(() => expect(region.children.length).toBe(1));
    expect(region.querySelector('[data-entry-id="4099"]')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(LIVEBLOG_POLL_INTERVAL_MS);
    await waitFor(() => expect(region.children.length).toBe(2));
    // Newest first
    expect(region.children[0]!.getAttribute('data-entry-id')).toBe('4100');
    expect(region.children[1]!.getAttribute('data-entry-id')).toBe('4099');
  });
});
