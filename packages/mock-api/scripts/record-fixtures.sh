#!/usr/bin/env bash
#
# Re-runnable recorder for production GraphQL fixtures.
# See ./README.md for usage and slug-selection guidance.
#
set -euo pipefail

readonly BASE_URL="https://www.aljazeera.com/graphql"
readonly WP_SITE="${WP_SITE:-aje}"
readonly OUT_DIR="${OUT_DIR:-$(cd "$(dirname "$0")/.." && pwd)/fixtures}"

# Production typically sends a specific postTypes list. Adjust if a fixture
# comes back with an unexpected shape.
readonly SECTION_POST_TYPES='["post","video","longform_article","liveblog"]'
readonly TOPIC_POST_TYPES='["post","video","longform_article"]'

require() {
  local name="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "ERROR: \$$name must be set. See scripts/README.md." >&2
    exit 1
  fi
}

# Mirrors lib/variants.ts:slugify exactly. Parity is enforced by
# tests/slugify_parity_test.ts — if either side changes, the test breaks.
slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

# scrub() pipes captured response stdin → stdout. By default a no-op; add
# `jq` filter steps here as sensitive fields are discovered. See README.
scrub() {
  cat
}

record() {
  local output="$1" op_name="$2" vars="$3"
  local encoded url tmp
  encoded=$(jq -rn --arg v "$vars" '$v|@uri')
  url="${BASE_URL}?wp-site=${WP_SITE}&operationName=${op_name}&variables=${encoded}&extensions=%7B%7D"
  tmp="${OUT_DIR}/${output}.json.tmp"
  echo "  → ${output}.json"
  # Write to tmp first so a failed curl/jq doesn't truncate the existing fixture.
  rm -f "$tmp"
  curl -sf -H "wp-site: ${WP_SITE}" "$url" | scrub | jq '.' > "$tmp"
  mv "$tmp" "${OUT_DIR}/${output}.json"
}

# Skip the main recording loop when this script is sourced (e.g. by
# tests/slugify_parity_test.ts which only needs the slugify function).
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

# --- Main: operator-supplied slugs and 13-fixture recording ---

ARTICLE_SLUG="${ARTICLE_SLUG:-}"
LIVEBLOG_SLUG="${LIVEBLOG_SLUG:-}"
LIVEBLOG_UPDATE_URI="${LIVEBLOG_UPDATE_URI:-}"

require ARTICLE_SLUG "$ARTICLE_SLUG"
require LIVEBLOG_SLUG "$LIVEBLOG_SLUG"
require LIVEBLOG_UPDATE_URI "$LIVEBLOG_UPDATE_URI"

mkdir -p "$OUT_DIR"

echo "Recording fixtures into ${OUT_DIR} (wp-site=${WP_SITE})…"

# --- No-variant operations ---
record HomePageQuery HomePageQuery \
  "$(jq -nc '{isAtf:true,atfLength:2,slug:"",preview:""}')"

record HomePageCuratedFeedQuery HomePageCuratedFeedQuery \
  "$(jq -nc '{preview:"",slug:""}')"

record ArchipelagoBreakingTickerQuery ArchipelagoBreakingTickerQuery '{}'

# --- Article ---
record "ArchipelagoSingleArticleQuery--$(slugify "$ARTICLE_SLUG")" \
  ArchipelagoSingleArticleQuery \
  "$(jq -nc --arg name "$ARTICLE_SLUG" '{name:$name,postType:"post",preview:""}')"

# --- Live blog (shell + children + one update) ---
record "ArchipelagoSingleLiveBlogQuery--$(slugify "$LIVEBLOG_SLUG")" \
  ArchipelagoSingleLiveBlogQuery \
  "$(jq -nc --arg name "$LIVEBLOG_SLUG" '{name:$name,postType:"post",preview:""}')"

record "SingleLiveBlogChildrensQuery--$(slugify "$LIVEBLOG_SLUG")" \
  SingleLiveBlogChildrensQuery \
  "$(jq -nc --arg postName "$LIVEBLOG_SLUG" '{postName:$postName}')"

record "LiveBlogUpdateQuery--$(slugify "$LIVEBLOG_UPDATE_URI")" \
  LiveBlogUpdateQuery \
  "$(jq -nc --arg uri "$LIVEBLOG_UPDATE_URI" '{uri:$uri}')"

# --- Geographic section (initial + 2 pages) ---
record ArchipelagoSectionQuery--middle-east \
  ArchipelagoSectionQuery \
  "$(jq -nc --argjson postTypes "$SECTION_POST_TYPES" \
    '{name:"middle-east",categoryType:"where",postTypes:$postTypes,quantity:9}')"

record ArchipelagoAjeSectionPostsQuery--middle-east--offset-0 \
  ArchipelagoAjeSectionPostsQuery \
  "$(jq -nc '{category:"middle-east",categoryType:"where",quantity:9,offset:0}')"

record ArchipelagoAjeSectionPostsQuery--middle-east--offset-9 \
  ArchipelagoAjeSectionPostsQuery \
  "$(jq -nc '{category:"middle-east",categoryType:"where",quantity:9,offset:9}')"

record ArchipelagoAjeSectionPostsQuery--middle-east--offset-18 \
  ArchipelagoAjeSectionPostsQuery \
  "$(jq -nc '{category:"middle-east",categoryType:"where",quantity:9,offset:18}')"

# --- Topic section (initial + 2 pages) ---
record ArchipelagoTopicsPageQuery--opinion \
  ArchipelagoTopicsPageQuery \
  "$(jq -nc --argjson postTypes "$TOPIC_POST_TYPES" \
    '{slug:"opinion",postTypes:$postTypes,preview:""}')"

record ArchipelagoPaginatedTopicsFeedQuery--opinion--offset-0 \
  ArchipelagoPaginatedTopicsFeedQuery \
  "$(jq -nc '{slug:"opinion",quantity:9,offset:0}')"

record ArchipelagoPaginatedTopicsFeedQuery--opinion--offset-9 \
  ArchipelagoPaginatedTopicsFeedQuery \
  "$(jq -nc '{slug:"opinion",quantity:9,offset:9}')"

record ArchipelagoPaginatedTopicsFeedQuery--opinion--offset-18 \
  ArchipelagoPaginatedTopicsFeedQuery \
  "$(jq -nc '{slug:"opinion",quantity:9,offset:18}')"

echo "Done. Diff before commit: git diff --stat ${OUT_DIR}"
