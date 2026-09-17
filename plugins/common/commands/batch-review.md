---
description: Review a wide diff (many changed files) by fanning out pr-reviewer across folder-scoped batches.
---

Load the `batch-review` skill, then apply it to the current diff.

Usage: `/batch-review` (defaults to staged changes) or `/batch-review <base-ref>`
(e.g. `/batch-review master...HEAD`) to review a range instead — `$ARGUMENTS`
is that optional range/file scope.

For a normal-sized diff this ends up as one `Task` call to whichever reviewer
the skill picks (the repo's stack-specific `*-code-reviewer` if one is
installed, else the generic `pr-reviewer`), same as reviewing directly — the
skill only batches when the diff is genuinely too wide for a single pass.
Don't spawn one subagent per file; the skill's folder-first, size-capped
grouping is what decides batch boundaries.
