# Bug report: spawn_teammate.py crashes when --story-id is passed (ModuleNotFoundError: \_append_impl)

**Plugin:** `xp-agents` (cached at `~/.claude/plugins/cache/xp-agents/xp-agents/2.25.0/`)
**Location:** `scripts/worktree.py:111` — `from _append_impl import write_text_atomic`
**Reporter:** AJE PoC, sprint-004 kickoff (2026-04-22)
**Linked decision:** SMM event `cb19d843d7c9` (the concern that captured this bug at the moment it surfaced)

## Current behavior

`spawn_teammate.py` crashes with `ModuleNotFoundError: No module named '_append_impl'` whenever `--story-id` is passed. Without the flag, the spawn proceeds normally.

## Reproduction

Exact command that triggered the bug (from `/xp-assign` skill orchestration):

```bash
SMM=/Users/paulingalls/.claude/plugins/data/xp-agents-xp-agents/bce1d9c11420/smm
PLUGIN_ROOT=/Users/paulingalls/.claude/plugins/cache/xp-agents/xp-agents/2.25.0

python3 $PLUGIN_ROOT/scripts/spawn_teammate.py \
  --name teammate-story-003 \
  --smm-dir $SMM \
  --prompt-file /tmp/prompt-story-003.txt \
  --story-id story-003
```

## Stack trace

```
Traceback (most recent call last):
  File "/Users/paulingalls/.claude/plugins/cache/xp-agents/xp-agents/2.25.0/scripts/spawn_teammate.py", line 124, in <module>
    main()
  File "/Users/paulingalls/.claude/plugins/cache/xp-agents/xp-agents/2.25.0/scripts/spawn_teammate.py", line 110, in main
    write_story_assignment(Path(args.smm_dir), name, args.story_id)
  File "/Users/paulingalls/.claude/plugins/cache/xp-agents/xp-agents/2.25.0/scripts/spawn_teammate.py", line 81, in write_story_assignment
    worktree.write_story_assignment(smm_dir, name, story_id)
  File "/Users/paulingalls/.claude/plugins/cache/xp-agents/xp-agents/2.25.0/scripts/worktree.py", line 111, in write_story_assignment
    from _append_impl import write_text_atomic
ModuleNotFoundError: No module named '_append_impl'
```

## Why this matters

- **Blocks the documented `/xp-assign` worktree-subagent flow.** That skill's instructions explicitly tell the orchestrator to pass `--story-id story-NNN` so the spawn writes a `.story-assignment-{name}` marker for commit attribution. Following the skill's documentation produces a crash.
- **Forced solo-sequential fallback.** In sprint-004 we lost commit-to-story attribution for stories 001/003/004 because we couldn't spawn worktree teammates without the flag. This sprint's commits are correctly attributed via SMM event recording, but the automatic mechanism the skill documents was unusable.
- **Silent partial failure earlier.** Before identifying the bug, the spawn was launched in the background by `/xp-assign` and reported back as "failed exit 1" with `"No result event in 13 stream-json lines"` from the output filter. The worktrees DID get created (Claude subprocess started) but the script crashed BEFORE it could attach the story-id marker — leaving 4 orphan worktrees on disk that had to be `git worktree remove --force`'d manually.

## Symptoms a user/agent will see

1. Background `spawn_teammate.py` process exits 1 immediately.
2. `teammate_output_filter.py` output reads `No result event in 13 stream-json lines (no block detected)` — entirely opaque about the actual cause.
3. A worktree IS created at `.claude/worktrees/teammate-<name>/` with a branch of the same name. Cleanup requires manual `git worktree remove --force` + `git branch -D`.
4. Without `--story-id` the spawn works — masking the issue if anyone tries the simpler invocation first.

## Suggested fix (without seeing the source)

Two likely candidates:

1. **Bare-`from`-import resolution gap.** `worktree.py:111` does `from _append_impl import write_text_atomic` — this assumes `_append_impl` is importable as a top-level module in `sys.path`. It's probably a sibling file in the same `scripts/` directory. The fix is either:
   - Make the import package-relative: `from .\_append_impl import write_text_atomic` (requires `scripts/` to be a package — add `__init__.py` if missing).
   - Or insert the script directory into `sys.path` at the top of `worktree.py` before the import.
2. **Missing module in the published package.** If `_append_impl.py` exists in the source repo but didn't get included in the published plugin tarball, the fix is on the packaging side — add it to the manifest.

A quick `ls scripts/_append_impl*` in the plugin source would disambiguate.

## Acceptance criteria

1. `python3 scripts/spawn_teammate.py --name X --smm-dir Y --prompt-file Z --story-id story-001` exits 0 and creates a worktree with the `.story-assignment-X` marker file.
2. The same call without `--story-id` still works (no regression).
3. If `_append_impl` is genuinely missing, packaging tests catch it before publish.
4. The error message (when something else does fail) is clearer than `No result event in 13 stream-json lines`.

## Out of scope

- The `/xp-assign` skill's own behavior (assumes `spawn_teammate.py` works as documented).
- Cleanup of orphan worktrees from past failures (manual recovery is acceptable; bug-fix prevents future cases).

## Contact / validation

Plugin path: `/Users/paulingalls/.claude/plugins/cache/xp-agents/xp-agents/2.25.0/`
Crash file + line: `scripts/worktree.py:111`
SMM event for context: `cb19d843d7c9` in `/Users/paulingalls/.claude/plugins/data/xp-agents-xp-agents/bce1d9c11420/smm/events.jsonl`
Reproducer: any project with the plugin loaded; pass `--story-id` to `spawn_teammate.py` with any string.
