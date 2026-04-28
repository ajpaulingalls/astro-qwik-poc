# mock-api

Shared Deno 2 mock GraphQL server for the AJE PoCs. Mirrors the production
`aljazeera.com` GraphQL interface (GET-only, `wp-site` header required,
resolution by `operationName`) and serves recorded fixture JSON.

**Runtime:** Deno 2 (not part of the bun workspace). **Port:** `4455` (override
with `PORT` env).

## Quick start

From the repo root:

```bash
bun run mock-api          # uses the root-level deno task
# or, equivalently, from packages/mock-api/:
deno task dev
```

Then verify with curl:

```bash
curl -s -H 'wp-site: aje' \
  'http://localhost:4455/graphql?operationName=HomePageQuery&variables=%7B%7D' \
  | jq '.data.homepage.layout'
# → "three-column"
```

## Tasks

```bash
deno task dev    # boot the server with explicit --allow flags (no -A)
deno task test   # run the full test suite
```

The dev task uses the narrowest viable permission set:
`--allow-net=0.0.0.0:4455 --allow-read=./fixtures --allow-env=PORT,FIXTURE_DIR,LIVEBLOG_SNAPSHOT_INDEX,LIVEBLOG_SNAPSHOT_INTERVAL_MS`.

## Environment variables

| Variable                        | Default      | Purpose                                                                                                                                                                | Read by                           |
| ------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `PORT`                          | `4455`       | Server port. Fails loud on non-integer or out-of-range values.                                                                                                         | server                            |
| `FIXTURE_DIR`                   | `./fixtures` | Directory the loader scans for `*.json` at startup.                                                                                                                    | server                            |
| `LIVEBLOG_SNAPSHOT_INDEX`       | (unset)      | Pin live-blog `--snapshot-N` selection for the lifetime of the process. Per-request `x-liveblog-snapshot` header overrides this. Captured once at handler module load. | handler                           |
| `LIVEBLOG_SNAPSHOT_INTERVAL_MS` | `30000`      | Wall-clock auto-rotation interval for live-blog snapshots when neither header nor `LIVEBLOG_SNAPSHOT_INDEX` is set. Captured once at handler module load.              | handler                           |
| `WP_SITE`                       | `aje`        | `wp-site` header value used when recording new fixtures from production (`aje` English, `aja` Arabic).                                                                 | `scripts/record-fixtures.sh` only |

The per-request `wp-site` header is required on every request (missing → 400)
and validated by the handler. The optional per-request `x-liveblog-snapshot: N`
header pins live-blog snapshot selection for that request only (used by the
perf-harness and deterministic tests).

## Fixture layout

Every `*.json` file under `FIXTURE_DIR` is loaded at startup, keyed by basename
(without extension). Filenames must match the keys produced by
`lib/variants.ts:resolveFixtureKey`:

- `{operationName}.json` — operations without variants (e.g.
  `HomePageQuery.json`)
- `{operationName}--{variant}.json` — single-variant operations (e.g.
  `ArchipelagoSectionQuery--middle-east.json`)
- `{operationName}--{variant1}--{variant2}.json` — paginated operations (e.g.
  `ArchipelagoAjeSectionPostsQuery--middle-east--offset-9.json`)

Variant values are slugified (`[a-z0-9-]+`, lowercase, runs collapsed, edges
trimmed) so production article slugs containing slashes can't escape the
filename.

A malformed fixture aborts startup with the offending filename — no silent 500s
at request time.

### Synthetic vs recorded fixtures

Most fixtures are recorded verbatim from production via
`scripts/record-fixtures.sh`. A few are hand-crafted to cover embed types
production doesn't expose in our scouted query surface:

| Fixture                                                              | Origin                                                                                                                        |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ArchipelagoSingleArticleQuery--sample-article-with-instagram-embed` | Hand-crafted. Production news articles don't carry Instagram embeds in scouting                                               |
| `ArchipelagoSingleArticleQuery--sample-article-with-gallery-embed`   | Hand-crafted. Production `/gallery/*` uses a different `operationName` (out of M7 scope)                                      |
| `ArchipelagoSingleLiveBlogQuery--…--snapshot-{1,2}`                  | Hand-crafted from `--snapshot-0` (recorded). Each prepends a real production child id + publishedTime to `childrenMeta`.      |
| `SingleLiveBlogChildrensQuery--…--snapshot-{1,2}`                    | Hand-crafted from `--snapshot-0` (recorded), with the matching real child id prepended to the `children` list (newest-first). |

Synthetic article fixtures are flagged in-band: `title` ends with `(sample)`,
`id` uses the 9000000-block (e.g. `9001001`, `9002001`), and
`socialMediaSummary` / `excerpt` / `subheading` start with `Sample fixture:`.
Don't strip these markers — they're how renderers and screenshots stay honest
about provenance. Live-blog `--snapshot-{1,2}` variants use real production ids
and content, so no in-band markers apply; the tell is that the entries appear in
`--snapshot-{1,2}` but not `--snapshot-0` for the same slug.

## Architecture

| File                         | Role                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server.ts`                  | Bootstrap: env validation, fixture preload, `Deno.serve`. Exports `startServer({port, fixtureDir})` for tests.                                                                                                                                                                              |
| `lib/handler.ts`             | Pure `handle(req, {fixtures}) → Response`. Enforces GET-only, `wp-site` header, `/graphql` path, OPTIONS preflight.                                                                                                                                                                         |
| `lib/variants.ts`            | `resolveFixtureKey(operationName, variables, deps?) → string`. Throws `MissingVariableError` (handler converts to 400) when a known operation is called without required variables. When `deps` is supplied and the rule is `snapshotted`, appends `--snapshot-N` for live-blog operations. |
| `lib/snapshot.ts`            | Pure `resolveSnapshotIndex({headerValue, maxN, envIndex, envInterval}) → number`. Three-tier precedence: `x-liveblog-snapshot` header > `LIVEBLOG_SNAPSHOT_INDEX` env > wall-clock auto-rotate every `LIVEBLOG_SNAPSHOT_INTERVAL_MS` (default 30000ms).                                     |
| `lib/fixtures.ts`            | `loadFixtures(dir) → Map<string, string>`. Validates each fixture via `JSON.parse` at startup; stores raw text for fast response.                                                                                                                                                           |
| `tests/_helpers.ts`          | `withTempDir`, `withRunningServer`.                                                                                                                                                                                                                                                         |
| `scripts/record-fixtures.sh` | Re-runnable production capture (curl + jq). See [scripts/README.md](./scripts/README.md).                                                                                                                                                                                                   |

## Adding a new operation

1. **Add a variant rule** in `lib/variants.ts` if the operation has variables
   that select a fixture (slug, section, offset). Add tests in
   `tests/variants_test.ts` first (red), then implement (green). Ensure new
   fixture filenames will match `resolveFixtureKey` output.
2. **Add a `record` line** in `scripts/record-fixtures.sh` with the correct
   `operationName` and `variables` JSON (built via `jq -nc --arg/--argjson` for
   safety).
3. **Re-record** with `bash scripts/record-fixtures.sh` — the new fixture lands
   in `fixtures/`.
4. **Verify** via integration test in `tests/server_test.ts` (or rely on the
   existing variant-routing test if the new operation follows an existing
   pattern).

If the new operation reveals that production's actual schema differs from what
`docs/RESEARCH.md` documents, fix RESEARCH.md too. Honesty over surprise.

## Production behavior reference

`docs/RESEARCH.md` (repo root) is the source of truth for verified production
query patterns: operation names, variable shapes, pagination semantics,
hardcoded navigation, etc. The mock server mirrors this — when the two diverge,
RESEARCH.md is the spec we're matching against.

Critical invariants reproduced here (preserved by the mock):

- **GET only** (POST → 405)
- **`wp-site` header required** on every request (missing → 400)
- **Resolution by `operationName`**, not by query body
- **Pagination is client-side offset-based** (`offset: 0, 9, 18, …`)
- **Navigation is hardcoded in the frontend** — no GraphQL query returns nav
  data

## Production endpoint integration (planned for M11)

Per the execution plan, M11 adds env-driven endpoint switching to the frontend
GraphQL clients (`apps/astro/src/lib/graphql.ts` and
`apps/qwik/src/lib/graphql.ts`, both planned for M2/M3 scaffolds): default =
mock on `:4455`; override = production `aljazeera.com`. Switching will be
config-only — no app-route code changes. The mock will remain the source for
CI/dev/perf reproducibility; live demos use the production endpoint per
`docs/DEMO.md` (planned for M11). None of these files exist yet — they're
forward references to anchor the design intent.
