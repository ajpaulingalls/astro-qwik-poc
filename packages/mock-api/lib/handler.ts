import { MissingVariableError, resolveFixtureKey, type Variables } from "./variants.ts";

// Fixtures are pre-stringified at load (see lib/fixtures.ts) so the hot path
// can return them directly without per-request JSON.stringify.
export type FixtureMap = Map<string, string>;

export interface HandlerDeps {
  fixtures: FixtureMap;
}

const CORS_HEADERS: HeadersInit = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "wp-site, content-type",
};

export function handle(req: Request, deps: HandlerDeps): Response {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return text(405, `Method not allowed: ${req.method}`);
  }

  const url = new URL(req.url);

  if (url.pathname !== "/graphql") {
    return text(404, `Not found: ${url.pathname}`);
  }

  if (!req.headers.get("wp-site")) {
    return text(400, "Missing wp-site header");
  }

  const operationName = url.searchParams.get("operationName");
  if (!operationName) {
    return text(400, "Missing operationName");
  }

  let variables: Variables = {};
  const rawVariables = url.searchParams.get("variables");
  if (rawVariables) {
    try {
      variables = JSON.parse(rawVariables) as Variables;
    } catch {
      return text(400, `Invalid variables JSON: ${rawVariables}`);
    }
  }

  let key: string;
  try {
    key = resolveFixtureKey(operationName, variables);
  } catch (err) {
    if (err instanceof MissingVariableError) {
      return text(400, err.message);
    }
    throw err;
  }

  const fixture = deps.fixtures.get(key);
  if (fixture === undefined) {
    return text(404, `Unknown operation: ${operationName} (no fixture for key '${key}')`);
  }

  return new Response(fixture, {
    status: 200,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

function text(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, "content-type": "text/plain" },
  });
}
