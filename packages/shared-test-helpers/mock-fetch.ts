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

// Multi-call variant for callers that fan out fetches via Promise.all
// (e.g. routeLoaders that hydrate multiple sections in parallel).
// Pops one MockFetchOptions per fetch call; throws if exhausted, so a missing
// queue entry is loud rather than silently re-using the last response.
export function mockFetchSequence(responses: MockFetchOptions[]): MockedFetch {
  const queue = [...responses];
  const calls: CapturedFetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const next = queue.shift();
    if (!next) {
      throw new Error(`mockFetchSequence exhausted after ${calls.length} call(s)`);
    }
    const { body, status = 200, rawBody } = next;
    const responseBody = rawBody ?? JSON.stringify(body ?? { data: {} });
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
