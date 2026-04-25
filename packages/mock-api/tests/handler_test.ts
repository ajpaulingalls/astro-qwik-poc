import { assertEquals, assertStringIncludes } from "@std/assert";
import { handle } from "../lib/handler.ts";

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

Deno.test("handler: /wp-content/uploads/* placeholder does NOT require wp-site header", () => {
  // Image fetches from the browser don't carry the wp-site header.
  const req = new Request(
    "http://localhost:4455/wp-content/uploads/whatever.jpg",
    { method: "GET" },
  );
  const res = handle(req, { fixtures });
  assertEquals(res.status, 200);
});
