import { assertEquals } from "@std/assert";
import { readSnapshotEnv } from "../lib/handler.ts";

// Stubbed envGet — tests pass an in-memory map rather than mutating Deno.env
// so cases stay parallel-safe. Each test owns its own map.
function fakeEnv(values: Record<string, string>) {
  return (key: string) => values[key];
}

Deno.test("readSnapshotEnv: prefers SNAPSHOT_INDEX over LIVEBLOG_SNAPSHOT_INDEX when both set", () => {
  const env = readSnapshotEnv(
    fakeEnv({ SNAPSHOT_INDEX: "5", LIVEBLOG_SNAPSHOT_INDEX: "9" }),
  );
  assertEquals(env.index, "5");
});

Deno.test("readSnapshotEnv: falls back to LIVEBLOG_SNAPSHOT_INDEX when SNAPSHOT_INDEX unset", () => {
  const env = readSnapshotEnv(fakeEnv({ LIVEBLOG_SNAPSHOT_INDEX: "7" }));
  assertEquals(env.index, "7");
});

Deno.test("readSnapshotEnv: returns null index when neither var set", () => {
  const env = readSnapshotEnv(fakeEnv({}));
  assertEquals(env.index, null);
});

Deno.test("readSnapshotEnv: prefers SNAPSHOT_INTERVAL_MS over LIVEBLOG_SNAPSHOT_INTERVAL_MS when both set", () => {
  const env = readSnapshotEnv(
    fakeEnv({
      SNAPSHOT_INTERVAL_MS: "1000",
      LIVEBLOG_SNAPSHOT_INTERVAL_MS: "5000",
    }),
  );
  assertEquals(env.interval, "1000");
});

Deno.test("readSnapshotEnv: falls back to LIVEBLOG_SNAPSHOT_INTERVAL_MS when SNAPSHOT_INTERVAL_MS unset", () => {
  const env = readSnapshotEnv(
    fakeEnv({ LIVEBLOG_SNAPSHOT_INTERVAL_MS: "2000" }),
  );
  assertEquals(env.interval, "2000");
});

Deno.test("readSnapshotEnv: returns null interval when neither var set", () => {
  const env = readSnapshotEnv(fakeEnv({}));
  assertEquals(env.interval, null);
});
