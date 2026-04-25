export type WpSite = 'aje' | 'aja';

export interface GraphqlFetchOptions {
  operationName: string;
  variables?: Record<string, unknown>;
  wpSite?: WpSite;
}

const DEFAULT_API_BASE = 'http://localhost:4455';

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
    throw new Error(
      `graphqlFetch ${operationName} failed: ${response.status} ${response.statusText}`,
    );
  }

  const json = (await response.json()) as { data: T };
  return json.data;
}
