# Stage explicitly before invoking review skills

**Status:** Adopted at sprint-013 kickoff (concern `025b693508ac`).

## The problem

Sprint-012 hit a process honesty slip: a review prompt asserted that all
relevant files were staged, but `git status` showed the index empty — every
edit was working-tree only. Code and tests were correct; reports landed; the
behavior was right. But the reviewer was working from a different "set of
files I'm reviewing" than what the operator described, and that gap erodes
the value of the review.

## The rule

Before invoking `/simplify`, `/xp-quality-review`, or `/xp-security-triage`,
explicitly stage the files the prompt describes:

```bash
git add <files-described-in-prompt>
```

Then run the review skill. Staging is **not** a filter on what the
reviewer sees — the skills see staged + unstaged + untracked together
(the preload surfaces all three). Staging is a contract between the
operator's prose ("I'm reviewing X, Y, Z") and what's actually about
to commit. If the prose says "all staged" and `git status` shows an
empty index, the contract is broken even if the code is correct.

## How to apply

1. After landing tests-green, decide which files belong in the commit.
2. `git add <those-files>` explicitly. Do not use `git add .` or `git add -A`
   — those can sweep in unintended files (test artifacts, .env, generated
   reports) that would land in the commit and the review.
3. `git status` to confirm the staged set matches what you intend to commit.
4. Run the review cycle (`/simplify` → `/xp-quality-review` →
   `/xp-security-triage`). Each reviewer sees the staged diff.
5. Commit. The pre-commit hook re-runs lint + typecheck on the staged set.

## Why not stage at the end?

Two reasons the explicit-up-front pattern is better:

- **Operator honesty**: the prose the operator hands the reviewer ("here's
  what I changed") matches `git status`. No "you said all staged but the
  index is empty" gap that erodes trust in subsequent reviews.
- **Discovery friction**: deciding the staged set up-front forces a deliberate
  "what belongs in this commit?" pause. Doing it at the end is more likely
  to sweep in unintended files (generated reports, test artifacts) that the
  review already passed.

## When this rule does not apply

- **Plan mode**: no commits happen, no review cycle runs.
- **Pure SMM event appends** (Commit 0 of this triage was an `append.sh`
  call, no git commit) — no files to stage.
- **Pre-commit hook fixups**: if the hook auto-fixes formatting, re-staging
  the fixup file is fine; the review already ran on the substantive set.

## Related

- Source concern: `025b693508ac` (sprint-012 review prompt asserted "all
  staged" with empty index)
- Triage event: `da52d83e268f` (adopt-now decision at sprint-013 kickoff)
