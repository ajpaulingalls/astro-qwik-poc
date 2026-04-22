# Feature request: mechanical-reformat carve-out for the >=12-file commit-size concern

**Plugin:** `xp-agents` (cached at `~/.claude/plugins/cache/xp-agents/xp-agents/2.21.1/`)
**Rule location:** `scripts/bash_post_tool.py:284` (current head)
**Reporter:** AJE PoC, sprint-003 retrospective (2026-04-22)
**Linked decision:** SMM event `e4d6358756a4` ("Adopt: codify >8-file scaffold commit auto-flag in xp-code-reviewer; planner splits config/source/tests batches.")

## Current behavior

After every commit the post-tool hook counts touched files and, if `len(committed_files) >= COMMIT_SIZE_THRESHOLD` (currently `12`), unconditionally appends a `concern` event:

```python
# scripts/bash_post_tool.py:283
file_count = len(committed_files)
if file_count >= COMMIT_SIZE_THRESHOLD:
    pending.append(
        _common.make_event(
            _common.CONCERN,
            agent_id,
            f"Commit touches {file_count} files — consider smaller commits.",
            severity="medium",
        )
    )
```

There is no carve-out. Mass formatter rollouts trigger the same warning as feature work.

## What we're seeing

In sprint-003 we adopted a tooling triad (Prettier 3 + ESLint 9 flat + Deno fmt + lefthook) across the monorepo. Rolling out the formatters produced a string of mechanical-only commits. Two were flagged by the rule:

- SMM concern `b63bd72d90d8` — "Commit touches 14 files — consider smaller commits."
- SMM concern `624d36c6a876` — "Commit touches 13 files — consider smaller commits."

Both commits were entirely the output of `prettier --write` / `deno fmt` against an unformatted tree. The diff is by definition mechanically safe — splitting it into smaller commits would only add review noise (every reviewer would have to verify that each of N split commits is also pure-formatter output, which is harder than verifying the unsplit one).

This is the **3rd consecutive sprint** with at least one oversized commit (per the retrospective). Each prior occurrence was also formatter-driven, not feature-driven. We did split the rollout where it made sense (e.g. `da40110 style(qwik): apply prettier to source + config (8 files)` came in just under threshold), but a single-pass repo-wide format will always blow past 12 files for any non-trivial codebase.

The rule is firing on the wrong workload. We want it kept for feature commits, suppressed for mechanical reformats.

## Why this matters

1. **Concern budget pressure.** Every false-positive concern adds to the open-concerns list that work-selection has to triage at the start of each session. Two formatter-flag concerns in a sprint compound across 3 sprints into ~6 noisy open items.
2. **Resolves-link metric distortion.** The retrospective tracks resolves-link rate. Formatter concerns rarely get a `Resolves-Event:` trailer on a future commit because no future commit is "fixing" them — there's nothing to fix. They drag the metric down without representing real risk.
3. **Predictability.** A team that has invested in lefthook + prettier + deno fmt has decided that whole-repo reformats are routine maintenance. A rule that punishes routine maintenance trains people to skip the formatter rollout (debt accrues) or commit-amend-squash to hide it (history quality suffers).

## What we want

A carve-out that **suppresses the >=12-file concern when every hunk in the commit is the output of a recognized formatter** (`prettier --write` or `deno fmt` for our setup; `gofmt`, `rustfmt`, `ruff format`, `black` etc. for other ecosystems).

The desired behavior is a no-op on the mechanical case and unchanged on every other case. Specifically:

| Case                                                              | Today           | Desired         |
| ----------------------------------------------------------------- | --------------- | --------------- |
| 14-file feature commit                                            | concern emitted | concern emitted |
| 14-file pure-prettier commit                                      | concern emitted | **suppressed**  |
| 14-file commit: 13 prettier hunks + 1 hand-edited hunk            | concern emitted | concern emitted |
| 14-file commit touching `.prettierrc` config + reformatted output | concern emitted | concern emitted |
| 11-file commit (any kind)                                         | no concern      | no concern      |

## Suggested detection strategy (any of these in priority order)

The implementer can pick whichever is cheapest to land:

1. **Diff replay (highest precision).** For each touched file, run the configured formatter (look up `prettier`/`deno fmt`/`ruff format`/etc. via the project's package manifest or a per-language registry) against the file's contents at `HEAD~1` and compare against `HEAD`. If every file's `HEAD` matches the formatter's output applied to `HEAD~1`, the commit is mechanical. **Pros:** zero false positives. **Cons:** runs the formatter once per file in the commit; needs language-aware dispatch.

2. **Per-hunk semantic match (medium precision).** Use a structural diff (e.g. `diff --ignore-all-space --ignore-blank-lines`) per file. If the structural diff is empty for every file, the change is whitespace/format-only. **Pros:** language-agnostic, no formatter invocation. **Cons:** false positives for hand-edited whitespace changes (rare in practice but possible).

3. **Subject-line heuristic (lowest precision, simplest).** Suppress the concern when the commit subject matches a configured allowlist regex (`^style\(`, `^chore\(prettier\)`, `^chore\(deno fmt\)`, etc.). Make the regex configurable via `xp-agents` settings. **Pros:** trivially cheap, no diff inspection. **Cons:** relies on author discipline; mislabeled feature commits would be silently exempted.

We'd accept option 3 as a 90% solution since our team already enforces commit prefixes via convention. Option 1 is the gold standard.

In all options, **never suppress the concern when a formatter config file (`.prettierrc*`, `prettier.config.*`, `deno.json`, `.editorconfig`, `eslint.config.*`, `pyproject.toml`, etc.) is in the commit** — those mark a meaningful behavior change even when the rest of the commit is mechanical. Treat presence of any such file as proof the commit is non-mechanical.

## Acceptance criteria

The implementer can consider this done when:

1. **Pure-formatter commits are exempt.** A commit that is entirely the output of `prettier --write` against an unformatted tree, touching ≥12 files, does NOT cause the post-tool hook to append a `concern` event of severity `medium` with content matching `^Commit touches \d+ files`. Same for `deno fmt`.
2. **Feature commits remain flagged.** A commit touching ≥12 source files where at least one file has non-formatter changes DOES cause the concern to be emitted (existing behavior unchanged).
3. **Mixed commits are flagged.** A commit where formatter config (`.prettierrc*`, `deno.json`, `eslint.config.*`, etc.) is touched alongside reformatted output DOES emit the concern.
4. **Unit tests cover the matrix.** New tests under `tests/hooks/test_commits.py` (or wherever the size-threshold logic moves to) cover at minimum the four rows of the table above. Use a temp git repo + `subprocess` to run real `prettier`/`deno fmt` if going with option 1; mock the diff source if going with option 2 or 3.
5. **Configurability.** The carve-out is opt-in via an `xp-agents` setting (or default-on with an opt-out). Either is fine — but it must be controllable per-repo so a team that does NOT use these formatters can disable it.
6. **Telemetry preserved.** When a commit is exempted, the hook still records _something_ (e.g., a `status` event with `metadata.mechanical_reformat = true` and the file count) so retrospectives can see how often the carve-out fires and whether it's masking a real problem.

## Out of scope

- Splitting the rule into per-language thresholds.
- Auto-splitting the commit (some teams may want a "split this for me" tool — that's a separate ask).
- Anything about the resolves-link rate. We're separately working on that elsewhere.

## Contact

If the implementer wants more context on the kind of repo this rule fired against, the test corpus is the AJE PoC monorepo (Astro 6 + Qwik 2 beta + Deno mock-api). Sample commits from the retrospective:

- `da40110 style(qwik): apply prettier to source + config (8 files)` — 8 files, just under threshold (good case)
- `e1cc0ea style(astro): apply prettier across apps/astro` — 6 files
- `34b845e docs: prettier-format root-level docs + json` — 5 files

The two flagged commits (14- and 13-file) were earlier whole-repo passes that we manually split before pushing; their current SHAs are no longer in `git log`. The SMM concerns (`b63bd72d90d8`, `624d36c6a876`) remain as evidence in the event stream of the host repo.
