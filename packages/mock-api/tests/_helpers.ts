import { startServer } from "../server.ts";

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
