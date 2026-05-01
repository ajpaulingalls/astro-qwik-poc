#!/usr/bin/env bash
# Canonical editorial-denylist + heading-format check for
# docs/COMPARISON.md.
#
# Walks each `## N. ...` section of the doc and verifies two things:
#
# 1. The section heading matches the expected `## N. <Title>` format.
#    Origin: concern 5b20884843c5 (acceptance grep ranges like
#    `awk /## 1./,/## 2./` silently fail open if the literal `## N.`
#    heading is missing or malformed). Adopted into story-006 via
#    decision 4fad291f6451.
#
# 2. The section prose contains no editorial vocabulary that would
#    violate M-13's "measured data only — no opinions" constraint
#    (strict for §1; advisory for §2-§7; capstone story-006 enforces
#    section-by-section).
#
# Wordlist origin: aggregated from sprint-013 close-reviewer concerns
# a65ab7af40bd, bc896e3aa429, 329d0cb95c77 (faster/slower/heavy/lean/
# bloated/snappy/sluggish/lightweight/fat/thin/chunky/nimble/huge/
# tiny/massive) plus story-003 acceptance additions
# (dominates/superior/inferior/struggles) plus the post-§1-cleanup
# additions (heavier/lighter/larger/smaller — comparison-direction
# words missed during story-002).
#
# Exit code: 0 = all sections pass; 1 = at least one section has a
# heading mismatch or denylist hit (script prints which section +
# which line + match).
#
# Usage:
#   bash scripts/check-comparison-denylist.sh
#
# Re-run after edits to docs/COMPARISON.md and during story-006
# capstone acceptance.

set -euo pipefail

DOC="docs/COMPARISON.md"
DENYLIST='\b(better|worse|wins?|loses?|preferable|outperforms?|beats?|great|poor|excellent|terrible|fast|faster|slow|slower|heavy|lean|bloated|snappy|sluggish|lightweight|fat|thin|chunky|nimble|huge|tiny|massive|dominates|superior|inferior|struggles|heavier|lighter|larger|smaller)\b'

if [ ! -f "$DOC" ]; then
  echo "ERROR: $DOC not found. Run from repo root." >&2
  exit 2
fi

FAIL=0
for SEC in 1 2 3 4 5 6 7 8; do
  NEXT=$((SEC + 1))
  if [ "$SEC" -eq 8 ]; then
    # §8 is the last section — range to EOF
    BLOCK=$(awk "/^## ${SEC}\\./,0" "$DOC")
  else
    BLOCK=$(awk "/^## ${SEC}\\./,/^## ${NEXT}\\./" "$DOC")
  fi

  # Heading-format guard: detect a missing section first, then
  # validate that the first line matches `## N. <Title>` exactly.
  # The trailing space after `${SEC}\.` distinguishes `## 2. Title`
  # from a malformed `## 2.Title` or an unintended `## 21. ...`.
  if [ -z "$BLOCK" ]; then
    echo "§${SEC}: FAIL (section missing — no '## ${SEC}.' heading found)"
    FAIL=1
    continue
  fi
  FIRST_LINE=$(printf '%s\n' "$BLOCK" | head -1)
  if ! printf '%s\n' "$FIRST_LINE" | grep -qE "^## ${SEC}\. "; then
    echo "§${SEC}: FAIL (heading format mismatch — expected '## ${SEC}. <Title>')"
    echo "  got: ${FIRST_LINE}"
    FAIL=1
    continue
  fi

  # Skip sections that are still stub-only (one italic line)
  STUB_COUNT=$(printf '%s\n' "$BLOCK" | grep -c '^_To be written' || true)
  CONTENT_LINES=$(printf '%s\n' "$BLOCK" | grep -v '^$' | wc -l | tr -d ' ')
  if [ "$STUB_COUNT" -ge 1 ] && [ "$CONTENT_LINES" -le 3 ]; then
    echo "§${SEC}: SKIP (stub-only, not yet written)"
    continue
  fi

  HITS=$(printf '%s\n' "$BLOCK" | grep -niE "$DENYLIST" || true)
  if [ -z "$HITS" ]; then
    echo "§${SEC}: PASS"
  else
    echo "§${SEC}: FAIL"
    echo "$HITS" | sed 's/^/  /'
    FAIL=1
  fi
done

if [ "$FAIL" -eq 1 ]; then
  echo
  echo "FAIL: at least one section has a heading-format mismatch or denylist hit." >&2
  echo "Either fix the section heading, rewrite the prose neutrally, or" >&2
  echo "extend the denylist in this script if a word is genuinely fine." >&2
  exit 1
fi

echo
echo "PASS: all written sections clean against heading-format guard + editorial denylist."
