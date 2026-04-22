import { assertEquals, assertStringIncludes } from "@std/assert";
import { withRunningServer } from "./_helpers.ts";

Deno.test("server: boots and serves a fixture via real HTTP", async () => {
  await withRunningServer(
    { HomePageQuery: { data: { homepage: { layout: "three-column" } } } },
    async (port) => {
      const res = await fetch(
        `http://localhost:${port}/graphql?operationName=HomePageQuery&variables=%7B%7D`,
        { headers: { "wp-site": "aje" } },
      );
      assertEquals(res.status, 200);
      assertEquals(res.headers.get("content-type"), "application/json");
      const body = await res.json();
      assertEquals(body.data.homepage.layout, "three-column");
    },
  );
});

Deno.test("server: missing wp-site header returns 400 over real HTTP (negative-path smoke)", async () => {
  // No fixtures needed: rejection happens before fixture lookup.
  await withRunningServer({}, async (port) => {
    const res = await fetch(
      `http://localhost:${port}/graphql?operationName=HomePageQuery&variables=%7B%7D`,
    );
    assertEquals(res.status, 400);
    assertStringIncludes(await res.text(), "wp-site");
  });
});

Deno.test("server: variant routing serves different fixtures for same op + different vars", async () => {
  await withRunningServer(
    {
      "ArchipelagoAjeSectionPostsQuery--middle-east--offset-0": { data: { posts: ["a"] } },
      "ArchipelagoAjeSectionPostsQuery--middle-east--offset-9": { data: { posts: ["b"] } },
    },
    async (port) => {
      const v0 = encodeURIComponent(JSON.stringify({ category: "middle-east", offset: 0 }));
      const v9 = encodeURIComponent(JSON.stringify({ category: "middle-east", offset: 9 }));
      const res0 = await fetch(
        `http://localhost:${port}/graphql?operationName=ArchipelagoAjeSectionPostsQuery&variables=${v0}`,
        { headers: { "wp-site": "aje" } },
      );
      const res9 = await fetch(
        `http://localhost:${port}/graphql?operationName=ArchipelagoAjeSectionPostsQuery&variables=${v9}`,
        { headers: { "wp-site": "aje" } },
      );
      const body0 = await res0.json();
      const body9 = await res9.json();
      assertEquals(body0.data.posts, ["a"]);
      assertEquals(body9.data.posts, ["b"]);
    },
  );
});
