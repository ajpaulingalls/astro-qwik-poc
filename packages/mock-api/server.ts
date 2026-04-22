import { loadFixtures } from "./lib/fixtures.ts";
import { handle } from "./lib/handler.ts";

export interface ServerOptions {
  port?: number;
  fixtureDir?: string;
}

export interface RunningServer {
  port: number;
  shutdown(): Promise<void>;
}

const DEFAULT_PORT = 4455;
const DEFAULT_FIXTURE_DIR = "./fixtures";

export async function startServer(opts: ServerOptions = {}): Promise<RunningServer> {
  const port = resolvePort(opts.port);
  const fixtureDir = opts.fixtureDir ?? Deno.env.get("FIXTURE_DIR") ?? DEFAULT_FIXTURE_DIR;
  const fixtures = await loadFixtures(fixtureDir);
  const server = Deno.serve({ port }, (req) => handle(req, { fixtures }));
  return {
    port: (server.addr as Deno.NetAddr).port,
    shutdown: () => server.shutdown(),
  };
}

function resolvePort(explicit: number | undefined): number {
  if (explicit !== undefined) return explicit;
  const env = Deno.env.get("PORT");
  if (env === undefined) return DEFAULT_PORT;
  const parsed = Number(env);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid PORT env: '${env}' (must be an integer 0-65535)`);
  }
  return parsed;
}

if (import.meta.main) {
  await startServer();
}
