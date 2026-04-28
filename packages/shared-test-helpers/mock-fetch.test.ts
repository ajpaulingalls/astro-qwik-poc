import { describe, it, expect, afterEach } from 'vitest';
import { mockFetchSequence, type MockedFetch } from './mock-fetch.ts';

describe('mockFetchSequence', () => {
  let mock: MockedFetch | undefined;
  afterEach(() => mock?.restore());

  it('returns queued responses in order', async () => {
    mock = mockFetchSequence([{ body: { data: { which: 1 } } }, { body: { data: { which: 2 } } }]);
    const a = await (await fetch('https://a')).json();
    const b = await (await fetch('https://b')).json();
    expect(a).toEqual({ data: { which: 1 } });
    expect(b).toEqual({ data: { which: 2 } });
    expect(mock.calls.map((c) => c.url)).toEqual(['https://a', 'https://b']);
  });

  it('throws when exhausted', async () => {
    mock = mockFetchSequence([{ body: { data: {} } }]);
    await fetch('https://a');
    await expect(fetch('https://b')).rejects.toThrow(/exhausted after 2/);
  });
});
