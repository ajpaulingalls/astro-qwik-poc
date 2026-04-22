export type WpSite = "aje" | "aja";

export interface GraphQLOptions {
  operationName: string;
  variables?: Record<string, unknown>;
  wpSite?: WpSite;
}

const DEFAULT_API_BASE = "http://localhost:4455";

export async function graphqlFetch<T>({
  operationName,
  variables = {},
  wpSite = "aje",
}: GraphQLOptions): Promise<T> {
  const apiBase = import.meta.env.PUBLIC_API_BASE || DEFAULT_API_BASE;
  const params = new URLSearchParams({
    "wp-site": wpSite,
    operationName,
    variables: JSON.stringify(variables),
    extensions: "{}",
  });

  const response = await fetch(`${apiBase}/graphql?${params}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      "wp-site": wpSite,
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
