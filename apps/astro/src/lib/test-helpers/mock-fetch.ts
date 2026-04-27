import { vi } from 'vitest';

export interface CapturedFetchCall {
  url: string;
  init: RequestInit | undefined;
}

export interface MockFetchOptions {
  body?: unknown;
  status?: number;
  rawBody?: string;
}

export interface MockedFetch {
  calls: CapturedFetchCall[];
  restore: () => void;
}

export function mockFetchOnce(options: MockFetchOptions = {}): MockedFetch {
  const { body, status = 200, rawBody } = options;
  const calls: CapturedFetchCall[] = [];
  const original = globalThis.fetch;
  const responseBody = rawBody ?? JSON.stringify(body ?? { data: {} });
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(responseBody, {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}
