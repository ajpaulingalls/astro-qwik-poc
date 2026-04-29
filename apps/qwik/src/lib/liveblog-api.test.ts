// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetchSequence, type MockedFetch } from '@aje-poc/shared-test-helpers';
import { fetchLiveBlogShell, fetchLiveBlogUpdate } from './liveblog-api';

describe('liveblog-api null payload handling', () => {
  let mock: MockedFetch | undefined;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    mock = undefined;
    vi.unstubAllEnvs();
  });

  it('fetchLiveBlogShell returns null when GraphQL data.article is null', async () => {
    mock = mockFetchSequence([{ body: { data: { article: null } } }]);
    const shell = await fetchLiveBlogShell('iran-war-live');
    expect(shell).toBeNull();
  });

  it('fetchLiveBlogUpdate returns null when GraphQL data.posts is null', async () => {
    mock = mockFetchSequence([{ body: { data: { posts: null } } }]);
    const update = await fetchLiveBlogUpdate(4514963);
    expect(update).toBeNull();
  });
});
