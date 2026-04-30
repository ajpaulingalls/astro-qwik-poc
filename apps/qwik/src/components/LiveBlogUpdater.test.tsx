// @vitest-environment happy-dom
//
// CLS-on-prepend cannot be unit-tested — createDOM doesn't bootstrap
// qwikLoader (SMM risk d2dcc5b0900f). The setInterval polling path also
// only fires once the visible task arms in a real browser. We cover the
// extracted pure helper (fetchPollUpdate) with mockFetchSequence here,
// plus a render-shell test for the component's initial DOM. End-to-end
// CLS-safe-prepend verification lives in story-005's acceptance suite —
// story-004 should NOT be considered M9-complete without that pass.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { mockFetchOnce, mockFetchSequence, type MockedFetch } from '@aje-poc/shared-test-helpers';
import { isolateDocumentHidden } from '../test-utils/document-hidden';

// Mock createPollLoop so the wiring-options test can capture what the
// component passes (label, onError, shouldSkip, immediate, intervalMs,
// maxConsecutiveEmpty). The other tests (fetchPollUpdate, render shell)
// don't depend on the helper firing — they cover the pure helper directly
// and the post-render DOM, so the no-op stop() is safe.
const { createPollLoopMock } = vi.hoisted(() => ({
  createPollLoopMock: vi.fn(() => ({ stop: vi.fn() })),
}));
vi.mock('@aje-poc/shared-types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aje-poc/shared-types')>();
  return { ...actual, createPollLoop: createPollLoopMock };
});

import { fetchPollUpdate, LiveBlogUpdater } from './LiveBlogUpdater';
import {
  type LiveBlogUpdate,
  type PollLoopOptions,
  MAX_CONSECUTIVE_EMPTY_POLLS,
  LIVEBLOG_POLL_INTERVAL_MS,
  resolvePollIntervalMs,
} from '@aje-poc/shared-types';

function makeUpdate(id: string, title: string): LiveBlogUpdate {
  return {
    id,
    title,
    shouldDisplayTitle: true,
    date: '2026-04-22T12:00:00',
    content: `<p>${id}</p>`,
  };
}

const SHELL_WITH_TWO_NEW = {
  data: {
    article: {
      id: '12345',
      children: [4514963, 4514943, 4512107, 4512099, 4512131],
    },
  },
};

describe('fetchPollUpdate', () => {
  let mock: MockedFetch | undefined;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    mock = undefined;
    vi.unstubAllEnvs();
  });

  it('polls shell, diffs against currentIds, and fetches per-update for the new ids only', async () => {
    mock = mockFetchSequence([
      { body: SHELL_WITH_TWO_NEW },
      { body: { data: { posts: makeUpdate('4514963', 'Newer') } } },
      { body: { data: { posts: makeUpdate('4514943', 'Newish') } } },
    ]);

    const newEntries = await fetchPollUpdate('iran-war-live', [4512107, 4512099, 4512131]);

    expect(mock.calls).toHaveLength(3);

    const shellUrl = new URL(mock.calls[0]!.url);
    expect(shellUrl.searchParams.get('operationName')).toBe('ArchipelagoSingleLiveBlogQuery');
    expect(JSON.parse(shellUrl.searchParams.get('variables')!)).toEqual({
      name: 'iran-war-live',
      preview: '',
    });

    const update0 = new URL(mock.calls[1]!.url);
    expect(JSON.parse(update0.searchParams.get('variables')!)).toEqual({
      postID: 4514963,
      postType: 'liveblog-update',
      preview: '',
      isAmp: false,
    });

    expect(newEntries.map((e) => e.id)).toEqual(['4514963', '4514943']);
  });

  it('returns [] and skips per-update fetches when no new ids appear', async () => {
    mock = mockFetchSequence([{ body: SHELL_WITH_TWO_NEW }]);
    const newEntries = await fetchPollUpdate(
      'iran-war-live',
      [4514963, 4514943, 4512107, 4512099, 4512131],
    );
    expect(mock.calls).toHaveLength(1);
    expect(newEntries).toEqual([]);
  });

  it('skips per-update 404s gracefully (allSettled, not all) without logging', async () => {
    mock = mockFetchSequence([
      { body: SHELL_WITH_TWO_NEW },
      { status: 404, rawBody: 'no fixture' },
      { body: { data: { posts: makeUpdate('4514943', 'Survived') } } },
    ]);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const newEntries = await fetchPollUpdate('iran-war-live', [4512107, 4512099, 4512131]);
    expect(newEntries.map((e) => e.id)).toEqual(['4514943']);
    // 404 is intentional (no_posts_found) — must NOT log.
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('returns [] when shell payload is null (production no_posts_found)', async () => {
    mock = mockFetchSequence([{ body: { data: { article: null } } }]);
    const newEntries = await fetchPollUpdate('iran-war-live', [4512107, 4512099, 4512131]);
    expect(mock.calls).toHaveLength(1);
    expect(newEntries).toEqual([]);
  });

  it('drops per-update results whose payload is null (no_posts_found per id)', async () => {
    mock = mockFetchSequence([
      { body: SHELL_WITH_TWO_NEW },
      { body: { data: { posts: null } } },
      { body: { data: { posts: makeUpdate('4514943', 'Survived') } } },
    ]);
    const newEntries = await fetchPollUpdate('iran-war-live', [4512107, 4512099, 4512131]);
    expect(newEntries.map((e) => e.id)).toEqual(['4514943']);
  });

  it('logs non-404 per-update rejections to console.error (5xx case)', async () => {
    mock = mockFetchSequence([
      { body: SHELL_WITH_TWO_NEW },
      { body: { data: { posts: makeUpdate('4514963', 'Survived') } } },
      { status: 500, rawBody: 'upstream broken' }, // 4514943 5xx — transient
    ]);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const newEntries = await fetchPollUpdate('iran-war-live', [4512107, 4512099, 4512131]);

    expect(newEntries.map((e) => e.id)).toEqual(['4514963']);
    expect(errSpy).toHaveBeenCalledWith(
      'liveblog-updater: per-update fetch failed:',
      expect.objectContaining({ id: 4514943 }),
    );
    errSpy.mockRestore();
  });
});

describe('LiveBlogUpdater (render shell)', () => {
  it('renders an aria-live polite region as the polling target', async () => {
    const { screen, render } = await createDOM();
    await render(<LiveBlogUpdater slug="iran-war-live" initialChildIds={[4514963, 4514943]} />);
    const region = screen.querySelector('[data-live-blog-updater]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('aria-live')).toBe('polite');
  });
});

// Wiring contract: Qwik LiveBlogUpdater must pass the same options to the
// shared createPollLoop helper that the Astro mirror does (concurrency
// guard, document-hidden honoring, deletion guard, single-log onError).
// createDOM doesn't bootstrap qwikLoader so we can't observe the polling
// behavior end-to-end, but the visible-task arms and the createPollLoop call
// happens — we capture its options arg via vi.mock above.
describe('LiveBlogUpdater createPollLoop wiring', () => {
  let mock: MockedFetch | undefined;
  isolateDocumentHidden();

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
    createPollLoopMock.mockClear();
    // visible-task may invoke tick(); shell fetch returns empty so the call
    // resolves cleanly even though we ignore the result here.
    mock = mockFetchOnce({ body: { data: { article: null } } });
  });

  afterEach(() => {
    mock?.restore();
    mock = undefined;
    vi.unstubAllEnvs();
  });

  it('passes liveblog-specific label, onError, shouldSkip + concurrency/deletion-guard knobs', async () => {
    const { render } = await createDOM();
    await render(<LiveBlogUpdater slug="iran-war-live" initialChildIds={[4514963, 4514943]} />);

    expect(createPollLoopMock).toHaveBeenCalledOnce();
    const calls = createPollLoopMock.mock.calls as unknown as Array<
      [PollLoopOptions<LiveBlogUpdate[]>]
    >;
    const opts = calls[0]![0];

    expect(opts.label).toBe('liveblog-updater');
    expect(opts.maxConsecutiveEmpty).toBe(MAX_CONSECUTIVE_EMPTY_POLLS);
    expect(opts.intervalMs).toBe(
      resolvePollIntervalMs(
        import.meta.env.PUBLIC_LIVEBLOG_POLL_INTERVAL_MS,
        LIVEBLOG_POLL_INTERVAL_MS,
      ),
    );
    expect(opts.immediate).toBeUndefined(); // SSR-seeded; no first-paint poll needed
    expect(typeof opts.tick).toBe('function');
    expect(typeof opts.onResult).toBe('function');

    // shouldSkip must honor document.hidden so background tabs don't poll.
    // configurable:true so each test re-flip overrides cleanly between runs.
    expect(opts.shouldSkip).toBeTypeOf('function');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    expect(opts.shouldSkip!()).toBe(true);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    expect(opts.shouldSkip!()).toBe(false);

    // onError must log with the liveblog-updater prefix so cross-app log
    // filtering can match by component name.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    opts.onError!(new Error('boom'));
    expect(errSpy).toHaveBeenCalledWith('liveblog-updater: poll tick failed:', expect.any(Error));
    errSpy.mockRestore();
  });
});
