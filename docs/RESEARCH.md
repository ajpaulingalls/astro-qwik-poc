# Production Research Findings

> All findings below were verified against live production network traffic from aljazeera.com in April 2026.

## GraphQL API Overview

### Request Pattern

The production API uses a **GET-based whitelist pattern**:

```
GET /graphql?wp-site=aje&operationName={name}&variables={json}&extensions={}
```

Key details:
- **Method:** GET only (not POST)
- **`wp-site` header:** Required on every request — `aje` for English, `aja` for Arabic
- **Operation IDs:** Each query has a numeric ID (1–101) in the internal query map; the API resolves by `operationName`
- **Variables:** URL-encoded JSON in the `variables` query parameter

### Arabic Site

The Arabic site (`aljazeera.net`) uses the **same GraphQL endpoint and queries** with only the `wp-site` header changed to `aja`. Minor response differences exist but can be ignored for the PoC.

---

## Verified Queries by Page

### Homepage

| Query | Variables | Purpose |
|-------|-----------|---------|
| `HomePageQuery` | `{ isAtf: true, atfLength: 2, slug: "", preview: "" }` | Main homepage content — layout, featured posts, collections, livestream |
| `HomePageCuratedFeedQuery` | `{ preview: "", slug: "" }` | Curated feed content |
| `ArchipelagoBreakingTickerQuery` (ID 18) | `{}` | Breaking news ticker — **polled on every page** |

**No infinite scroll.** All homepage content comes from the initial queries.

### Article Page

| Query | Variables | Purpose |
|-------|-----------|---------|
| `ArchipelagoSingleArticleQuery` (ID 68) | `{ name: "{slug}", postType: "post", preview: "" }` | Full article content with rich fields |
| `HomePageCuratedFeedQuery` | `{ preview: "", slug: "" }` | Related / more stories |
| `ArchipelagoBreakingTickerQuery` (ID 18) | `{}` | Breaking news ticker |

### Live Blog

| Query | Variables | Purpose |
|-------|-----------|---------|
| `ArchipelagoSingleLiveBlogQuery` | `{ name: "{slug}", postType: "post", preview: "" }` | Blog shell — metadata, header, initial content |
| `SingleLiveBlogChildrensQuery` | `{ postName: "{slug}" }` | Child entries / updates list |
| `LiveBlogUpdateQuery` | `{ postID: <int>, postType: "post" }` | Individual update content (called N times). `SingleLiveBlogChildrensQuery` returns bare numeric post IDs. |
| `ArchipelagoBreakingTickerQuery` (ID 18) | `{}` | Breaking news ticker |

### Section Front — Geographic (e.g., `/middle-east`)

| Query | Variables | Purpose |
|-------|-----------|---------|
| `ArchipelagoSectionQuery` (ID 64) | `{ name: "{section}", categoryType: "where", postTypes: [...], quantity: 9 }` | Initial section content |
| `ArchipelagoAjeSectionPostsQuery` (ID 7) | `{ category: "{section}", categoryType: "where", quantity: 9, offset: N }` | Pagination — offset-based "Load More" |
| `HomePageCuratedFeedQuery` | `{ preview: "", slug: "" }` | Curated feed |
| `ArchipelagoBreakingTickerQuery` (ID 18) | `{}` | Breaking news ticker |

### Section Front — Topic (e.g., `/opinion`)

| Query | Variables | Purpose |
|-------|-----------|---------|
| `ArchipelagoTopicsPageQuery` (ID 92) | `{ slug: "opinion", postTypes: [...], preview: "" }` | Initial topic page content |
| `ArchipelagoPaginatedTopicsFeedQuery` | `{ slug: "opinion", quantity: 9, offset: N }` | Pagination — offset-based "Load More" |
| `ArchipelagoBreakingTickerQuery` (ID 18) | `{}` | Breaking news ticker |

---

## Homepage Response Structure

The response lives under `data.homepage` and contains **21 fields** — all content, **zero navigation**:

| Field | Type | Detail |
|-------|------|--------|
| `layout` | `string` | `"three-column"` |
| `livestream` | `object` | Keys: `accountId`, `title`, `playerID`, `videoID`, `bcPlaybackUrl`, `source`, `youtubeVideoID`, `youtubeChannelID`, `featuredImage` |
| `livestreamPosition` | `string` | `"1"` |
| `featuredMedia` | `null` | Not used currently |
| `__typename` | `string` | `"HomepageAj"` |
| `featuredPosts` | `list[17]` | Main hero/top stories |
| `feedOrder` | `list[2]` | Controls module ordering |
| `feedPost` | `list[1]` | Feed content |
| `curatedCollection` | `list[1]` | Editorially curated block |
| `automatedCollection` | `list[0]` | Empty (automated content) |
| `automatedMultiCollection` | `list[0]` | Empty |
| `brandedEventCollection` | `null` | Not used currently |
| `opinion` | `null` | Not used on homepage currently |
| `mostPopular` | `list[10]` | Most popular articles |
| `trendingVideos` | `list[0]` | Empty currently |
| `videoBlockPlaylist` | `object` | Keys: `posts` |
| `layoutMetaData` | `object` | Keys: `topStories`, `secondStories`, `categoryColumn`, `liveblogConfig`, `topStoryTheme`, `displaySecondColFirstStoryLiveblogUpdates`, `firstStoryRelatedStories` |
| `seoDescription` | `string` | Empty |
| `customSeoMeta` | `object` | Keys: `customTitle`, `customHeading`, `canonicalUrl`, `socialImg` |
| `verticalVideos` | `list[10]` | Short-form vertical video carousel |
| `additionalPageEmbeds` | `object` | Keys: `allowEmbeds`, `aboveFeaturedArea`, `belowFeaturedArea`, `aboveFeaturedAreaForMobile`, `belowFeaturedAreaForMobile`, `inSidebar` |

---

## Navigation

**Finding: Navigation is hardcoded in the frontend bundle.**

Evidence:
- The `data.homepage` response contains **zero navigation fields** — all 21 keys are content-related
- The `cmsArcSettings` query (ID 21) is **never called** on any production page — not on homepage, article, section, or live blog pages
- No other GraphQL query returns navigation or menu data

**PoC approach:** Hardcode the navigation. The nav structure changes very rarely and doesn't need to be dynamic for a framework comparison.

---

## Pagination

**Pattern: Client-side "Load More" with offset-based queries.**

- No server-side `?page=N` pagination
- No infinite scroll
- Section front pages use a "Load More" button that triggers the next offset-based query:
  - Geographic: `ArchipelagoAjeSectionPostsQuery` with `offset: 0, 9, 18, ...`
  - Topic: `ArchipelagoPaginatedTopicsFeedQuery` with `offset: 0, 9, 18, ...`
- Homepage has **no pagination at all** — all content from initial queries

---

## Key Operation IDs (from Production Query Map)

| ID | Operation Name | Notes |
|----|---------------|-------|
| 7 | `ArchipelagoAjeSectionPostsQuery` | Geographic section pagination |
| 18 | `ArchipelagoBreakingTickerQuery` | Breaking ticker — polled globally |
| 21 | `cmsArcSettings` | **Not called in production** |
| 64 | `ArchipelagoSectionQuery` | Geographic section initial load |
| 68 | `ArchipelagoSingleArticleQuery` | Full article content |
| 92 | `ArchipelagoTopicsPageQuery` | Topic section initial load |

The full query map (101 operations) is available in `aje_query_map.json`.
