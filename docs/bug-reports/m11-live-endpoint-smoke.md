# M11 Live-Endpoint Smoke Report

Sprint-011 / story-001. Target: swap both apps from mock-api to
`https://www.aljazeera.com` via `PUBLIC_API_BASE`, verify all four page
types render, document drift.

## Method

1. Built each app with `PUBLIC_API_BASE=https://www.aljazeera.com`.
2. Booted production runtime per app:
   - Astro: `deno run --allow-net=0.0.0.0:8080,www.aljazeera.com:443 --allow-read=apps/astro/dist --allow-env apps/astro/dist/server/entry.mjs` (perms derived per `deriveAllowNet` from sprint-011 story-002).
   - Qwik: `cd apps/qwik && PUBLIC_API_BASE=https://www.aljazeera.com PORT=4173 bun run server.ts`.
3. Issued SSR request per route with `curl -sSL`. SSR-side fetch bypasses
   browser CORS entirely, so this matches the architecture both apps use
   in production (no client-side GraphQL).
4. Probed each operationName from `docs/RESEARCH.md` directly via curl
   to verify schema/shape parity.

## SSR Smoke Matrix

Both apps booted against `https://www.aljazeera.com`. HTTP status + body
size of each route:

| Route                               | Astro     | Qwik          |
| ----------------------------------- | --------- | ------------- |
| `/` (homepage)                      | 200 33 KB | 200 179 KB    |
| `/middle-east` (geographic section) | 200 22 KB | 200 39 KB     |
| `/opinion` (topic section)          | 200 24 KB | 200 41 KB     |
| `/news/{date}/{slug}` (article)     | 200 22 KB | 200 46 KB     |
| `/news/liveblog/{date}/{slug}`      | 200 20 KB | **404 25 KB** |

Live slugs used for the article + liveblog rows were sourced from the
homepage response at smoke time; they will rotate. The article slug used
was `2026/4/30/can-the-eus-article-42-7-offer-europe-nato-like-collective-defence`;
the liveblog slug used was
`2026/4/30/iran-war-live-trump-urges-tehran-to-just-give-up-as-oil-prices-surge`.

## Operation-Level Probes

Direct curl against `https://www.aljazeera.com/graphql?...` with `wp-site: aje`:

| Operation                             | Variables (used)                                                    | Status | Notes                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HomePageQuery`                       | `{isAtf:true,atfLength:2,slug:"",preview:""}`                       | 200    | 192 KB; `data.homepage.featuredPosts` populated                                                                                                     |
| `HomePageCuratedFeedQuery`            | `{preview:"",slug:""}`                                              | 200    | 219 KB                                                                                                                                              |
| `ArchipelagoBreakingTickerQuery`      | `{}`                                                                | 200    | Returns `data.breakingNews` (often all-null when no breaking story is active)                                                                       |
| `ArchipelagoSectionQuery`             | `{name:"middle-east",categoryType:"where",quantity:9,offset:0}`     | 200    | 27 KB; `data.category` populated. **Note**: production requires `name`, `quantity` (not `slug`) — apps already send the right shape.                |
| `ArchipelagoAjeSectionPostsQuery`     | `{category:"middle-east",categoryType:"where",quantity:9,offset:9}` | 200    | 9 articles                                                                                                                                          |
| `ArchipelagoTopicsPageQuery`          | `{slug:"opinion",preview:""}`                                       | 200    | 204 KB                                                                                                                                              |
| `ArchipelagoPaginatedTopicsFeedQuery` | `{slug:"opinion",quantity:9,offset:9}`                              | 200    | Returns 10 articles even with `quantity:9`; both apps slice to 9 — non-issue.                                                                       |
| `ArchipelagoSingleArticleQuery`       | `{name:"<bare-slug>",preview:""}` (no `postType`)                   | 200    | App slug-extraction (`lastSegment`) yields the bare slug from the route path; production accepts without `postType`.                                |
| `ArchipelagoSingleLiveBlogQuery`      | `{name:"<bare-slug>",postType:"liveblog",preview:""}`               | 200    | **Requires `postType:"liveblog"`** — RESEARCH.md §Live Blog flagged this; without it production returns `no_posts_found` with `data.article: null`. |
| `SingleLiveBlogChildrensQuery`        | `{postName:"<bare-slug>"}`                                          | 200    | Returns `data.article.children` (id list of liveblog updates)                                                                                       |
| Missing `wp-site` header              | (any operation)                                                     | 400    | Mock-api parity preserved.                                                                                                                          |

No fixture-shape drift detected at top-level keys for any 200-response
operation. Field-level drift (new optional keys, etc.) was not exhaustively
diffed and is not required by M11's acceptance criteria.

## Findings

### F1 — Qwik liveblog route 404s against live (BLOCKING for liveblog demo)

`apps/qwik/src/lib/liveblog-api.ts:13-18` calls
`ArchipelagoSingleLiveBlogQuery` with `{ name: slug, preview: '' }` —
**no `postType`**. Production requires `postType: "liveblog"` (per
`docs/RESEARCH.md` §Live Blog explicit warning) and returns
`no_posts_found` otherwise; the route handler then 404s.

Astro's twin (`apps/astro/src/lib/liveblog-api.ts:13-18`) sends
`{ name: slug, postType: 'liveblog', preview: '' }` — works against
live (200, 20 KB).

**Fix**: 1-line change in the Qwik twin; apply `postType: 'liveblog'`
to match Astro and the production contract. Tracked separately in the
follow-up commit on this sprint branch.

### F2 — Article slug extraction is correct (no fix needed)

Both apps' route handlers extract the URL's last segment via
`lastSegment()` and pass that as `name`. Production accepts the bare
slug (no `/news/` prefix, no date) for `ArchipelagoSingleArticleQuery`.
Existing fixtures use the same bare-slug pattern. No drift.

### F3 — Article slug rotation is expected (operational, not a bug)

The pre-existing fixture
`ArchipelagoSingleArticleQuery--russian-oil-exports-slump-as-ukraine-hammers-ports-and-refineries.json`
returns `no_posts_found` against live — that article rotated off the
live homepage between fixture capture (April 24) and smoke (April 30).
The mock-api still serves it fine. No code change; the demo just needs
a current live slug at demo time.

## CORS

Risk `411aa58d4b11` ("Live aljazeera.com endpoint may block PoC origin
via CORS — blocks M11 demo if unmitigated") is **mitigated by SSR
architecture** for all GraphQL operations:

- All GraphQL fetches in both apps run server-side (Astro Deno SSR /
  Qwik Bun `server.ts`). Server-to-server requests have no CORS
  preflight or origin restriction.
- Browser-side requests touch only the SSR origin (`localhost:8080` or
  `:4173`) for HTML/JS/CSS, and `/wp-content/uploads/*` for images. The
  uploads path goes through the same-origin proxy
  (`apps/astro/src/pages/wp-content/uploads/[...path].ts` /
  `apps/qwik/server.ts:tryProxyUploads`), which forwards server-side to
  the configured `PUBLIC_API_BASE`.

No CORS blocker observed during smoke. No client-side cross-origin
fetches exist in either app.

## Schema-Drift Risk

Risk `f739ed3748cc` ("Fixture vs live schema drift") is **mitigated for
all operationNames probed** at the top-level shape. Field-level drift
remains possible — perf-harness still runs against the mock so any
fixture-vs-live divergence would not surface there. Demo build uses
live data directly so any unrendered field appears immediately to a
manual tester.

No fixture refreshes were applied as part of this smoke. The
`russian-oil-exports-...` fixture remains valid for mock-api / perf
flows even though the live article is no longer reachable.
