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

The script needs three operator-supplied slugs (production content rotates; pick
whatever's current):

```bash
# Pick a current article slug from the homepage's featuredPosts, e.g.:
#   curl -sH 'wp-site: aje' 'https://www.aljazeera.com/graphql?operationName=HomePageQuery&variables=%7B%7D' \
#     | jq -r '.data.homepage.featuredPosts[0].slug'
ARTICLE_SLUG="some-current-article-slug"

# Pick a current live blog from a section page or the homepage. Live blog
# slugs are the WP post name (typically the URL's last segment).
LIVEBLOG_SLUG="some-current-liveblog-slug"

# Pick one update post ID from the live blog's children list. SingleLiveBlogChildrensQuery
# returns bare numeric IDs:
#   curl -sH 'wp-site: aje' "https://www.aljazeera.com/graphql?operationName=SingleLiveBlogChildrensQuery&variables=$(jq -rn --arg v "$(jq -nc --arg postName "$LIVEBLOG_SLUG" '{postName:$postName}')" '$v|@uri')&extensions=%7B%7D" \
#     | jq '.data.article.children[0]'
LIVEBLOG_UPDATE_POST_ID="4512107"

ARTICLE_SLUG="$ARTICLE_SLUG" \
LIVEBLOG_SLUG="$LIVEBLOG_SLUG" \
LIVEBLOG_UPDATE_POST_ID="$LIVEBLOG_UPDATE_POST_ID" \
  bash packages/mock-api/scripts/record-fixtures.sh
```

The script fails loud on missing slugs (so you can't accidentally record
placeholder fixtures).

## What gets captured

15 fixtures covering all four production page types (per `docs/RESEARCH.md`
§Verified Queries by Page):

| Page type            | Operations                                                                                   | Fixtures |
| -------------------- | -------------------------------------------------------------------------------------------- | -------- |
| Homepage             | HomePageQuery, HomePageCuratedFeedQuery, ArchipelagoBreakingTickerQuery                      | 3        |
| Article              | ArchipelagoSingleArticleQuery (1 slug variant)                                               | 1        |
| Live blog            | ArchipelagoSingleLiveBlogQuery, SingleLiveBlogChildrensQuery, LiveBlogUpdateQuery (1 each)   | 3        |
| Section (geographic) | ArchipelagoSectionQuery (middle-east), ArchipelagoAjeSectionPostsQuery (offsets 0, 9, 18)    | 4        |
| Section (topic)      | ArchipelagoTopicsPageQuery (opinion), ArchipelagoPaginatedTopicsFeedQuery (offsets 0, 9, 18) | 4        |

Three pagination offsets (`0, 9, 18`) match the production "Load More" pattern
documented in SMM Constraints — enough to test multi-page Load More semantics in
M8.

Filenames follow `{operationName}.json` or
`{operationName}--{variant1}[--{variant2}].json`, matching the keys produced by
`lib/variants.ts:resolveFixtureKey`. Slug values are slugified to `[a-z0-9-]` to
keep filenames safe.

## Known fixture gaps (story-003b discoveries)

- **`LiveBlogUpdateQuery--{postID}.json`** captures the live API's
  `no_posts_found` response. The bare numeric IDs from
  `SingleLiveBlogChildrensQuery` are NOT addressable via `postByID`; live blog
  updates appear to be embedded in the parent shell rather than standalone
  posts. M7 implementation will resolve the actual update-fetch pattern
  (possibly via `LiveBlogSubscription($postID: Int!)` websocket, or by
  extracting from the shell content). The error fixture is honest representation
  of current API behavior.

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

| Variable                  | Default                      | Purpose                                              |
| ------------------------- | ---------------------------- | ---------------------------------------------------- |
| `WP_SITE`                 | `aje`                        | `wp-site` header value (`aje` English, `aja` Arabic) |
| `OUT_DIR`                 | `packages/mock-api/fixtures` | Output directory                                     |
| `ARTICLE_SLUG`            | (required)                   | Slug for the article fixture                         |
| `LIVEBLOG_SLUG`           | (required)                   | Slug for the live blog fixture                       |
| `LIVEBLOG_UPDATE_POST_ID` | (required)                   | Numeric WP post ID for one live blog update          |
