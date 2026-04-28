// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { LoadMoreButton } from './LoadMoreButton';
import { mockFetchOnce } from '@aje-poc/shared-test-helpers';
import type { HomepagePost } from '@aje-poc/shared-types';

function makePosts(start: number, count: number): HomepagePost[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `post-${start + i}`,
    title: `Story ${start + i}`,
    link: `/news/story-${start + i}`,
  }));
}

describe('LoadMoreButton', () => {
  let mock: ReturnType<typeof mockFetchOnce>;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    vi.unstubAllEnvs();
    cleanup();
  });

  it('renders the button and no StoryCards initially', () => {
    const { container, getByRole } = render(
      <LoadMoreButton section="middle-east" categoryType="geographic" initialOffset={9} />,
    );
    expect(getByRole('button', { name: /load more/i })).toBeTruthy();
    expect(container.querySelectorAll('article').length).toBe(0);
  });

  it('flips data-hydrated to "true" after mount (acceptance-suite contract)', async () => {
    const { getByRole } = render(
      <LoadMoreButton section="middle-east" categoryType="geographic" initialOffset={9} />,
    );
    const button = getByRole('button', { name: /load more/i }) as HTMLButtonElement;
    await waitFor(() => {
      expect(button.getAttribute('data-hydrated')).toBe('true');
    });
  });

  it('disables the button and sets aria-busy while a fetch is in flight (double-click guard)', async () => {
    let resolveFetch!: (value: Response) => void;
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    ) as unknown as typeof fetch;

    try {
      const { getByRole } = render(
        <LoadMoreButton section="middle-east" categoryType="geographic" initialOffset={9} />,
      );

      const button = getByRole('button') as HTMLButtonElement;
      fireEvent.click(button);

      await waitFor(() => {
        expect(button.disabled).toBe(true);
        expect(button.getAttribute('aria-busy')).toBe('true');
      });

      resolveFetch(
        new Response(JSON.stringify({ data: { articles: [] } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      await waitFor(() => {
        expect(button.disabled).toBe(false);
      });
    } finally {
      globalThis.fetch = original;
    }
  });

  it('geographic click fetches AjeSectionPosts at offset=9 and appends 9 StoryCards', async () => {
    mock = mockFetchOnce({ body: { data: { articles: makePosts(10, 9) } } });

    const { container, getByRole } = render(
      <LoadMoreButton section="middle-east" categoryType="geographic" initialOffset={9} />,
    );

    fireEvent.click(getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      expect(container.querySelectorAll('article').length).toBe(9);
    });

    const url = new URL(mock.calls[0]!.url);
    expect(url.searchParams.get('operationName')).toBe('ArchipelagoAjeSectionPostsQuery');
    expect(JSON.parse(url.searchParams.get('variables')!)).toEqual({
      category: 'middle-east',
      categoryType: 'where',
      quantity: 9,
      offset: 9,
    });
  });

  it('topic click fetches PaginatedTopicsFeed at offset=9 and appends 9 StoryCards', async () => {
    mock = mockFetchOnce({
      body: { data: { topicsFeedData: { articles: makePosts(10, 9) } } },
    });

    const { container, getByRole } = render(
      <LoadMoreButton section="opinion" categoryType="topic" initialOffset={9} />,
    );

    fireEvent.click(getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      expect(container.querySelectorAll('article').length).toBe(9);
    });

    const url = new URL(mock.calls[0]!.url);
    expect(url.searchParams.get('operationName')).toBe('ArchipelagoPaginatedTopicsFeedQuery');
    expect(JSON.parse(url.searchParams.get('variables')!)).toEqual({
      slug: 'opinion',
      quantity: 9,
      offset: 9,
    });
  });

  it('topic click slices PaginatedTopicsFeed.articles to first 9 even when fixture returns 10', async () => {
    mock = mockFetchOnce({
      body: { data: { topicsFeedData: { articles: makePosts(10, 10) } } },
    });

    const { container, getByRole } = render(
      <LoadMoreButton section="opinion" categoryType="topic" initialOffset={9} />,
    );

    fireEvent.click(getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      expect(container.querySelectorAll('article').length).toBe(9);
    });
  });

  it('second click increments offset to 18 and appends another 9', async () => {
    mock = mockFetchOnce({ body: { data: { articles: makePosts(10, 9) } } });

    const { container, getByRole } = render(
      <LoadMoreButton section="middle-east" categoryType="geographic" initialOffset={9} />,
    );

    fireEvent.click(getByRole('button', { name: /load more/i }));
    await waitFor(() => expect(container.querySelectorAll('article').length).toBe(9));

    fireEvent.click(getByRole('button', { name: /load more/i }));
    await waitFor(() => expect(container.querySelectorAll('article').length).toBe(18));

    expect(mock.calls.length).toBe(2);
    const second = new URL(mock.calls[1]!.url);
    expect(JSON.parse(second.searchParams.get('variables')!).offset).toBe(18);
  });

  it('surfaces an inline error and keeps the button when the API responds 404', async () => {
    mock = mockFetchOnce({ status: 404, rawBody: 'No more' });

    const { container, getByRole } = render(
      <LoadMoreButton section="middle-east" categoryType="geographic" initialOffset={9} />,
    );

    fireEvent.click(getByRole('button', { name: /load more/i }));

    await waitFor(() => {
      expect(container.querySelector('[role="alert"]')).toBeTruthy();
    });
    expect(container.querySelectorAll('article').length).toBe(0);
    expect(getByRole('button', { name: /load more/i })).toBeTruthy();
  });

  it('logs and surfaces a generic error message when the API responds 500', async () => {
    mock = mockFetchOnce({ status: 500, rawBody: 'Boom' });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const { container, getByRole } = render(
        <LoadMoreButton section="middle-east" categoryType="geographic" initialOffset={9} />,
      );

      fireEvent.click(getByRole('button', { name: /load more/i }));

      await waitFor(() => {
        const alert = container.querySelector('[role="alert"]');
        expect(alert?.textContent).toBe('Failed to load more stories.');
      });
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
