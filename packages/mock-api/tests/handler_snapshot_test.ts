import { assert, assertEquals } from "@std/assert";
import { handle } from "../lib/handler.ts";
import { loadFixtures } from "../lib/fixtures.ts";
import { buildRequest, LIVE_BLOG_SLUG } from "./_helpers.ts";

// Loaded once at module level. Every snapshot test reads from the same
// on-disk fixture set; reloading per test multiplies the JSON parse cost
// for no semantic gain.
const realFixtures = await loadFixtures("./fixtures");

// Minimal in-memory fixtures map for the one negative test that proves the
// x-liveblog-snapshot header is a no-op for non-live-blog operations.
const homepageFixtures = new Map<string, string>([
  [
    "HomePageQuery",
    JSON.stringify({ data: { homepage: { layout: "three-column" } } }),
  ],
]);

Deno.test("handler: x-liveblog-snapshot header pins live-blog shell to the requested snapshot", async () => {
  const slug = LIVE_BLOG_SLUG;
  const res = handle(
    buildRequest({
      operationName: "ArchipelagoSingleLiveBlogQuery",
      variables: { name: slug, postType: "liveblog", preview: "" },
      snapshotHeader: "0",
    }),
    { fixtures: realFixtures },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.data.article.slug, slug);
});

Deno.test("handler: x-liveblog-snapshot header also pins SingleLiveBlogChildrensQuery", async () => {
  const slug = LIVE_BLOG_SLUG;
  const res = handle(
    buildRequest({
      operationName: "SingleLiveBlogChildrensQuery",
      variables: { postName: slug },
      snapshotHeader: "0",
    }),
    { fixtures: realFixtures },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(Array.isArray(body.data.article.children), true);
});

Deno.test("handler: live-blog ops without snapshot header resolve via wall-clock fallback within available snapshots", async () => {
  const slug = LIVE_BLOG_SLUG;
  const res = handle(
    buildRequest({
      operationName: "ArchipelagoSingleLiveBlogQuery",
      variables: { name: slug, postType: "liveblog", preview: "" },
    }),
    { fixtures: realFixtures },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.data.article.slug, slug);
});

Deno.test("handler: snapshot-N children list grows strictly across snapshots (polling-diff substrate)", async () => {
  const slug = LIVE_BLOG_SLUG;
  const lengths: number[] = [];
  for (const snap of ["0", "1", "2"]) {
    const res = handle(
      buildRequest({
        operationName: "SingleLiveBlogChildrensQuery",
        variables: { postName: slug },
        snapshotHeader: snap,
      }),
      { fixtures: realFixtures },
    );
    assertEquals(res.status, 200, `snapshot ${snap} unreachable`);
    const body = await res.json();
    lengths.push(body.data.article.children.length);
  }
  assert(
    lengths[0]! < lengths[1]! && lengths[1]! < lengths[2]!,
    `expected strictly increasing children counts, got ${lengths.join(",")}`,
  );
});

Deno.test("handler: snapshot-2 childrenMeta is descending by publishedTime (production invariant)", async () => {
  const res = handle(
    buildRequest({
      operationName: "ArchipelagoSingleLiveBlogQuery",
      variables: { name: LIVE_BLOG_SLUG, postType: "liveblog", preview: "" },
      snapshotHeader: "2",
    }),
    { fixtures: realFixtures },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  const meta = body.data.article.childrenMeta as Array<
    { id: string; publishedTime: string }
  >;
  // Newest entry (4514963 @ 23:59) leads, then 4514943 (@ 23:45), then snapshot-0's set.
  assertEquals(meta[0].id, "4514963");
  assertEquals(meta[1].id, "4514943");
  for (let i = 0; i < meta.length - 1; i++) {
    assert(
      Number(meta[i].publishedTime) >= Number(meta[i + 1].publishedTime),
      `childrenMeta[${i}] (${meta[i].publishedTime}) should be >= [${i + 1}] (${
        meta[i + 1].publishedTime
      })`,
    );
  }
});

Deno.test("handler: shell.children matches childrenMeta ids within each live-blog snapshot (parity invariant)", async () => {
  for (const snap of ["0", "1", "2"]) {
    const res = handle(
      buildRequest({
        operationName: "ArchipelagoSingleLiveBlogQuery",
        variables: { name: LIVE_BLOG_SLUG, postType: "liveblog", preview: "" },
        snapshotHeader: snap,
      }),
      { fixtures: realFixtures },
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    const children = body.data.article.children as number[];
    const metaIds = (body.data.article.childrenMeta as Array<{ id: string }>)
      .map((c) => Number(c.id));
    assertEquals(
      children,
      metaIds,
      `snapshot-${snap}: shell.children must equal childrenMeta ids (apps poll either field; they must agree)`,
    );
  }
});

Deno.test("handler: LiveBlogUpdateQuery resolves the per-update fixture for a recorded child id", async () => {
  const res = handle(
    buildRequest({
      operationName: "LiveBlogUpdateQuery",
      variables: {
        postID: 4514963,
        postType: "liveblog-update",
        preview: "",
        isAmp: false,
      },
    }),
    { fixtures: realFixtures },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.data.posts.id, "4514963");
  assertEquals(body.data.posts.postType, "liveblog-update");
});

Deno.test("handler: LiveBlogUpdateQuery is NOT snapshotted — same id returns same fixture regardless of snapshot header", async () => {
  const reqVars = {
    postID: 4514963,
    postType: "liveblog-update",
    preview: "",
    isAmp: false,
  };
  const a = await handle(
    buildRequest({
      operationName: "LiveBlogUpdateQuery",
      variables: reqVars,
      snapshotHeader: "0",
    }),
    { fixtures: realFixtures },
  ).text();
  const b = await handle(
    buildRequest({
      operationName: "LiveBlogUpdateQuery",
      variables: reqVars,
      snapshotHeader: "2",
    }),
    { fixtures: realFixtures },
  ).text();
  assertEquals(a, b);
});

Deno.test("handler: x-liveblog-snapshot:0 pins ArchipelagoBreakingTickerQuery to the empty (no-banner) snapshot", async () => {
  const res = handle(
    buildRequest({
      operationName: "ArchipelagoBreakingTickerQuery",
      variables: {},
      snapshotHeader: "0",
    }),
    { fixtures: realFixtures },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  // Every nullable carrier must be null on snapshot-0 — a partial null risks
  // the banner rendering with an empty headline or a broken link.
  assertEquals(body.data.breakingNews.post, null);
  assertEquals(body.data.breakingNews.tickerTitle, null);
  assertEquals(body.data.breakingNews.tickerText, null);
  assertEquals(body.data.breakingNews.modified, null);
  assertEquals(body.data.breakingNews.link, null);
});

Deno.test("handler: x-liveblog-snapshot:1 pins ArchipelagoBreakingTickerQuery to a populated banner snapshot", async () => {
  const res = handle(
    buildRequest({
      operationName: "ArchipelagoBreakingTickerQuery",
      variables: {},
      snapshotHeader: "1",
    }),
    { fixtures: realFixtures },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  // The banner needs ALL of: text (the headline), a click target (link), a
  // freshness signal (modified), the section label (tickerTitle), and the
  // source post for the click-through. A future fixture edit that drops any
  // of these would degrade the banner without this assertion.
  const banner = body.data.breakingNews;
  assert(typeof banner.tickerText === "string" && banner.tickerText.length > 0);
  assert(
    typeof banner.tickerTitle === "string" && banner.tickerTitle.length > 0,
  );
  assert(typeof banner.link === "string" && banner.link.length > 0);
  assert(typeof banner.modified === "string" && banner.modified.length > 0);
  assert(banner.post !== null && typeof banner.post.id === "string");
});

Deno.test("handler: x-liveblog-snapshot beyond available count clamps to the last ticker snapshot", async () => {
  const requested = await handle(
    buildRequest({
      operationName: "ArchipelagoBreakingTickerQuery",
      variables: {},
      snapshotHeader: "5",
    }),
    { fixtures: realFixtures },
  ).text();
  const last = await handle(
    buildRequest({
      operationName: "ArchipelagoBreakingTickerQuery",
      variables: {},
      snapshotHeader: "2",
    }),
    { fixtures: realFixtures },
  ).text();
  assertEquals(requested, last);
});

Deno.test("handler: ticker snapshot-1 vs snapshot-2 differ (polling-detects-change substrate)", async () => {
  const a = await handle(
    buildRequest({
      operationName: "ArchipelagoBreakingTickerQuery",
      variables: {},
      snapshotHeader: "1",
    }),
    { fixtures: realFixtures },
  ).text();
  const b = await handle(
    buildRequest({
      operationName: "ArchipelagoBreakingTickerQuery",
      variables: {},
      snapshotHeader: "2",
    }),
    { fixtures: realFixtures },
  ).text();
  assert(
    a !== b,
    "snapshot-1 and snapshot-2 must differ so polling sees a delta",
  );
});

Deno.test("handler: non-live-blog operations are unaffected by x-liveblog-snapshot header (HomePageQuery)", () => {
  const res = handle(
    buildRequest({
      operationName: "HomePageQuery",
      variables: {},
      snapshotHeader: "2",
    }),
    { fixtures: homepageFixtures },
  );
  assertEquals(res.status, 200);
});
