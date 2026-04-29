import { assertEquals, assertThrows } from "@std/assert";
import { MissingVariableError, resolveFixtureKey } from "../lib/variants.ts";

// E2E coverage (variants exercised through the server's handler chain) lives
// in tests/server_test.ts: "variant routing serves different fixtures...".

Deno.test("resolveFixtureKey: operations without variant rules return plain operationName", () => {
  assertEquals(resolveFixtureKey("HomePageQuery", {}), "HomePageQuery");
  assertEquals(
    resolveFixtureKey("HomePageCuratedFeedQuery", {}),
    "HomePageCuratedFeedQuery",
  );
});

Deno.test("resolveFixtureKey: ArchipelagoSingleArticleQuery uses variables.name", () => {
  assertEquals(
    resolveFixtureKey("ArchipelagoSingleArticleQuery", {
      name: "some-headline",
    }),
    "ArchipelagoSingleArticleQuery--some-headline",
  );
});

Deno.test("resolveFixtureKey: ArchipelagoSingleLiveBlogQuery uses variables.name", () => {
  assertEquals(
    resolveFixtureKey("ArchipelagoSingleLiveBlogQuery", {
      name: "live-update",
    }),
    "ArchipelagoSingleLiveBlogQuery--live-update",
  );
});

Deno.test("resolveFixtureKey: SingleLiveBlogChildrensQuery uses variables.postName", () => {
  assertEquals(
    resolveFixtureKey("SingleLiveBlogChildrensQuery", {
      postName: "live-update",
    }),
    "SingleLiveBlogChildrensQuery--live-update",
  );
});

Deno.test("resolveFixtureKey: LiveBlogUpdateQuery uses variables.postID (int)", () => {
  assertEquals(
    resolveFixtureKey("LiveBlogUpdateQuery", {
      postID: 4512107,
      postType: "post",
    }),
    "LiveBlogUpdateQuery--4512107",
  );
});

Deno.test("resolveFixtureKey: ArchipelagoSectionQuery uses variables.name", () => {
  assertEquals(
    resolveFixtureKey("ArchipelagoSectionQuery", { name: "middle-east" }),
    "ArchipelagoSectionQuery--middle-east",
  );
});

Deno.test("resolveFixtureKey: ArchipelagoAjeSectionPostsQuery uses category + offset", () => {
  assertEquals(
    resolveFixtureKey("ArchipelagoAjeSectionPostsQuery", {
      category: "middle-east",
      offset: 0,
    }),
    "ArchipelagoAjeSectionPostsQuery--middle-east--offset-0",
  );
  assertEquals(
    resolveFixtureKey("ArchipelagoAjeSectionPostsQuery", {
      category: "middle-east",
      offset: 9,
    }),
    "ArchipelagoAjeSectionPostsQuery--middle-east--offset-9",
  );
});

Deno.test("resolveFixtureKey: ArchipelagoTopicsPageQuery uses variables.slug", () => {
  assertEquals(
    resolveFixtureKey("ArchipelagoTopicsPageQuery", { slug: "opinion" }),
    "ArchipelagoTopicsPageQuery--opinion",
  );
});

Deno.test("resolveFixtureKey: ArchipelagoPaginatedTopicsFeedQuery uses slug + offset", () => {
  assertEquals(
    resolveFixtureKey("ArchipelagoPaginatedTopicsFeedQuery", {
      slug: "opinion",
      offset: 0,
    }),
    "ArchipelagoPaginatedTopicsFeedQuery--opinion--offset-0",
  );
});

Deno.test("resolveFixtureKey: variant rule with missing required variable throws MissingVariableError", () => {
  assertThrows(
    () => resolveFixtureKey("ArchipelagoSingleArticleQuery", {}),
    MissingVariableError,
  );
  assertThrows(
    () =>
      resolveFixtureKey("ArchipelagoAjeSectionPostsQuery", {
        category: "middle-east",
      }),
    MissingVariableError,
  );
});

Deno.test("resolveFixtureKey: variant rule with wrongly-typed required variable throws", () => {
  // offset must be a number; null/string should not silently fall back
  assertThrows(
    () =>
      resolveFixtureKey("ArchipelagoAjeSectionPostsQuery", {
        category: "middle-east",
        offset: null,
      }),
    MissingVariableError,
  );
  assertThrows(
    () =>
      resolveFixtureKey("ArchipelagoPaginatedTopicsFeedQuery", {
        slug: "opinion",
        offset: "0",
      }),
    MissingVariableError,
  );
});

Deno.test("resolveFixtureKey: unknown operation with non-empty variables returns plain operationName", () => {
  assertEquals(
    resolveFixtureKey("SomeUnknownQuery", { foo: 1, bar: "baz" }),
    "SomeUnknownQuery",
  );
});

Deno.test("resolveFixtureKey: slugifies values containing slashes (article slug with date prefix)", () => {
  assertEquals(
    resolveFixtureKey("ArchipelagoSingleArticleQuery", {
      name: "2026/4/21/foo",
    }),
    "ArchipelagoSingleArticleQuery--2026-4-21-foo",
  );
});

Deno.test("resolveFixtureKey: slugifies values with spaces and uppercase", () => {
  assertEquals(
    resolveFixtureKey("ArchipelagoSectionQuery", { name: "Middle East" }),
    "ArchipelagoSectionQuery--middle-east",
  );
});

Deno.test("resolveFixtureKey: strips leading/trailing dashes after slugify", () => {
  assertEquals(
    resolveFixtureKey("ArchipelagoSingleArticleQuery", { name: "/foo/bar/" }),
    "ArchipelagoSingleArticleQuery--foo-bar",
  );
});

Deno.test("resolveFixtureKey: deps + ArchipelagoSingleLiveBlogQuery appends --snapshot-N when fixtures are present", () => {
  const present = new Set([
    "ArchipelagoSingleLiveBlogQuery--foo--snapshot-0",
    "ArchipelagoSingleLiveBlogQuery--foo--snapshot-1",
    "ArchipelagoSingleLiveBlogQuery--foo--snapshot-2",
  ]);
  const key = resolveFixtureKey(
    "ArchipelagoSingleLiveBlogQuery",
    { name: "foo" },
    {
      hasFixture: (k) => present.has(k),
      snapshotIndex: (maxN) => {
        // Verify deps received the actual variant count (3).
        if (maxN !== 3) throw new Error(`expected maxN=3, got ${maxN}`);
        return 1;
      },
    },
  );
  assertEquals(key, "ArchipelagoSingleLiveBlogQuery--foo--snapshot-1");
});

Deno.test("resolveFixtureKey: deps + live-blog op falls back to bare key when no --snapshot-N variants exist", () => {
  const key = resolveFixtureKey(
    "ArchipelagoSingleLiveBlogQuery",
    { name: "foo" },
    {
      hasFixture: () => false,
      snapshotIndex: () => {
        throw new Error("snapshotIndex must not be called when maxN=0");
      },
    },
  );
  assertEquals(key, "ArchipelagoSingleLiveBlogQuery--foo");
});

Deno.test("resolveFixtureKey: deps + ArchipelagoBreakingTickerQuery (variableless) appends --snapshot-N when fixtures are present", () => {
  const present = new Set([
    "ArchipelagoBreakingTickerQuery--snapshot-0",
    "ArchipelagoBreakingTickerQuery--snapshot-1",
    "ArchipelagoBreakingTickerQuery--snapshot-2",
  ]);
  const key = resolveFixtureKey(
    "ArchipelagoBreakingTickerQuery",
    {},
    {
      hasFixture: (k) => present.has(k),
      snapshotIndex: (maxN) => {
        if (maxN !== 3) throw new Error(`expected maxN=3, got ${maxN}`);
        return 2;
      },
    },
  );
  assertEquals(key, "ArchipelagoBreakingTickerQuery--snapshot-2");
});

Deno.test("resolveFixtureKey: deps + ticker falls back to bare operationName when no --snapshot-N variants exist", () => {
  const key = resolveFixtureKey(
    "ArchipelagoBreakingTickerQuery",
    {},
    {
      hasFixture: () => false,
      snapshotIndex: () => {
        throw new Error("snapshotIndex must not be called when maxN=0");
      },
    },
  );
  assertEquals(key, "ArchipelagoBreakingTickerQuery");
});

Deno.test("resolveFixtureKey: deps + non-snapshotted op (HomePageQuery) bypasses snapshot resolution", () => {
  const key = resolveFixtureKey(
    "HomePageQuery",
    {},
    {
      hasFixture: () => {
        throw new Error(
          "hasFixture must not be called for non-snapshotted ops",
        );
      },
      snapshotIndex: () => {
        throw new Error(
          "snapshotIndex must not be called for non-snapshotted ops",
        );
      },
    },
  );
  assertEquals(key, "HomePageQuery");
});
