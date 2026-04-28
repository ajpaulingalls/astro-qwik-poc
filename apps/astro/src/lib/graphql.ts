import { DEFAULT_API_BASE } from '@aje-poc/shared-csp';

export type WpSite = 'aje' | 'aja';

export interface GraphqlFetchOptions {
  operationName: string;
  variables?: Record<string, unknown>;
  wpSite?: WpSite;
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
  const fromEnv = import.meta.env?.PUBLIC_API_BASE;
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_API_BASE;
}

export async function graphqlFetch<T>({
  operationName,
  variables = {},
  wpSite = 'aje',
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
