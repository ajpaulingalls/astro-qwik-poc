# Fixture recording

`record-fixtures.sh` captures production GraphQL responses and writes them as
JSON fixtures for the mock server.

The mock-api server (`packages/mock-api/server.ts`) reads `fixtures/*.json` at
startup and validates each via `JSON.parse` (fail-loud on bad JSON). Fixture
filenames must match the keys produced by `lib/variants.ts:resolveFixtureKey` —
the recording script names files accordingly.

## Prerequisites

- `bash`
- `curl`
- `jq`
- Network access to `https://www.aljazeera.com`

## Running

The script needs operator-supplied slugs (production content rotates; pick
whatever's current):

```bash
# Pick one or more article slugs from the homepage's featuredPosts, e.g.:
#   curl -sH 'wp-site: aje' 'https://www.aljazeera.com/graphql?operationName=HomePageQuery&variables=%7B%7D' \
#     | jq -r '.data.homepage.featuredPosts[].slug'
# Multiple slugs (space-separated) record one fixture per slug — useful when
# you need variants exercising different embed types (Tweet, Brightcove video,
# image figure). Single-slug callers can keep using ARTICLE_SLUG.
ARTICLE_SLUGS="article-slug-with-tweet other-slug-with-brightcove"

# Pick a current live blog from a section page or the homepage. Live blog
# slugs are the WP post name (typically the URL's last segment).
LIVEBLOG_SLUG="some-current-liveblog-slug"

# Pick one update post ID from the live blog's children list. SingleLiveBlogChildrensQuery
# returns bare numeric IDs:
#   curl -sH 'wp-site: aje' "https://www.aljazeera.com/graphql?operationName=SingleLiveBlogChildrensQuery&variables=$(jq -rn --arg v "$(jq -nc --arg postName "$LIVEBLOG_SLUG" '{postName:$postName}')" '$v|@uri')&extensions=%7B%7D" \
#     | jq '.data.article.children[0]'
LIVEBLOG_UPDATE_POST_ID="4512107"

ARTICLE_SLUGS="$ARTICLE_SLUGS" \
LIVEBLOG_SLUG="$LIVEBLOG_SLUG" \
LIVEBLOG_UPDATE_POST_ID="$LIVEBLOG_UPDATE_POST_ID" \
  bash packages/mock-api/scripts/record-fixtures.sh
```

The script fails loud on missing slugs (so you can't accidentally record
placeholder fixtures). `ARTICLE_SLUGS` accepts whitespace-separated values and
produces one `ArchipelagoSingleArticleQuery--<slug>.json` fixture per slug.
`ARTICLE_SLUG` (singular, legacy) still works as a one-element fallback.

### Picking article slugs by embed type

Different M7 embed components need different fixture content. The fastest
discovery loop is the GraphQL endpoint itself — fetch one or more candidate
articles and grep `article.content` for the embed marker:

| Embed      | Marker in `article.content`                |
| ---------- | ------------------------------------------ |
| Brightcove | `video-js` or `brightcove`                 |
| Tweet      | `twitter-tweet` or `platform.twitter.com`  |
| YouTube    | `youtube.com/embed` or `youtu.be`          |
| Instagram  | `instagram-media` or `instagram.com/embed` |
| Gallery    | `wp-block-gallery` or `class="gallery`     |

Production scouting (sprint-007 story-001) found Brightcove video ubiquitous;
Tweet present in some news/opinion/features (postType-dependent); Instagram
embeds absent in current ArchipelagoSingleArticleQuery responses; gallery
articles use a _different_ operationName entirely (out of M7 scope). The 2
sample-* fixtures in `packages/mock-api/fixtures/` cover the gaps — see
`packages/mock-api/README.md §Synthetic vs recorded fixtures`.

## What gets captured

Fixtures cover all four production page types (per `docs/RESEARCH.md` §Verified
Queries by Page). The recorder writes a baseline set; live-blog and breaking-
ticker snapshot variants and additional per-update recordings are committed by
hand to drive the polling-rotation behaviour (see "Snapshot rotation" below).

| Scope                | Operations                                                                                                               | Fixtures                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| Homepage             | HomePageQuery, HomePageCuratedFeedQuery                                                                                  | 2                       |
| Article              | ArchipelagoSingleArticleQuery (N slug variants per ARTICLE_SLUGS)                                                        | N (recorded) + 2 sample |
| Live blog            | ArchipelagoSingleLiveBlogQuery, SingleLiveBlogChildrensQuery (snapshot-N variants), LiveBlogUpdateQuery (1 per child id) | 2×N + M                 |
| Section (geographic) | ArchipelagoSectionQuery (middle-east), ArchipelagoAjeSectionPostsQuery (offsets 0, 9, 18)                                | 4                       |
| Section (topic)      | ArchipelagoTopicsPageQuery (opinion), ArchipelagoPaginatedTopicsFeedQuery (offsets 0, 9, 18)                             | 4                       |
| Global (every page)  | ArchipelagoBreakingTickerQuery (snapshot-N variants — polled on every page)                                              | 3                       |

For live-blog rotation: N is the number of snapshot variants on disk (currently
3 for the iran-war slug), M is the number of distinct child posts covered by
`LiveBlogUpdateQuery--{postID}.json` fixtures. The ticker uses the same snapshot
machinery — its 3 variants rotate snapshot-0 (no banner) → snapshot-1 (active) →
snapshot-2 (different active text) so polling sees a delta.

Three pagination offsets (`0, 9, 18`) match the production "Load More" pattern
documented in SMM Constraints — enough to test multi-page Load More semantics in
M8.

Filenames follow `{operationName}.json` or
`{operationName}--{variant1}[--{variant2}].json`, matching the keys produced by
`lib/variants.ts:resolveFixtureKey`. Slug values are slugified to `[a-z0-9-]` to
keep filenames safe.

## Operation-specific recording notes

- **`LiveBlogUpdateQuery--{postID}.json`** — production resolves child entries
  only when `postType` is the hyphenated `"liveblog-update"` and the request
  carries `preview` and `isAmp`; sending bare `"liveblog"` yields
  `no_posts_found`. The recorder uses the verified shape; do not change it
  without re-probing aljazeera.com/graphql.

## Snapshot rotation

Live-blog shell + children fixtures and the breaking-news ticker fixture use a
`--snapshot-N.json` suffix so the mock-api can rotate through successive
snapshots and downstream apps observe a delta on each poll. The recorder always
writes `--snapshot-0` (the captured baseline).

For live-blog: subsequent snapshots are hand-crafted in-place — pick one or more
child ids from production whose `LiveBlogUpdateQuery` returns real content,
prepend their `id`/`publishedTime` entry to the shell `childrenMeta` and the
children list, and record one `LiveBlogUpdateQuery--{newChildID}.json` fixture
per added id. Maintain production's newest-first ordering across `childrenMeta`.

For the ticker: snapshot-0 is the empty (no-banner) production baseline;
snapshot-1 and snapshot-2 are hand-crafted populated banners with different
`tickerText` so the polling-detects-change browser test (M10 capstone) has a
non-trivial signal.

## Re-recording

The script is idempotent — re-running with the same slugs overwrites the
fixtures deterministically. Diff before committing:

```bash
git diff --stat packages/mock-api/fixtures/
```

Re-record before any demo or before `M11` (live-endpoint integration), since
live data drifts and the schema may evolve.

## Adding a new operation

1. Find or pick the operation's variant rule in
   `packages/mock-api/lib/variants.ts`. If new, add a rule with tests in
   `tests/variants_test.ts`.
2. Add a `record` line to `record-fixtures.sh` with the matching `operationName`
   and `variables` JSON.
3. Re-run the script. Confirm the new fixture is valid JSON and the server
   responds 200 for the operation.

## Scrubbing sensitive data

`record-fixtures.sh` defines a `scrub()` shell function that pipes the captured
response stdin → stdout. By default it's a no-op (`cat`) — Al Jazeera's GraphQL
data is public news content with no obvious sensitive fields.

If a future capture surfaces something sensitive (auth tokens, internal user
IDs, private tracking metadata), add `jq` filter steps inside `scrub()`.
Example:

```bash
scrub() {
  jq 'del(.. .someInternalTrackingId?, .. .privateUserId?)'
}
```

**Always diff captured fixtures before committing** — `git diff fixtures/` makes
new fields obvious.

## Environment variables

| Variable                  | Default                      | Purpose                                                                               |
| ------------------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| `WP_SITE`                 | `aje`                        | `wp-site` header value (`aje` English, `aja` Arabic)                                  |
| `OUT_DIR`                 | `packages/mock-api/fixtures` | Output directory                                                                      |
| `ARTICLE_SLUGS`           | (required)                   | Whitespace-separated article slugs — records one fixture per slug                     |
| `ARTICLE_SLUG`            | (legacy)                     | Single article slug; used as fallback when `ARTICLE_SLUGS` is unset (one-slug record) |
| `LIVEBLOG_SLUG`           | (required)                   | Slug for the live blog fixture                                                        |
| `LIVEBLOG_UPDATE_POST_ID` | (required)                   | Numeric WP post ID for one live blog update                                           |
