# File-domain template doctrine

**Status:** Adopted at sprint-013 kickoff (Try `8f567b5121a4`, 5th-carry).

## The problem

The `file_domain` field on a story declares which files the agent is allowed
to touch. It exists to keep agent scope tight and make conflict-detection
cheap. Cascade-size budgeting is also computed against `file_domain` —
over-declaring weakens that gate.

For three consecutive sprints, the agent has expanded `file_domain` mid-flight
via an `assumption` event when a prior-concern cleanup forced an edit outside
the declared set:

| Sprint | Assumption event | What got carved in                                  |
| ------ | ---------------- | --------------------------------------------------- |
| 011    | `86a2ec1903ae`   | cascade-budget precedent                            |
| 012    | `98b9424726cc`   | throughput.ts JSDoc + test (concern `da9c2c3cfd0c`) |
| 012    | `2168fdbbf01b`   | CSP collector files for story-004                   |
| 012    | `25649b465732`   | embed sanitizer files for story-004                 |

Three sprints of the same expansion pattern means the **template is wrong**,
not the agent.

## The rule

When `/xp-sprint-start` (or `/xp-plan` when promoting a milestone) writes a
story, the planner MUST scan adopted concerns and open debts whose `files`
field overlaps the story's likely change zone, and include those files
explicitly in `file_domain` at story-creation time.

> If the prior-concern cleanup is in scope (and it usually is — that's why
> we adopted the concern), declare it. If it's not in scope, defer the
> concern in `/xp-work-selection` and don't pull it into the story by accident.

## How to apply

1. At sprint-start, after listing the milestone's primary change zone, query
   the SMM for open adopted concerns/debts via `/xp-work-selection`.
2. For each adopted item whose `files` array overlaps the story's likely
   change zone, add those exact paths to the story's `file_domain`.
3. Record the cleanup as acceptance criteria — it's shipped work, not a
   drive-by edit.
4. Do not rely on a mid-flight `assumption` event to carve in cleanup files
   that were knowable at story-creation time. Assumptions are for genuine
   discoveries (something the planner couldn't have known); pre-adopted
   debts are not discoveries.

## Validation

The artifact for this Try is **either**:

- Zero file_domain-expansion `assumption` events in sprint-013 onward, **or**
- A subsequent doctrine update that explains why expansion-on-the-fly is
  preferable (i.e. this rule was wrong).

Track both outcomes — if expansion keeps happening despite the rule, the
rule isn't the right intervention.

## Related

- Cascade-size budget: decision `86a2ec1903ae`
- Original Try: `8f567b5121a4` (5th-carry as of sprint-013 kickoff)
- Prior expansion concerns: `da9c2c3cfd0c`, `2168fdbbf01b`, `25649b465732`
