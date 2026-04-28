import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { graphqlFetch, GraphqlHttpError } from './graphql';
import { mockFetchOnce } from '@aje-poc/shared-test-helpers';

describe('graphqlFetch', () => {
  let mock: ReturnType<typeof mockFetchOnce>;

  beforeEach(() => {
    vi.stubEnv('PUBLIC_API_BASE', '');
  });

  afterEach(() => {
    mock?.restore();
    vi.unstubAllEnvs();
  });

  it('falls back to http://localhost:4455 when PUBLIC_API_BASE is unset', async () => {
    mock = mockFetchOnce({ body: { data: { ok: true } } });

    await graphqlFetch({ operationName: 'HomePageQuery' });

    const url = new URL(mock.calls[0]!.url);
    expect(url.origin).toBe('http://localhost:4455');
    expect(url.pathname).toBe('/graphql');
  });

  it('uses PUBLIC_API_BASE from env when set', async () => {
    vi.stubEnv('PUBLIC_API_BASE', 'https://api.example.com');
    mock = mockFetchOnce({ body: { data: { ok: true } } });

    await graphqlFetch({ operationName: 'HomePageQuery' });

    const url = new URL(mock.calls[0]!.url);
    expect(url.origin).toBe('https://api.example.com');
  });

  it('builds URL with operationName, URL-encoded JSON variables, and empty extensions', async () => {
    mock = mockFetchOnce({ body: { data: { ok: true } } });

    await graphqlFetch({
      operationName: 'HomePageQuery',
      variables: { isAtf: true, atfLength: 2, slug: '', preview: '' },
    });

    const url = new URL(mock.calls[0]!.url);
    expect(url.searchParams.get('operationName')).toBe('HomePageQuery');
    expect(url.searchParams.get('extensions')).toBe('{}');
    expect(JSON.parse(url.searchParams.get('variables')!)).toEqual({
      isAtf: true,
      atfLength: 2,
      slug: '',
      preview: '',
    });
  });

  it('omits variables when none supplied — sends empty JSON object', async () => {
    mock = mockFetchOnce({ body: { data: { ok: true } } });

    await graphqlFetch({ operationName: 'HomePageQuery' });

    const url = new URL(mock.calls[0]!.url);
    expect(url.searchParams.get('variables')).toBe('{}');
  });

  it('issues a GET and injects the wp-site header (default aje)', async () => {
    mock = mockFetchOnce({ body: { data: { ok: true } } });

    await graphqlFetch({ operationName: 'HomePageQuery' });

    const init = mock.calls[0]!.init!;
    expect(init.method).toBe('GET');
    const headers = new Headers(init.headers);
    expect(headers.get('wp-site')).toBe('aje');
    expect(headers.get('accept')).toBe('application/json');
    const url = new URL(mock.calls[0]!.url);
    expect(url.searchParams.get('wp-site')).toBe('aje');
  });

  it('honours wpSite override (aja for Arabic)', async () => {
    mock = mockFetchOnce({ body: { data: { ok: true } } });

    await graphqlFetch({ operationName: 'HomePageQuery', wpSite: 'aja' });

    const init = mock.calls[0]!.init!;
    const headers = new Headers(init.headers);
    expect(headers.get('wp-site')).toBe('aja');
    const url = new URL(mock.calls[0]!.url);
    expect(url.searchParams.get('wp-site')).toBe('aja');
  });

  it('returns json.data unwrapped and typed', async () => {
    interface Shape {
      homepage: { layout: string };
    }
    mock = mockFetchOnce({ body: { data: { homepage: { layout: 'three-column' } } } });

    const result = await graphqlFetch<Shape>({ operationName: 'HomePageQuery' });

    expect(result.homepage.layout).toBe('three-column');
  });

  it('throws when the response status is not ok', async () => {
    mock = mockFetchOnce({ status: 400, rawBody: 'Missing wp-site header' });

    await expect(graphqlFetch({ operationName: 'HomePageQuery' })).rejects.toThrow(
      /HomePageQuery.*400/,
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
