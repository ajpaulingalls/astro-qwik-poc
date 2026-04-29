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
import { mockFetchSequence, type MockedFetch } from '@aje-poc/shared-test-helpers';
import { fetchPollUpdate, LiveBlogUpdater, resolvePollIntervalMs } from './LiveBlogUpdater';
import type { LiveBlogUpdate } from '@aje-poc/shared-types';

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

describe('resolvePollIntervalMs', () => {
  it('returns the env value when finite and positive', () => {
    expect(resolvePollIntervalMs('500', 30_000)).toBe(500);
    expect(resolvePollIntervalMs(1234, 30_000)).toBe(1234);
  });
  it('falls through to default on undefined / null / empty', () => {
    expect(resolvePollIntervalMs(undefined, 30_000)).toBe(30_000);
    expect(resolvePollIntervalMs(null, 30_000)).toBe(30_000);
    expect(resolvePollIntervalMs('', 30_000)).toBe(30_000);
  });
  it('falls through to default on zero, negatives, and non-numeric strings', () => {
    expect(resolvePollIntervalMs(0, 30_000)).toBe(30_000);
    expect(resolvePollIntervalMs('-1', 30_000)).toBe(30_000);
    expect(resolvePollIntervalMs('not-a-number', 30_000)).toBe(30_000);
  });
  // Pins the Number.isFinite half of the rule. Without this, dropping
  // isFinite from the impl (using only `n > 0`) would silently let
  // Infinity through and arm setInterval with a non-finite delay.
  it('falls through to default on NaN, Infinity, and -Infinity', () => {
    expect(resolvePollIntervalMs(NaN, 30_000)).toBe(30_000);
    expect(resolvePollIntervalMs(Infinity, 30_000)).toBe(30_000);
    expect(resolvePollIntervalMs(-Infinity, 30_000)).toBe(30_000);
  });
});

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
