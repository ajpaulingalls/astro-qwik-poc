import { DEFAULT_API_BASE } from '@aje-poc/shared-csp';

export type WpSite = 'aje' | 'aja';

export interface GraphqlFetchOptions {
  operationName: string;
  variables?: Record<string, unknown>;
  wpSite?: WpSite;
  // wp-site and accept are re-set after this spread, so they cannot be
  // shadowed by caller mistakes — protected-header invariant.
  headers?: Record<string, string>;
}

// Carries the upstream HTTP status so callers (e.g. news/[...slug] route)
// can branch on .status === 404 without string-matching the error message.
export class GraphqlHttpError extends Error {
  override readonly name = 'GraphqlHttpError';
  constructor(
    readonly operationName: string,
    readonly status: number,
    readonly statusText: string,
  ) {
    super(`graphqlFetch ${operationName} failed: ${status} ${statusText}`);
  }
}

export function resolveApiBase(): string {
  // Build-time replacement first (Vite injects PUBLIC_API_BASE at build).
  const fromBuildEnv = import.meta.env?.PUBLIC_API_BASE;
  if (fromBuildEnv && fromBuildEnv.length > 0) return fromBuildEnv;
  // Runtime override on the Node SSR side (perf-harness/acceptance suite
  // sets PUBLIC_API_BASE=http://localhost:4456 to point Qwik at its own
  // mock-api instance, leaving Astro on 4455 so test runs can parallelise).
  // `process` is undefined on the browser side, so this is server-only.
  const runtimeProcess = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process;
  const fromRuntimeEnv = runtimeProcess?.env?.PUBLIC_API_BASE;
  if (fromRuntimeEnv && fromRuntimeEnv.length > 0) return fromRuntimeEnv;
  return DEFAULT_API_BASE;
}

export async function graphqlFetch<T>({
  operationName,
  variables = {},
  wpSite = 'aje',
  headers,
}: GraphqlFetchOptions): Promise<T> {
  const params = new URLSearchParams({
    'wp-site': wpSite,
    operationName,
    variables: JSON.stringify(variables),
    extensions: '{}',
  });

  const response = await fetch(`${resolveApiBase()}/graphql?${params.toString()}`, {
    method: 'GET',
    headers: {
      ...headers,
      accept: 'application/json',
      'wp-site': wpSite,
    },
  });

  if (!response.ok) {
    throw new GraphqlHttpError(operationName, response.status, response.statusText);
  }

  const json = (await response.json()) as { data: T };
  return json.data;
}
