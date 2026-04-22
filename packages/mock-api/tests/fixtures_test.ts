import { assert, assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@^1";
import { loadFixtures } from "../lib/fixtures.ts";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "mock-api-fixtures-test-" });
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("loadFixtures: loads all .json files, key = basename without extension", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/HomePageQuery.json`, JSON.stringify({ data: { homepage: 1 } }));
    await Deno.writeTextFile(`${dir}/ArchipelagoBreakingTickerQuery.json`, JSON.stringify({ data: { ticker: [] } }));

    const map = await loadFixtures(dir);

    assertEquals(map.size, 2);
    assert(map.has("HomePageQuery"));
    assert(map.has("ArchipelagoBreakingTickerQuery"));
  });
});

Deno.test("loadFixtures: stores raw file text (pre-stringified), not parsed object", async () => {
  await withTempDir(async (dir) => {
    const body = JSON.stringify({ data: { homepage: { layout: "three-column" } } });
    await Deno.writeTextFile(`${dir}/HomePageQuery.json`, body);

    const map = await loadFixtures(dir);
    const stored = map.get("HomePageQuery");

    assertEquals(typeof stored, "string");
    assertEquals(stored, body);
  });
});

Deno.test("loadFixtures: preserves variant filenames (e.g. Op--variant--offset-N.json)", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(
      `${dir}/ArchipelagoAjeSectionPostsQuery--middle-east--offset-9.json`,
      JSON.stringify({ data: { posts: [] } }),
    );

    const map = await loadFixtures(dir);

    assert(map.has("ArchipelagoAjeSectionPostsQuery--middle-east--offset-9"));
  });
});

Deno.test("loadFixtures: ignores non-.json files in the directory", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/HomePageQuery.json`, JSON.stringify({ data: 1 }));
    await Deno.writeTextFile(`${dir}/README.md`, "# notes");
    await Deno.writeTextFile(`${dir}/notes.txt`, "ignored");

    const map = await loadFixtures(dir);

    assertEquals(map.size, 1);
    assert(map.has("HomePageQuery"));
  });
});

Deno.test("loadFixtures: empty directory returns empty Map", async () => {
  await withTempDir(async (dir) => {
    const map = await loadFixtures(dir);
    assertEquals(map.size, 0);
  });
});

Deno.test("loadFixtures: invalid JSON in any fixture throws (fail-loud at startup)", async () => {
  await withTempDir(async (dir) => {
    await Deno.writeTextFile(`${dir}/HomePageQuery.json`, JSON.stringify({ data: 1 }));
    await Deno.writeTextFile(`${dir}/Broken.json`, "{ this is: not, valid json");

    const err = await assertRejects(() => loadFixtures(dir));
    assertStringIncludes(String(err), "Broken.json");
  });
});

Deno.test("loadFixtures: missing directory throws Deno.errors.NotFound", async () => {
  await assertRejects(
    () => loadFixtures("/nonexistent/path/should/not/exist/xyzzy"),
    Deno.errors.NotFound,
  );
});
