import { assertEquals, assertThrows } from "jsr:@std/assert@^1";
import { MissingVariableError, resolveFixtureKey } from "../lib/variants.ts";

Deno.test("resolveFixtureKey: operations without variant rules return plain operationName", () => {
  assertEquals(resolveFixtureKey("HomePageQuery", {}), "HomePageQuery");
  assertEquals(resolveFixtureKey("HomePageCuratedFeedQuery", {}), "HomePageCuratedFeedQuery");
  assertEquals(resolveFixtureKey("ArchipelagoBreakingTickerQuery", {}), "ArchipelagoBreakingTickerQuery");
});

Deno.test("resolveFixtureKey: ArchipelagoSingleArticleQuery uses variables.name", () => {
  assertEquals(
    resolveFixtureKey("ArchipelagoSingleArticleQuery", { name: "some-headline" }),
    "ArchipelagoSingleArticleQuery--some-headline",
  );
});

Deno.test("resolveFixtureKey: ArchipelagoSingleLiveBlogQuery uses variables.name", () => {
  assertEquals(
    resolveFixtureKey("ArchipelagoSingleLiveBlogQuery", { name: "live-update" }),
    "ArchipelagoSingleLiveBlogQuery--live-update",
  );
});

Deno.test("resolveFixtureKey: SingleLiveBlogChildrensQuery uses variables.postName", () => {
  assertEquals(
    resolveFixtureKey("SingleLiveBlogChildrensQuery", { postName: "live-update" }),
    "SingleLiveBlogChildrensQuery--live-update",
  );
});

Deno.test("resolveFixtureKey: LiveBlogUpdateQuery uses variables.uri", () => {
  assertEquals(
    resolveFixtureKey("LiveBlogUpdateQuery", { uri: "/news/2026/4/21/some-update" }),
    "LiveBlogUpdateQuery--news-2026-4-21-some-update",
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
    resolveFixtureKey("ArchipelagoAjeSectionPostsQuery", { category: "middle-east", offset: 0 }),
    "ArchipelagoAjeSectionPostsQuery--middle-east--offset-0",
  );
  assertEquals(
    resolveFixtureKey("ArchipelagoAjeSectionPostsQuery", { category: "middle-east", offset: 9 }),
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
    resolveFixtureKey("ArchipelagoPaginatedTopicsFeedQuery", { slug: "opinion", offset: 0 }),
    "ArchipelagoPaginatedTopicsFeedQuery--opinion--offset-0",
  );
});

Deno.test("resolveFixtureKey: variant rule with missing required variable throws MissingVariableError", () => {
  assertThrows(
    () => resolveFixtureKey("ArchipelagoSingleArticleQuery", {}),
    MissingVariableError,
  );
  assertThrows(
    () => resolveFixtureKey("ArchipelagoAjeSectionPostsQuery", { category: "middle-east" }),
    MissingVariableError,
  );
});

Deno.test("resolveFixtureKey: variant rule with wrongly-typed required variable throws", () => {
  // offset must be a number; null/string should not silently fall back
  assertThrows(
    () => resolveFixtureKey("ArchipelagoAjeSectionPostsQuery", { category: "middle-east", offset: null }),
    MissingVariableError,
  );
  assertThrows(
    () => resolveFixtureKey("ArchipelagoPaginatedTopicsFeedQuery", { slug: "opinion", offset: "0" }),
    MissingVariableError,
  );
});

Deno.test("resolveFixtureKey: unknown operation with non-empty variables returns plain operationName", () => {
  assertEquals(resolveFixtureKey("SomeUnknownQuery", { foo: 1, bar: "baz" }), "SomeUnknownQuery");
});

Deno.test("resolveFixtureKey: slugifies values containing slashes (article slug with date prefix)", () => {
  assertEquals(
    resolveFixtureKey("ArchipelagoSingleArticleQuery", { name: "2026/4/21/foo" }),
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
    resolveFixtureKey("LiveBlogUpdateQuery", { uri: "/foo/bar/" }),
    "LiveBlogUpdateQuery--foo-bar",
  );
});
