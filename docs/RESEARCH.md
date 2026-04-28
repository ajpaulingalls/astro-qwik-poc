# Production Research Findings

> All findings below were verified against live production network traffic from
> aljazeera.com in April 2026.

## GraphQL API Overview

### Request Pattern

The production API uses a **GET-based whitelist pattern**:

```
GET /graphql?wp-site=aje&operationName={name}&variables={json}&extensions={}
```

Key details:

- **Method:** GET only (not POST)
- **`wp-site` header:** Required on every request — `aje` for English, `aja` for
  Arabic
- **Operation IDs:** Each query has a numeric ID (1–101) in the internal query
  map; the API resolves by `operationName`
- **Variables:** URL-encoded JSON in the `variables` query parameter

### Arabic Site

The Arabic site (`aljazeera.net`) uses the **same GraphQL endpoint and queries**
with only the `wp-site` header changed to `aja`. Minor response differences
exist but can be ignored for the PoC.

---

## Verified Queries by Page

### Homepage

| Query                                    | Variables                                              | Purpose                                                                 |
| ---------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `HomePageQuery`                          | `{ isAtf: true, atfLength: 2, slug: "", preview: "" }` | Main homepage content — layout, featured posts, collections, livestream |
| `HomePageCuratedFeedQuery`               | `{ preview: "", slug: "" }`                            | Curated feed content                                                    |
| `ArchipelagoBreakingTickerQuery` (ID 18) | `{}`                                                   | Breaking news ticker — **polled on every page**                         |

**No infinite scroll.** All homepage content comes from the initial queries.

### Article Page

| Query                                    | Variables                                           | Purpose                               |
| ---------------------------------------- | --------------------------------------------------- | ------------------------------------- |
| `ArchipelagoSingleArticleQuery` (ID 68)  | `{ name: "{slug}", postType: "post", preview: "" }` | Full article content with rich fields |
| `HomePageCuratedFeedQuery`               | `{ preview: "", slug: "" }`                         | Related / more stories                |
| `ArchipelagoBreakingTickerQuery` (ID 18) | `{}`                                                | Breaking news ticker                  |

### Live Blog

| Query                                    | Variables                                                                   | Purpose                                                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ArchipelagoSingleLiveBlogQuery`         | `{ name: "{slug}", postType: "liveblog", preview: "" }`                     | Blog shell — metadata, header, initial content, plus `childrenMeta[]` listing each update's id + publishedTime. **postType MUST be "liveblog"** — `"post"` returns `no_posts_found`.            |
| `SingleLiveBlogChildrensQuery`           | `{ postName: "{slug}" }`                                                    | Child entry id list — bare numeric ids ordered newest-first, mirroring `childrenMeta`.                                                                                                          |
| `LiveBlogUpdateQuery`                    | `{ postID: <int>, postType: "liveblog-update", preview: "", isAmp: false }` | Individual update content (title, HTML body, author, date). **`postType` must be `"liveblog-update"`** (hyphenated); omitting `preview`/`isAmp` or using `"liveblog"` returns `no_posts_found`. |
| `ArchipelagoBreakingTickerQuery` (ID 18) | `{}`                                                                        | Breaking news ticker                                                                                                                                                                            |

#### Polling decision

Three-query design from the M9 spec. 30s cadence is the M9 spec target — each
query was verified individually with `curl`, no browser-session capture of
production polling.

1. **`ArchipelagoSingleLiveBlogQuery`** — re-fetched every 30s.
2. **`SingleLiveBlogChildrensQuery`** — fetched once at SSR; the shell's
   `childrenMeta` is the source of truth for "new updates" diffing thereafter.
3. **`LiveBlogUpdateQuery`** — fetched once per newly-discovered child id in
   parallel after the diff identifies new ids.

PoC implementation requirement (not a production-observed behavior): each
prepended entry must reserve space (min-height / skeleton) so existing entries
below don't shift. This is the M9 acceptance gate for both apps.

#### Snapshot rotation in the mock-api

So polling sees real deltas, the mock-api serves different fixture snapshots
over time. Three precedence tiers, header > env > wall-clock:

| Tier        | Where                                                               | Use                                                       |
| ----------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| Per-request | `x-liveblog-snapshot: N` request header                             | Perf-harness pinning, deterministic acceptance tests      |
| Per-process | `LIVEBLOG_SNAPSHOT_INDEX=N` env                                     | Single-snapshot test runs                                 |
| Wall-clock  | auto-rotate every `LIVEBLOG_SNAPSHOT_INTERVAL_MS` (default 30000ms) | Dev/demo so live polling visibly advances without tooling |

`apps/{astro,qwik}/src/lib/graphql.ts:graphqlFetch` accepts an optional
`headers` field forwarded into the fetch request — the live-blog updater uses it
to send `x-liveblog-snapshot` from the browser.

### Section Front — Geographic (e.g., `/middle-east`)

| Query                                    | Variables                                                                     | Purpose                               |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------- |
| `ArchipelagoSectionQuery` (ID 64)        | `{ name: "{section}", categoryType: "where", postTypes: [...], quantity: 9 }` | Initial section content               |
| `ArchipelagoAjeSectionPostsQuery` (ID 7) | `{ category: "{section}", categoryType: "where", quantity: 9, offset: N }`    | Pagination — offset-based "Load More" |
| `HomePageCuratedFeedQuery`               | `{ preview: "", slug: "" }`                                                   | Curated feed                          |
| `ArchipelagoBreakingTickerQuery` (ID 18) | `{}`                                                                          | Breaking news ticker                  |

### Section Front — Topic (e.g., `/opinion`)

| Query                                    | Variables                                            | Purpose                               |
| ---------------------------------------- | ---------------------------------------------------- | ------------------------------------- |
| `ArchipelagoTopicsPageQuery` (ID 92)     | `{ slug: "opinion", postTypes: [...], preview: "" }` | Initial topic page content            |
| `ArchipelagoPaginatedTopicsFeedQuery`    | `{ slug: "opinion", quantity: 9, offset: N }`        | Pagination — offset-based "Load More" |
| `ArchipelagoBreakingTickerQuery` (ID 18) | `{}`                                                 | Breaking news ticker                  |

---

## Homepage Response Structure

The response lives under `data.homepage` and contains **21 fields** — all
content, **zero navigation**:

| Field                      | Type       | Detail                                                                                                                                                            |
| -------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`                   | `string`   | `"three-column"`                                                                                                                                                  |
| `livestream`               | `object`   | Keys: `accountId`, `title`, `playerID`, `videoID`, `bcPlaybackUrl`, `source`, `youtubeVideoID`, `youtubeChannelID`, `featuredImage`                               |
| `livestreamPosition`       | `string`   | `"1"`                                                                                                                                                             |
| `featuredMedia`            | `null`     | Not used currently                                                                                                                                                |
| `__typename`               | `string`   | `"HomepageAj"`                                                                                                                                                    |
| `featuredPosts`            | `list[17]` | Main hero/top stories                                                                                                                                             |
| `feedOrder`                | `list[2]`  | Controls module ordering                                                                                                                                          |
| `feedPost`                 | `list[1]`  | Feed content                                                                                                                                                      |
| `curatedCollection`        | `list[1]`  | Editorially curated block                                                                                                                                         |
| `automatedCollection`      | `list[0]`  | Empty (automated content)                                                                                                                                         |
| `automatedMultiCollection` | `list[0]`  | Empty                                                                                                                                                             |
| `brandedEventCollection`   | `null`     | Not used currently                                                                                                                                                |
| `opinion`                  | `null`     | Not used on homepage currently                                                                                                                                    |
| `mostPopular`              | `list[10]` | Most popular articles                                                                                                                                             |
| `trendingVideos`           | `list[0]`  | Empty currently                                                                                                                                                   |
| `videoBlockPlaylist`       | `object`   | Keys: `posts`                                                                                                                                                     |
| `layoutMetaData`           | `object`   | Keys: `topStories`, `secondStories`, `categoryColumn`, `liveblogConfig`, `topStoryTheme`, `displaySecondColFirstStoryLiveblogUpdates`, `firstStoryRelatedStories` |
| `seoDescription`           | `string`   | Empty                                                                                                                                                             |
| `customSeoMeta`            | `object`   | Keys: `customTitle`, `customHeading`, `canonicalUrl`, `socialImg`                                                                                                 |
| `verticalVideos`           | `list[10]` | Short-form vertical video carousel                                                                                                                                |
| `additionalPageEmbeds`     | `object`   | Keys: `allowEmbeds`, `aboveFeaturedArea`, `belowFeaturedArea`, `aboveFeaturedAreaForMobile`, `belowFeaturedAreaForMobile`, `inSidebar`                            |

---

## Navigation

**Finding: Navigation is hardcoded in the frontend bundle.**

Evidence:

- The `data.homepage` response contains **zero navigation fields** — all 21 keys
  are content-related
- The `cmsArcSettings` query (ID 21) is **never called** on any production page
  — not on homepage, article, section, or live blog pages
- No other GraphQL query returns navigation or menu data

**PoC approach:** Hardcode the navigation. The nav structure changes very rarely
and doesn't need to be dynamic for a framework comparison.

---

## Pagination

**Pattern: Client-side "Load More" with offset-based queries.**

- No server-side `?page=N` pagination
- No infinite scroll
- Section front pages use a "Load More" button that triggers the next
  offset-based query:
  - Geographic: `ArchipelagoAjeSectionPostsQuery` with `offset: 0, 9, 18, ...`
  - Topic: `ArchipelagoPaginatedTopicsFeedQuery` with `offset: 0, 9, 18, ...`
- Homepage has **no pagination at all** — all content from initial queries

---

## Key Operation IDs (from Production Query Map)

| ID  | Operation Name                    | Notes                             |
| --- | --------------------------------- | --------------------------------- |
| 7   | `ArchipelagoAjeSectionPostsQuery` | Geographic section pagination     |
| 18  | `ArchipelagoBreakingTickerQuery`  | Breaking ticker — polled globally |
| 21  | `cmsArcSettings`                  | **Not called in production**      |
| 64  | `ArchipelagoSectionQuery`         | Geographic section initial load   |
| 68  | `ArchipelagoSingleArticleQuery`   | Full article content              |
| 92  | `ArchipelagoTopicsPageQuery`      | Topic section initial load        |

The full query map (101 operations) is available in `aje_query_map.json`.
