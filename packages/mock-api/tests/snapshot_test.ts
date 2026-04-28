import { assertEquals } from "@std/assert";
import { resolveSnapshotIndex } from "../lib/snapshot.ts";

Deno.test("resolveSnapshotIndex: header takes precedence over env and clock", () => {
  assertEquals(
    resolveSnapshotIndex({
      headerValue: "0",
      maxN: 3,
      envIndex: "2",
      envInterval: null,
    }),
    0,
  );
  assertEquals(
    resolveSnapshotIndex({
      headerValue: "1",
      maxN: 3,
      envIndex: "2",
      envInterval: null,
    }),
    1,
  );
});

Deno.test("resolveSnapshotIndex: header is clamped to [0, maxN-1]", () => {
  assertEquals(
    resolveSnapshotIndex({
      headerValue: "99",
      maxN: 3,
      envIndex: null,
      envInterval: null,
    }),
    2,
  );
  assertEquals(
    resolveSnapshotIndex({
      headerValue: "-1",
      maxN: 3,
      envIndex: null,
      envInterval: null,
    }),
    0,
  );
});

Deno.test("resolveSnapshotIndex: env overrides wall-clock when no header", () => {
  assertEquals(
    resolveSnapshotIndex({
      headerValue: null,
      maxN: 3,
      envIndex: "2",
      envInterval: null,
    }),
    2,
  );
});

Deno.test("resolveSnapshotIndex: env is clamped to [0, maxN-1]", () => {
  assertEquals(
    resolveSnapshotIndex({
      headerValue: null,
      maxN: 3,
      envIndex: "99",
      envInterval: null,
    }),
    2,
  );
});

Deno.test("resolveSnapshotIndex: maxN=0 short-circuits to 0 (no snapshots on disk)", () => {
  assertEquals(
    resolveSnapshotIndex({
      headerValue: "5",
      maxN: 0,
      envIndex: "5",
      envInterval: null,
    }),
    0,
  );
});

Deno.test("resolveSnapshotIndex: malformed header falls through to env, then clock", () => {
  assertEquals(
    resolveSnapshotIndex({
      headerValue: "abc",
      maxN: 3,
      envIndex: "1",
      envInterval: null,
    }),
    1,
  );
  assertEquals(
    resolveSnapshotIndex({
      headerValue: "",
      maxN: 3,
      envIndex: "1",
      envInterval: null,
    }),
    1,
  );
});

Deno.test("resolveSnapshotIndex: wall-clock fallback returns a value within [0, maxN-1]", () => {
  const idx = resolveSnapshotIndex({
    headerValue: null,
    maxN: 3,
    envIndex: null,
    envInterval: "1",
  });
  assertEquals(idx >= 0 && idx < 3, true);
});
