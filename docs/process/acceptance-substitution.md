# Acceptance substitution for long-running suites

**Status:** Adopted at sprint-013 kickoff (concern `b89e37815cd4`).

## The problem

Story-003's acceptance criterion was the n=10 perf-harness sweep — a
~50-minute matrix run across both targets and all page types. The story's
substantive code change (a JSDoc clarification + new test) didn't move
any measured metric and couldn't have. Re-running the full sweep to verify
acceptance would have:

- Cost ~50 minutes of operator-attended runtime
- Produced reports byte-identical to the prior run modulo lighthouse noise
- Burned a perf-harness budget we'd just used at sprint-012 close

Instead, acceptance was verified by direct evidence: file inspection
(20 perf reports + 20 throughput reports + RUN_NOTES, no MISSING entries,
all req/s ≥ 50, HEAD~1 diff 41 files all in the expected change zone).

That substitution was correct. But it landed without an explicit framing,
which made the reviewer judge the same evidence twice — once for the AC
and once for the substitution itself.

## The rule

When an acceptance criterion calls for a long-running suite (>15 min wall
clock), substitution by direct evidence is allowed if **all** of the
following hold:

1. The substitute covers the **same evidence base** as the suite would.
2. The story's code change demonstrably cannot move the measured signal.
3. The substitution is named explicitly in the commit body and the PR
   description, with the alternative evidence enumerated.

If any of those fails, run the suite.

## How to apply

1. At story acceptance, check the AC against the actual code change. If
   the change can't move what the suite measures, substitution is on the
   table.
2. Enumerate what the suite would have proved (e.g. "n=10 throughput
   medians ≥ 50 req/s for both targets across all pages").
3. Cite the alternative evidence (file inspection of prior reports, diff
   against last passing run, golden-file comparison).
4. State the substitution explicitly:

   > Acceptance substitution: AC required `bun run perf:astro` n=10 sweep.
   > Substituted by file inspection of `reports/astro-*.json` from sprint-012
   > close (commit `<sha>`) — all req/s medians ≥ 50, no MISSING entries.
   > This commit's only changes are JSDoc + a new test; runner.main code
   > path unchanged.

5. Include the substitution language in both the commit body and the PR
   description so the reviewer doesn't have to reconstruct the rationale.

## Anti-patterns

- **Implicit substitution** ("I didn't run the sweep because it would have
  been the same as last time"): the reviewer can't verify "same as last
  time" without doing it themselves. State the comparison artifact.
- **Substitution to dodge a real signal**: if the change touches anything
  the suite measures (even slightly), run the suite. The 15-min threshold
  exists to avoid waste, not to avoid the truth.
- **Substitution that requires re-running anyway** ("re-ran 1 page out of
  8 as a smoke test"): that's a sample, not a substitute. Run the full
  suite or state the sample's coverage limits explicitly.

## Related

- Source concern: `b89e37815cd4` (sprint-012 story-003 acceptance)
- Triage event: `51bfcd0eb67e` (adopt-now decision at sprint-013 kickoff)
- Companion doctrine: `docs/process/perf-commit-split.md` — when a sweep
  IS run, its outputs ship as a separate commit (b).
