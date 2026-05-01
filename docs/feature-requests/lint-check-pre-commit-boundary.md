# Feature request: move lint-check from per-write hook to pre-commit boundary

**Plugin:** `xp-agents` (cached at `~/.claude/plugins/cache/xp-agents/xp-agents/2.37.1/`)
**Rule location:** `hooks/hooks.json:152-170` (PostToolUse on `Write|Edit|MultiEdit` calls `scripts/lint_check.py`)
**Reporter:** AJE PoC, sprint-013 retrospective (2026-05-01)
**Linked retro Tries:** SMM event `982c8e2a88c1` (proposed sprint-011 retro, 2nd defer at sprint-013), follow-on event `1710a61044b3` (re-propose at sprint-012 retro)

## Current behavior

The plugin registers two PostToolUse hooks for write tools:

```jsonc
{
  "matcher": "Write|Edit|MultiEdit",
  "hooks": [
    { "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/post_tool_use.py" },
    { "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/lint_check.py" },
  ],
}
```

`lint_check.py` runs against the modified file every time the agent writes. Failures append `concern` events to the SMM with severity tagged from the linter output. The intent is fast feedback — the agent sees lint failures immediately, not at commit time.

## What we're seeing

Per-write lint produces a steady stream of transient concerns that auto-resolve before the next commit, polluting the retro signal. From the sprint-013 retrospective:

- 7 `lint_events` / 6 `lint-check` status events in a single session
- Multiple lint concerns auto-resolved on transient edit states (e.g. SMM events `d970bbba2ba2`, `15e43aa418cb`, `9fdb2a30ad23`)
- Concern-resolution headline reported as 22/22 but ~10 of those 22 are transient lint bookkeeping; real signal is closer to 12/12

The retro analyzer has flagged this two sprints in a row. The Try has been deferred twice, putting it at the DECIDE-OR-DROP boundary (SMM wisdom `ca68f750c261`).

### Why per-write lint is the wrong granularity

1. **Edit sequences create false positives.** A 3-step refactor (rename file → update imports in caller A → update imports in caller B) lints once per step. The first two steps fail (caller B still references the old name). Both failures land as concerns. By the time the agent commits, both are stale.
2. **Auto-resolution masks the real concern-resolution rate.** The concern stream gets two open events and two close events for what's logically a single in-progress edit. Retros count both as "concerns resolved," inflating the number above the real reviewer + commit-emitted signal.
3. **The agent already runs the linter at commit time anyway.** If the project has a pre-commit hook (lefthook, husky, etc.), or if `bash_post_tool.py` invokes lint as part of the commit gate, per-write is duplicative.
4. **Cost is not visible to the agent.** Each lint invocation is 1-5 seconds of wall time per write. In an active edit session that compounds into minutes of latency the agent can't see (it just experiences "tools feel slow"). The signal it produces is mostly noise.

## What we want

Move the lint hook from `PostToolUse: Write|Edit|MultiEdit` to **a `PreToolUse: Bash` filter that fires when the staged commit is about to land** (or equivalently, integrate it into the existing `pre_tool_bash.py` commit gate).

This way:

- Lint fires once per commit attempt, not once per write.
- Failures actually block the commit (real feedback) instead of auto-resolving (noise feedback).
- The agent sees lint failures at the natural decision point — not interleaved through editing.

### Comparison

| Case                                   | Today (per-write)                                      | Desired (pre-commit)   |
| -------------------------------------- | ------------------------------------------------------ | ---------------------- |
| Single edit then commit                | 1 lint run + 1 commit-gate lint                        | 1 lint run at commit   |
| 5-edit refactor then commit            | 5 lint runs (some failing transiently) + 1 commit-gate | 1 lint run at commit   |
| Edit, partial commit, edit, commit     | 2 lint runs + 2 commit-gates                           | 2 lint runs at commits |
| Tool-driven mass formatter then commit | N lint runs (one per touched file) + 1 commit-gate     | 1 lint run at commit   |
| Pure read-only session                 | 0 (correct)                                            | 0 (correct)            |

## Suggested implementation

The implementer can pick whichever fits the existing hook architecture:

1. **Move the existing hook to PreToolUse:Bash with a commit-only filter.** Mirror what `pre_tool_bash.py` already does for commit-size constraints. The hook short-circuits unless the bash command is `git commit ...`. Pros: minimal new code; reuses the matcher you already maintain.

2. **Inline lint into `pre_tool_bash.py`.** Call into `lint_check.py` from the existing pre-commit gate. Pros: one source of truth for "what runs at commit." Cons: couples the two hooks together.

3. **Per-edit lint becomes opt-in.** Keep `lint_check.py` available as an opt-in PostToolUse hook for users who want per-write feedback, but flip the default to off. Pros: backward-compat. Cons: two code paths to maintain.

We'd accept option 1 as the default. Option 2 is fine if it's cleaner. Option 3 is acceptable but the default-off matters — silence-by-default avoids surprising users on plugin upgrade.

## Acceptance criteria

The implementer can consider this done when:

1. **Per-write lint events stop appearing in the SMM.** A session that performs 5 edits and 1 commit emits at most 1 `lint_event` (at commit time), not 5.
2. **Lint failures still block real problems.** A commit attempt with a lint failure does not land — the existing fail-loud behavior is preserved at the new boundary.
3. **The retro digest's `lint_events` counter shows ≤3 per session in active edit work** (the artifact target captured in the original Try `982c8e2a88c1`).
4. **No regression in lint-resolution wiring.** `lint_resolution.resolve_lint_on_commit` and `lint_resolution.sweep_orphan_lint_concerns` (referenced from `bash_post_tool.py:293-298`) continue to function — they should now have nothing to clean up because there will be no orphaned per-write lint concerns.
5. **Tests cover the matrix.** New tests under `tests/hooks/test_lint_check.py` (or wherever the hook moves to) cover at minimum: write-only session emits no lint events; commit emits one lint event; failed lint blocks the commit; passing lint allows it.
6. **Docs updated.** Any plugin docs that say "lint runs on every write" are updated to "lint runs at commit time."

## Out of scope

- Changing what the linter checks for or which severity levels it emits.
- Changing how lint concerns are linked to commits (`Resolves-Event:` trailer wiring stays as-is).
- The status-summary split proposal (tracked separately at `docs/feature-requests/retro-status-summary-split.md` in this repo).

## Telemetry

When the hook moves, the retro should expose the new lint cadence so the carve-out's effect is observable. A `metadata.lint_boundary = "pre-commit" | "per-write"` field on lint events would let the analyzer track adoption across plugin upgrades.

## Contact

Test corpus: AJE PoC monorepo (Astro 6 + Qwik 2 beta + Deno mock-api). The retro events that triggered this proposal live in the host SMM at `~/.claude/plugins/data/xp-agents-xp-agents/bce1d9c11420/smm/`.
