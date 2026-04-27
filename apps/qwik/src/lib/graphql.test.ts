import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphqlFetch, GraphqlHttpError } from './graphql';
import { mockFetchOnce } from './test-helpers/mock-fetch';

describe('graphqlFetch', () => {
  let mock: ReturnType<typeof mockFetchOnce>;

  afterEach(() => {
    mock?.restore();
    vi.unstubAllEnvs();
  });

  it('builds a GET URL with operationName, URL-encoded variables, and extensions={}', async () => {
    mock = mockFetchOnce({ body: { data: { homepage: { layout: 'three-column' } } } });

    await graphqlFetch({
      operationName: 'HomePageQuery',
      variables: { isAtf: true, atfLength: 2, slug: '', preview: '' },
    });

    expect(mock.calls).toHaveLength(1);
    const url = new URL(mock.calls[0]!.url);
    expect(url.pathname).toBe('/graphql');
    expect(url.searchParams.get('operationName')).toBe('HomePageQuery');
    expect(url.searchParams.get('wp-site')).toBe('aje');
    expect(JSON.parse(url.searchParams.get('variables') ?? '{}')).toEqual({
      isAtf: true,
      atfLength: 2,
      slug: '',
      preview: '',
    });
    expect(url.searchParams.get('extensions')).toBe('{}');
    expect(mock.calls[0]!.init?.method ?? 'GET').toBe('GET');
  });

  it('injects the wp-site header (default aje)', async () => {
    mock = mockFetchOnce({ body: { data: {} } });
    await graphqlFetch({ operationName: 'HomePageQuery' });
    const headers = new Headers(mock.calls[0]!.init?.headers);
    expect(headers.get('wp-site')).toBe('aje');
  });

  it('honours an explicit wpSite override (aja)', async () => {
    mock = mockFetchOnce({ body: { data: {} } });
    await graphqlFetch({ operationName: 'HomePageQuery', wpSite: 'aja' });
    const url = new URL(mock.calls[0]!.url);
    const headers = new Headers(mock.calls[0]!.init?.headers);
    expect(url.searchParams.get('wp-site')).toBe('aja');
    expect(headers.get('wp-site')).toBe('aja');
  });

  it('returns json.data typed as T', async () => {
    mock = mockFetchOnce({ body: { data: { homepage: { layout: 'three-column' } } } });
    const result = await graphqlFetch<{ homepage: { layout: string } }>({
      operationName: 'HomePageQuery',
    });
    expect(result.homepage.layout).toBe('three-column');
  });

  it('falls back to http://localhost:4455 when PUBLIC_API_BASE is unset', async () => {
    vi.stubEnv('PUBLIC_API_BASE', '');
    mock = mockFetchOnce({ body: { data: {} } });
    await graphqlFetch({ operationName: 'HomePageQuery' });
    expect(mock.calls[0]!.url.startsWith('http://localhost:4455/graphql?')).toBe(true);
  });

  it('uses PUBLIC_API_BASE from import.meta.env when set', async () => {
    vi.stubEnv('PUBLIC_API_BASE', 'https://api.example.test');
    mock = mockFetchOnce({ body: { data: {} } });
    await graphqlFetch({ operationName: 'HomePageQuery' });
    expect(mock.calls[0]!.url.startsWith('https://api.example.test/graphql?')).toBe(true);
  });

  it('throws when the response status is not ok', async () => {
    mock = mockFetchOnce({ status: 400, rawBody: 'Missing wp-site header' });
    await expect(graphqlFetch({ operationName: 'HomePageQuery' })).rejects.toThrow(
      /graphqlFetch HomePageQuery failed: 400/,
    );
  });

  it('throws GraphqlHttpError carrying the status code so callers can branch on .status', async () => {
    mock = mockFetchOnce({ status: 404, rawBody: 'Not found' });
    const promise = graphqlFetch({ operationName: 'ArchipelagoSingleArticleQuery' });
    await expect(promise).rejects.toBeInstanceOf(GraphqlHttpError);
    await expect(promise).rejects.toMatchObject({
      name: 'GraphqlHttpError',
      status: 404,
      operationName: 'ArchipelagoSingleArticleQuery',
    });
  });
});
