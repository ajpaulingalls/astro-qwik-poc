# Feature request: split retro `status_summary` into transient bookkeeping vs real signals

**Plugin:** `xp-agents` (cached at `~/.claude/plugins/cache/xp-agents/xp-agents/2.37.1/`)
**Rule location:** retrospective digest computation — exact file unconfirmed; the symptom is observable in `xp-retrospective` agent output and in `smm/retrospectives/*.json` records.
**Reporter:** AJE PoC, sprint-013 retrospective (2026-05-01)
**Linked retro Try:** SMM event `78bdecc92520`

## Current behavior

The retrospective agent computes a single concern-resolution-ratio (and related counters) over **all** events tagged as concerns or resolutions, regardless of source. Two example digests this PoC has seen:

- sprint-012 close: "concern resolution: 22/22 (100%)"
- sprint-011 close: similar headline, ~85-100%

Both numbers were inflated. In each case roughly half of the "resolutions" were transient lint or test-status events that opened and closed within minutes of each other during normal edit cycles, not real concerns surfaced by reviewers or commit-gate analysis.

## What we're seeing

The headline is structurally optimistic. From the sprint-013 retrospective Fix list:

> Concern-resolution headline (22/22) still inflated by ~10 transient lint/test status auto-closes vs ~12 real concerns from reviewers + commits. Real signal closer to 12/12.

This has been flagged in two consecutive retrospectives. The Try has been deferred once and is at risk of being ignored if not surfaced as a separate request.

### Why a single ratio is the wrong metric

1. **Different sources have different latency characteristics.** A reviewer's concern lives for hours-to-days before resolution; a per-write lint concern lives for seconds-to-minutes. Lumping them together makes the high-volume-low-latency stream dominate.
2. **The metric drives the wrong behavior.** A 100% resolution headline trains the agent (and the customer) to trust that "all concerns are addressed." If that's a 100% of {real signals + bookkeeping noise}, it could mask a real reviewer concern that didn't get resolved while 20 transient auto-closes pad the denominator.
3. **The lint-boundary fix (separate proposal at `docs/feature-requests/lint-check-pre-commit-boundary.md`) reduces but does not eliminate the problem.** Even with lint moved to commit-time, test-status events and other ephemeral status mutations still flow through the same counter. The split is the proper fix; the lint move is one source of pressure relief.

## What we want

Two separate ratios in the retrospective digest, with both shown to the user:

| Ratio                                | Sources counted                                                                                                                                                          | Purpose                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| **Real-signal resolution**           | reviewer concerns (xp-code-reviewer, xp-plan-reviewer, xp-close-reviewer, xp-security-reviewer); commit-gate concerns from `bash_post_tool.py`; manually-raised concerns | The number to actually act on.                |
| **Transient bookkeeping resolution** | `lint_event` auto-resolutions, `test_event` auto-resolutions, file-write-status closes, any concern whose `source_agent` is the post-tool hook layer                     | Health check on hook noise; secondary metric. |

### Comparison

| Case                                                                          | Today          | Desired                                 |
| ----------------------------------------------------------------------------- | -------------- | --------------------------------------- |
| Sprint with 12 reviewer concerns, all addressed                               | "12/12 (100%)" | "Real: 12/12 (100%) / Transient: 0/0"   |
| Sprint with 12 reviewer concerns + 10 lint auto-closes                        | "22/22 (100%)" | "Real: 12/12 (100%) / Transient: 10/10" |
| Sprint with 12 reviewer concerns, 10 transient, 1 reviewer concern unresolved | "21/22 (95%)"  | "Real: 11/12 (92%) / Transient: 10/10"  |

The third row is the failure mode the current single-ratio hides: 95% looks good, 92% on real signal looks meaningfully different.

## Suggested implementation

The split is data-classification, not new measurement. Recommended approach:

1. **Tag every concern event with a `category` at write time.** Add a `metadata.category = "real" | "transient"` field on `concern` events. The `source_agent` already exists; the categorization is a lookup table:
   - `xp-code-reviewer`, `xp-plan-reviewer`, `xp-close-reviewer`, `xp-security-reviewer`, `xp-housekeeper`, manually-appended via `append.sh` → `real`
   - `bash_post_tool` (lint hook, test hook, file-write hook), `pre_tool_*` hooks → `transient`

2. **Update the retro digest computation to compute both ratios.** Existing single ratio derives from event scan; just bucket by category before counting.

3. **Backward-compat for old events.** Events without `metadata.category` get classified by `source_agent` heuristic at read time (so historical retrospectives also benefit).

4. **Render both ratios in retro output.** Both in the structured JSON and the human-readable Markdown digest.

## Acceptance criteria

The implementer can consider this done when:

1. **Both ratios appear in the retro digest.** The next session retrospective for any active SMM shows two separate ratios per the table above, in both the JSON record and the rendered Markdown.
2. **Categorization is deterministic.** Running the digest twice on the same SMM produces identical category assignments.
3. **No double-counting.** A concern that closes itself via auto-resolution counts in exactly one category — not in both.
4. **Tests cover the matrix.** New tests cover: all-real, all-transient, mixed, and the failure-mode third row above (real-signal regression hidden behind transient noise).
5. **Schema migration documented.** The `metadata.category` field's allowed values + the source-agent → category mapping is documented in the plugin's events schema doc (or wherever event types are documented today).

## Out of scope

- Removing transient events entirely (the lint-boundary proposal is the right fix for that).
- Changing what counts as a "concern" vs a "status."
- Aggregating the two ratios back into a composite — keep them separate and let the reader form a judgment.

## Telemetry

A `retro_metadata.real_signal_ratio` and `retro_metadata.transient_signal_ratio` on each retrospective record would let cross-session analysis track how the two ratios drift independently over time. Useful for spotting "transient ratio is dropping but real ratio is also dropping" — a hook-noise problem hiding a real-signal degradation.

## Contact

The retro analyzer that produces the affected output is `xp-agents:xp-retrospective` (subagent). The host repo for this PoC is the AJE PoC monorepo. Sprint-013 retrospective JSON is at `~/.claude/plugins/data/xp-agents-xp-agents/bce1d9c11420/smm/retrospectives/2026-05-01T15-36-32.json` and shows the headline-vs-real divergence cited above.
