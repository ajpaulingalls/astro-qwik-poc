// Snapshot rotation for snapshotted operations (live-blog + breaking ticker).
// The mock-api ships multiple JSON variants of each fixture (--snapshot-0,
// --snapshot-1, ...) so a polling client observes a delta over time — a
// growing children list for live-blog, an active/inactive toggle plus copy
// change for the ticker. Three resolution tiers, in precedence order:
//
//   1. Per-request `x-liveblog-snapshot: N` header — used by the perf-harness
//      and deterministic tests to pin a specific snapshot regardless of clock.
//   2. `SNAPSHOT_INDEX` env var (or its `LIVEBLOG_SNAPSHOT_INDEX` back-compat
//      alias) — pins a snapshot for the lifetime of a server process
//      (single-snapshot test runs).
//   3. Wall-clock auto-rotation — every `SNAPSHOT_INTERVAL_MS` (or the
//      `LIVEBLOG_SNAPSHOT_INTERVAL_MS` back-compat alias; default 30000) the
//      index advances by one, wrapping at maxN. Anchored to *server* start,
//      not per-client; two browsers polling concurrently observe the same
//      index. The header path is the deterministic contract for tests /
//      perf-harness — wall-clock is dev/demo only.

const DEFAULT_INTERVAL_MS = 30_000;

const serverStart = Date.now();

export interface ResolveSnapshotOptions {
  headerValue: string | null;
  maxN: number;
  // Injected so this module stays pure and testable. The handler captures
  // Deno.env at startup (see handler.ts) and forwards it here per-request.
  envIndex: string | null;
  envInterval: string | null;
}

export function resolveSnapshotIndex(opts: ResolveSnapshotOptions): number {
  const { headerValue, maxN, envIndex, envInterval } = opts;
  if (maxN <= 0) return 0;

  const fromHeader = parseIndex(headerValue);
  if (fromHeader !== null) return clamp(fromHeader, maxN);

  const fromEnv = parseIndex(envIndex);
  if (fromEnv !== null) return clamp(fromEnv, maxN);

  const interval = parseInterval(envInterval);
  return Math.floor((Date.now() - serverStart) / interval) % maxN;
}

function parseIndex(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function parseInterval(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || raw === "") {
    return DEFAULT_INTERVAL_MS;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_INTERVAL_MS;
}

function clamp(n: number, maxN: number): number {
  if (n < 0) return 0;
  if (n >= maxN) return maxN - 1;
  return n;
}
