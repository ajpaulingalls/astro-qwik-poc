# Perf-sweep commit decomposition protocol

**Status:** Adopted at sprint-013 kickoff (Try `891c9fec3cca`).

## The problem

Sprint-012 generated four "Commit touches N files — consider smaller commits"
review concerns (`27f80810ca9c`, `7ee24ad0dce7`, `fe1202b1f6a1`,
`ce7c4fb0e2ca`), all on perf-sweep commits ranging 17–22 files. Every one
came from the same coupling: a behavior change in `packages/perf-harness/`
landed together with the regenerated `reports/*.json` and `reports/*.md`
outputs of the post-change re-sweep.

Both halves were correct. The combined commit was just too big to bisect
or review cleanly.

## The rule

Perf-sweep work ships as **two commits**:

1. **(a) Code change** — the behavior delta in `packages/perf-harness/` or
   the app under test. Tests green. No `reports/*` regeneration.
2. **(b) Reports refresh** — `bun run perf:astro` and/or `bun run perf:qwik`
   re-run; only the changed `reports/*.json` and `reports/*.md` files staged.

Commit (b) trails commit (a). Commit (a) gets the normal review cycle
(`/simplify` → `/xp-quality-review` → `/xp-security-triage`). Commit (b)
skips the review cycle (it's regenerated artifact, not new behavior).

## How to apply

1. Land the code change. Run unit tests. Set `PERF_REPORTS_DIR` to a temp
   dir before any sweep invocation that's part of the code-change cycle so
   committed `reports/*` are never touched in commit (a). (`runner_test.ts`
   already does this via `vi.hoisted`; do the same for ad-hoc sweeps.)
   Fallback if the env wasn't set in time: `git restore packages/perf-harness/reports/`
   before staging.
2. After commit (a) lands, run the appropriate sweep
   (`bun run perf:astro` and/or `bun run perf:qwik`).
3. Stage only the `reports/*.json`, `reports/*.md`, and `reports/RUN_NOTES.md`
   changes. Commit (b) with a message that names the sweep and the count
   of regenerated files.
4. If a single change touches both targets, run both sweeps in commit (b);
   one reports commit per code change, not one per target.

## Validation

The artifact for this Try is **the next perf sweep ships as two commits**.
Track on first occurrence after sprint-013 (likely M13 final comparison,
or any earlier perf-affecting code change).

## Exceptions

- Pure-fixture report regeneration (no code change driving it) is one commit.
- Code changes that don't affect any measured metric (e.g. comment-only
  edits to `packages/perf-harness/`) don't trigger a sweep, so they don't
  generate reports — one commit.

## Related

- Original Try: `891c9fec3cca`
- Source concerns (all sprint-012, all auto-dropped at sprint-013 kickoff
  as "likely addressed" by their generating commits): `27f80810ca9c`,
  `7ee24ad0dce7`, `fe1202b1f6a1`, `ce7c4fb0e2ca`
- Test-isolation refactor that makes commit (a) easier:
  `packages/perf-harness/reporter.ts` `REPORTS_DIR_ENV` (this session,
  commit `1c39f14`)
