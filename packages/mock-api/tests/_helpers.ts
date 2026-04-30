import { startServer } from "../server.ts";

// Re-exported from shared-types via the deno.json import map so the slug has
// a single SoT across the bun-side consumers (perf-harness fixtures, apps/astro
// liveblog tests, shared-types tests) and the Deno-side mock-api tests; see
// packages/shared-types/index.ts for the canonical declaration.
export { LIVEBLOG_SLUG } from "@aje-poc/shared-types";

export function buildRequest(opts: {
  method?: string;
  path?: string;
  operationName?: string;
  variables?: unknown;
  wpSite?: string | null;
  snapshotHeader?: string;
}): Request {
  const path = opts.path ?? "/graphql";
  const params = new URLSearchParams();
  if (opts.operationName !== undefined) {
    params.set("operationName", opts.operationName);
  }
  if (opts.variables !== undefined) {
    const v = typeof opts.variables === "string"
      ? opts.variables
      : JSON.stringify(opts.variables);
    params.set("variables", v);
  }
  const url = `http://localhost:4455${path}${
    params.toString() ? "?" + params.toString() : ""
  }`;
  const headers = new Headers();
  if (opts.wpSite !== null) headers.set("wp-site", opts.wpSite ?? "aje");
  if (opts.snapshotHeader !== undefined) {
    headers.set("x-liveblog-snapshot", opts.snapshotHeader);
  }
  return new Request(url, { method: opts.method ?? "GET", headers });
}

export async function withTempDir<T>(
  fn: (dir: string) => Promise<T>,
  prefix = "mock-api-test-",
): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix });
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

export async function withRunningServer<T>(
  fixtures: Record<string, unknown>,
  fn: (port: number) => Promise<T>,
): Promise<T> {
  return await withTempDir(async (dir) => {
    for (const [key, value] of Object.entries(fixtures)) {
      await Deno.writeTextFile(`${dir}/${key}.json`, JSON.stringify(value));
    }
    const server = await startServer({ port: 0, fixtureDir: dir });
    try {
      return await fn(server.port);
    } finally {
      await server.shutdown();
    }
  }, "mock-api-server-test-");
}
