# Mock GraphQL API — Cross-App Notes

Shared mock GraphQL server living in `packages/mock-api/` at the repo root. Used
identically by both the Astro and Qwik PoCs so they hit the same data and the
perf comparison is apples-to-apples. Per-framework consumption details (env-var
read timing, HTTP client wiring) live in each app's `docs/ARCHITECTURE.md`; the
contract + how to run/extend the mock lives here.

## Design Principle

The mock mirrors the **production API's interface exactly**:

- Accepts GET requests with `operationName` and `variables` as URL parameters
- Requires the `wp-site` header (`aje` or `aja`)
- Returns **recorded production response fixtures** — real JSON captured from
  production calls, with sensitive data scrubbed

## Server Implementation

**Runtime:** Deno 2 (uses built-in `Deno.serve()`, not the deprecated `std/http`
`serve` import) **Port:** `4455` (default; perf-harness spawns a second instance
on `4456` for the Qwik target — see
`packages/perf-harness/spawn.ts:MOCK_API_PORT`) **Entry point:**
`packages/mock-api/server.ts`; request handling lives in
`packages/mock-api/lib/handler.ts`.

The handler enforces these contracts on every request:

- **GET only.** Other methods return `405 Method not allowed`. `OPTIONS`
  preflight short-circuits to `204` with CORS headers.
- **`wp-site` header required** (production uses `aje` for English, `aja` for
  Arabic); missing returns `400`. The handler only checks for presence, not
  value — value-validation is upstream caller responsibility.
- **`operationName` query param required**; missing returns `400`, unknown
  operation returns `404`.
- **`variables` query param** is parsed as URL-encoded JSON; invalid JSON
  returns `400`.
- **Fixture variant resolution.** `lib/variants.ts` maps
  `(operationName, variables)` → fixture key — e.g. an article slug resolves
  `ArchipelagoSingleArticleQuery` → `ArchipelagoSingleArticleQuery--<slug>.json`
  when present, else falls back to the bare key. A required variable missing
  from `variables` returns `400`.
- **`/wp-content/uploads/*` image serving.** Honors `?w=N` (square N×N) and
  `?resize=W,H` (W×H, takes precedence) by returning a stub SVG; bare requests
  or unparseable params return a 1×1 transparent PNG. Keeps perf-harness LCP
  measurements honest without fabricating image-decode data.
- **CORS:** `access-control-allow-origin: *`,
  `access-control-allow-headers: wp-site, content-type`.

Fixtures are loaded once at startup as raw JSON text (not parsed objects) — the
handler returns the stored text directly to avoid per-request stringify
overhead. Read `packages/mock-api/lib/handler.ts` for the authoritative
implementation.

## Fixture Files

Fixture filenames follow the pattern `<OperationName>.json` for the bare
operation, or `<OperationName>--<variant-key>.json` for variants resolved by
`lib/variants.ts` (e.g. article slug, section slug, numeric WP post ID,
pagination offset). For the live list run `ls packages/mock-api/fixtures/`.
Representative shape:

```
packages/mock-api/fixtures/
├── HomePageQuery.json
├── HomePageCuratedFeedQuery.json
├── ArchipelagoSingleArticleQuery--<slug>.json
├── ArchipelagoSingleLiveBlogQuery--<slug>.json
├── SingleLiveBlogChildrensQuery--<slug>.json
├── LiveBlogUpdateQuery--<postID>.json                          ← numeric WP post ID
├── ArchipelagoSectionQuery--<section>.json
├── ArchipelagoAjeSectionPostsQuery--<section>--offset-<N>.json ← N ∈ {0,9,18}
├── ArchipelagoTopicsPageQuery--<topic>.json
├── ArchipelagoPaginatedTopicsFeedQuery--<topic>--offset-<N>.json
└── ArchipelagoBreakingTickerQuery.json
```

## Recording Fixtures

```bash
curl -s 'https://www.aljazeera.com/graphql?wp-site=aje&operationName=HomePageQuery&variables=%7B%22isAtf%22%3Atrue%2C%22atfLength%22%3A2%2C%22slug%22%3A%22%22%2C%22preview%22%3A%22%22%7D&extensions=%7B%7D' \
  -H 'wp-site: aje' | python3 -m json.tool > packages/mock-api/fixtures/HomePageQuery.json
```

## Environment Variables

| Variable                                                             | Default      | Purpose                                                                                                                                  |
| -------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                                               | `4455`       | Server port (0–65535)                                                                                                                    |
| `FIXTURE_DIR`                                                        | `./fixtures` | Path to fixture JSON files                                                                                                               |
| `SNAPSHOT_INDEX`<br>_(alias: `LIVEBLOG_SNAPSHOT_INDEX`)_             | (unset)      | Pins `--snapshot-N` selection for the process (governs live-blog AND ticker). Overridden per-request by `x-liveblog-snapshot: N` header. |
| `SNAPSHOT_INTERVAL_MS`<br>_(alias: `LIVEBLOG_SNAPSHOT_INTERVAL_MS`)_ | `30000`      | Wall-clock auto-rotation interval (ms) when neither header nor `SNAPSHOT_INDEX` is set.                                                  |

> Per-app `PUBLIC_API_BASE` (consumer-side env that points an app at
> `http://localhost:4455` or `:4456`) is documented in each app's
> `docs/ARCHITECTURE.md` — it is not read by the mock server itself.

## Deno Permissions

```bash
deno run \
  --allow-net=0.0.0.0:4455 \
  --allow-read=./fixtures \
  --allow-env=PORT,FIXTURE_DIR,SNAPSHOT_INDEX,SNAPSHOT_INTERVAL_MS,LIVEBLOG_SNAPSHOT_INDEX,LIVEBLOG_SNAPSHOT_INTERVAL_MS \
  packages/mock-api/server.ts
```
