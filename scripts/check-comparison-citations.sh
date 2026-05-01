#!/usr/bin/env bash
# §1 citation-completeness check for docs/COMPARISON.md.
#
# Walks every non-header pipe-table row in §1 and asserts that the
# Source column (the last data cell) cites at least one of the
# accepted basenames. M-13 constraint: "measured data only for
# performance — no opinions" — every numeric claim in §1 must trace
# to a named source file.
#
# Origin: concern 549f1548528a (story-013 acceptance for §1 was
# eyeballed against ~50 cells; reviewer error-prone). Adopted into
# story-006 via decision 4fad291f6451.
#
# Accepted-basename list: the original concern named 4 sources
# (RUN_NOTES.md, M12_VALIDATION.md, cli_helpers.ts, README.md). The
# story-006 explorer pass (decision 2ce004ade9b2) widened the list
# to 7 — adding SECURITY.md (cited at §1.6 for CSP-violations
# evidence), web_vitals_collector.ts (cited at §1.6 for the runtime
# collector), and QWIK2_NOTES.md (cited at §1.4 for framework-floor
# characterization). The 3 additions are all real, in-tree, and
# recurring §1 sources — narrowing back to 4 would force false
# positives.
#
# Exit code: 0 = every row passes; 1 = at least one row missing an
# accepted-basename citation; 2 = doc not found.
#
# Usage:
#   bash scripts/check-comparison-citations.sh
#
# Re-run after edits to §1 of docs/COMPARISON.md and during story-006
# capstone acceptance.

set -euo pipefail

DOC="docs/COMPARISON.md"
ACCEPTED=(
  RUN_NOTES.md
  M12_VALIDATION.md
  cli_helpers.ts
  README.md
  SECURITY.md
  web_vitals_collector.ts
  QWIK2_NOTES.md
)

if [ ! -f "$DOC" ]; then
  echo "ERROR: $DOC not found. Run from repo root." >&2
  exit 2
fi

# Extract §1 only (between `## 1.` and `## 2.`).
SECTION_1=$(awk '/^## 1\./,/^## 2\./' "$DOC")

FAIL=0
LINE_NO=0
# Last-seen Source-column inheritance state. The §1 tables use a
# `same` back-reference convention: a row whose Source cell is the
# literal `same` inherits the prior row's source. Track whether the
# most recent non-`same` Source cell cited an accepted basename so
# `same` rows can inherit that validity.
LAST_SOURCE_OK=0
while IFS= read -r line; do
  LINE_NO=$((LINE_NO + 1))

  # Only consider lines that look like a complete pipe-table row:
  # leading `|` and trailing `|`. Markdown tables in this doc always
  # follow this shape; partial-pipe lines aren't table content.
  case "$line" in
    '|'*'|') ;;
    *) continue ;;
  esac

  # Skip table separator rows (e.g., `| --- | --- |`).
  case "$line" in
    *' --- '* | *'-----'*) continue ;;
  esac

  # Skip table-header rows. Headers in this doc start the Source
  # column with the literal text " Source " — anchor on that
  # column-positioned form so we don't accidentally skip a row whose
  # prose mentions "source" in passing. Also reset the inheritance
  # state so a `same` row in the next table can't accidentally
  # inherit from the prior table.
  case "$line" in
    *'| Source '*)
      LAST_SOURCE_OK=0
      continue
      ;;
  esac

  # Get the Source column (last data cell). awk's `NF` is the empty
  # trailing field after the row's closing pipe, so `$(NF-1)` is the
  # last real cell. Strip surrounding whitespace for the `same`
  # back-reference comparison.
  SOURCE_CELL=$(printf '%s\n' "$line" | awk -F'|' '{print $(NF-1)}')
  SOURCE_TRIM=$(printf '%s' "$SOURCE_CELL" | awk '{$1=$1; print}')

  if [ "$SOURCE_TRIM" = "same" ]; then
    # Inherit the prior row's verdict. Don't update LAST_SOURCE_OK —
    # `same` is transparent to the chain.
    if [ "$LAST_SOURCE_OK" -eq 0 ]; then
      echo "§1 citation FAIL line ${LINE_NO} (same back-ref to a prior row that had no accepted basename): ${line}"
      FAIL=1
    fi
    continue
  fi

  found=0
  for b in "${ACCEPTED[@]}"; do
    if printf '%s\n' "$SOURCE_CELL" | grep -qF "$b"; then
      found=1
      break
    fi
  done
  LAST_SOURCE_OK="$found"
  if [ "$found" -eq 0 ]; then
    echo "§1 citation FAIL line ${LINE_NO}: ${line}"
    FAIL=1
  fi
done <<<"$SECTION_1"

if [ "$FAIL" -eq 1 ]; then
  echo
  echo "FAIL: at least one §1 table row missing an accepted-basename citation." >&2
  echo "Either add the citation, or extend ACCEPTED in this script if the row" >&2
  echo "genuinely needs a new source." >&2
  exit 1
fi

echo "PASS: every §1 table row cites an accepted basename."
