import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { handle } from "../lib/handler.ts";
import { loadFixtures } from "../lib/fixtures.ts";

const fixtures = new Map<string, string>([
  [
    "HomePageQuery",
    JSON.stringify({ data: { homepage: { layout: "three-column" } } }),
  ],
  [
    "ArchipelagoSectionQuery--middle-east",
    JSON.stringify({ data: { section: { name: "middle-east" } } }),
  ],
  [
    "ArchipelagoAjeSectionPostsQuery--middle-east--offset-0",
    JSON.stringify({ data: { posts: ["a", "b"] } }),
  ],
  [
    "ArchipelagoAjeSectionPostsQuery--middle-east--offset-9",
    JSON.stringify({ data: { posts: ["c", "d"] } }),
  ],
]);

function buildRequest(opts: {
  method?: string;
  path?: string;
  operationName?: string;
  variables?: unknown;
  wpSite?: string | null;
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
  return new Request(url, { method: opts.method ?? "GET", headers });
}

Deno.test("handler: GET with valid wp-site + known operationName returns fixture JSON 200", async () => {
  const res = handle(
    buildRequest({ operationName: "HomePageQuery", variables: {} }),
    { fixtures },
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "application/json");
  const body = await res.json();
  assertEquals(body.data.homepage.layout, "three-column");
});

Deno.test("handler: every response includes CORS headers", () => {
  const res = handle(
    buildRequest({ operationName: "HomePageQuery", variables: {} }),
    { fixtures },
  );
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  assertStringIncludes(
    res.headers.get("access-control-allow-headers") ?? "",
    "wp-site",
  );
});

Deno.test("handler: missing wp-site header returns 400", async () => {
  const res = handle(
    buildRequest({
      operationName: "HomePageQuery",
      variables: {},
      wpSite: null,
    }),
    { fixtures },
  );
  assertEquals(res.status, 400);
  assertStringIncludes(await res.text(), "wp-site");
});

Deno.test("handler: non-GET methods (POST/PUT/DELETE/PATCH) return 405", () => {
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    const res = handle(
      buildRequest({ method, operationName: "HomePageQuery", variables: {} }),
      { fixtures },
    );
    assertEquals(
      res.status,
      405,
      `expected 405 for ${method}, got ${res.status}`,
    );
  }
});

Deno.test("handler: OPTIONS returns 204 with CORS headers (preflight support)", () => {
  const res = handle(buildRequest({ method: "OPTIONS" }), { fixtures });
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  assertStringIncludes(
    res.headers.get("access-control-allow-headers") ?? "",
    "wp-site",
  );
});

Deno.test("handler: non-/graphql path returns 404", () => {
  const res = handle(
    buildRequest({
      path: "/something-else",
      operationName: "HomePageQuery",
      variables: {},
    }),
    { fixtures },
  );
  assertEquals(res.status, 404);
});

Deno.test("handler: missing operationName returns 400", async () => {
  const res = handle(buildRequest({ variables: {} }), { fixtures });
  assertEquals(res.status, 400);
  assertStringIncludes(await res.text(), "operationName");
});

Deno.test("handler: invalid variables JSON returns 400", async () => {
  const res = handle(
    buildRequest({ operationName: "HomePageQuery", variables: "not-json{" }),
    { fixtures },
  );
  assertEquals(res.status, 400);
  assertStringIncludes((await res.text()).toLowerCase(), "variables");
});

Deno.test("handler: unknown operationName returns 404", async () => {
  const res = handle(
    buildRequest({ operationName: "TotallyMadeUpQuery", variables: {} }),
    { fixtures },
  );
  assertEquals(res.status, 404);
  assertStringIncludes(await res.text(), "TotallyMadeUpQuery");
});

Deno.test("handler: variant routing — same op, different vars, different fixtures", async () => {
  const res0 = handle(
    buildRequest({
      operationName: "ArchipelagoAjeSectionPostsQuery",
      variables: { category: "middle-east", offset: 0 },
    }),
    { fixtures },
  );
  const res9 = handle(
    buildRequest({
      operationName: "ArchipelagoAjeSectionPostsQuery",
      variables: { category: "middle-east", offset: 9 },
    }),
    { fixtures },
  );
  assertEquals(res0.status, 200);
  assertEquals(res9.status, 200);
  const body0 = await res0.json();
  const body9 = await res9.json();
  assertEquals(body0.data.posts, ["a", "b"]);
  assertEquals(body9.data.posts, ["c", "d"]);
});

Deno.test("handler: variant rule with missing required vars returns 400 (MissingVariableError → 400)", async () => {
  const res = handle(
    buildRequest({
      operationName: "ArchipelagoAjeSectionPostsQuery",
      variables: {},
    }),
    { fixtures },
  );
  assertEquals(res.status, 400);
  assertStringIncludes((await res.text()).toLowerCase(), "variables");
});

Deno.test("handler: variants param is optional (defaults to {})", () => {
  // HomePageQuery has no variant rule, so empty/missing variables is valid
  const res = handle(buildRequest({ operationName: "HomePageQuery" }), {
    fixtures,
  });
  assertEquals(res.status, 200);
});

Deno.test("handler: GET /wp-content/uploads/<any path> returns 200 image/png placeholder", async () => {
  // Fixture image URLs in HomePageQuery point at /wp-content/uploads/<year>/<month>/<filename>.
  // The path is served by the same origin as the page, so it lands here. Returning a
  // valid placeholder lets perf-harness measure honest LCP instead of a 404 artifact.
  const req = new Request(
    "http://localhost:4455/wp-content/uploads/2026/04/anything-goes.jpg",
    { method: "GET" },
  );
  const res = handle(req, { fixtures });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "image/png");
  const bytes = new Uint8Array(await res.arrayBuffer());
  // PNG magic: 89 50 4E 47 0D 0A 1A 0A
  assertEquals(bytes[0], 0x89);
  assertEquals(bytes[1], 0x50);
  assertEquals(bytes[2], 0x4e);
  assertEquals(bytes[3], 0x47);
});

Deno.test("handler: /wp-content/uploads/*?w=W&resize=W,H returns image/svg+xml at requested dimensions", async () => {
  // Production WordPress backend honors ?w=&resize= for server-side cropping.
  // We mirror that here so the perf-harness sees real pixel dimensions and
  // M11's switch to live aljazeera.com behaves the same as dev.
  const req = new Request(
    "http://localhost:4455/wp-content/uploads/2026/04/foo.jpg?w=400&resize=400%2C267",
    { method: "GET" },
  );
  const res = handle(req, { fixtures });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "image/svg+xml");
  const body = await res.text();
  assertStringIncludes(body, 'width="400"');
  assertStringIncludes(body, 'height="267"');
});

Deno.test("handler: /wp-content/uploads/*?w=W (no resize) returns square SVG", async () => {
  const req = new Request(
    "http://localhost:4455/wp-content/uploads/foo.jpg?w=300",
    { method: "GET" },
  );
  const res = handle(req, { fixtures });
  assertEquals(res.headers.get("content-type"), "image/svg+xml");
  const body = await res.text();
  assertStringIncludes(body, 'width="300"');
  assertStringIncludes(body, 'height="300"');
});

Deno.test("handler: /wp-content/uploads/* with malformed w= falls through to PNG", () => {
  // Defensive: a typo or attacker-supplied bogus value shouldn't 500.
  const req = new Request(
    "http://localhost:4455/wp-content/uploads/foo.jpg?w=not-a-number",
    { method: "GET" },
  );
  const res = handle(req, { fixtures });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "image/png");
});

Deno.test("handler: /wp-content/uploads/* with malformed resize= falls through to PNG (no silent square)", () => {
  // If resize is provided but unparseable, fall through to PNG instead of
  // silently downgrading to a square SVG — the caller asked for a specific
  // aspect; honest move is "we couldn't honor that" rather than "here's a
  // shape you didn't ask for."
  const req = new Request(
    "http://localhost:4455/wp-content/uploads/foo.jpg?w=400&resize=abc%2Cdef",
    { method: "GET" },
  );
  const res = handle(req, { fixtures });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "image/png");
});

Deno.test("handler: /wp-content/uploads/* placeholder does NOT require wp-site header", () => {
  // Image fetches from the browser don't carry the wp-site header.
  const req = new Request(
    "http://localhost:4455/wp-content/uploads/whatever.jpg",
    { method: "GET" },
  );
  const res = handle(req, { fixtures });
  assertEquals(res.status, 200);
});

Deno.test("handler: ArchipelagoSingleArticleQuery resolves all on-disk slug variants (M7 embed coverage)", async () => {
  // M7 acceptance: "all embed types display" requires 4 distinct article fixtures
  // (existing Brightcove + Tweet + Instagram + Gallery). Asserts both that the
  // 4 fixture files exist on disk AND that the handler routes each slug to its
  // matching variant body. RED until story-001 step 3 records the new fixtures.
  //
  // The exact-count assertion is intentional, not lazy: this is an acceptance
  // trace for M7, so adding a 5th article fixture should be a deliberate act
  // that updates this test (and ideally adds a per-embed-type render assertion
  // elsewhere). If that pressure feels wrong, fix M7 acceptance first, not this
  // test.
  const realFixtures = await loadFixtures("./fixtures");
  const articleKeys = [...realFixtures.keys()].filter((k) =>
    k.startsWith("ArchipelagoSingleArticleQuery--")
  );
  assertEquals(
    articleKeys.length,
    4,
    `expected 4 ArchipelagoSingleArticleQuery--*.json fixtures, found ${articleKeys.length}: ${
      articleKeys.join(", ")
    }`,
  );

  // Each fixture key has the form ArchipelagoSingleArticleQuery--<slug>;
  // the handler resolves by looking up the same key from variables.name → slugify().
  // Asserting handle() returns 200 + article body for each key proves the round-trip.
  const seenBodies = new Set<string>();
  for (const key of articleKeys) {
    const slug = key.slice("ArchipelagoSingleArticleQuery--".length);
    const res = handle(
      buildRequest({
        operationName: "ArchipelagoSingleArticleQuery",
        variables: { name: slug, postType: "post", preview: "" },
      }),
      { fixtures: realFixtures },
    );
    assertEquals(res.status, 200, `slug ${slug} did not resolve`);
    const body = await res.text();
    assert(
      !seenBodies.has(body),
      `slug ${slug} returned a duplicate body — variants must be distinct`,
    );
    seenBodies.add(body);
  }
});
