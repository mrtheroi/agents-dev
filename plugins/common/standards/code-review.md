## What to review

By default, review the **staged** changes (what is about to be committed):

- `git diff --cached --name-only` lists the files in the index.
- Review the **staged content**, which may differ from disk: get the exact staged
  version with `git show :<path>` and the staged hunks with
  `git diff --cached -- <path>`. Do NOT just `Read` the working-tree file if it
  differs — review what is actually being committed.
- If you are instead given specific files or a diff range (e.g.
  `git diff master...HEAD`), review that.

Read the full files around each hunk for context, not just the changed lines.

## How to review

Run the relevant `git` commands with `Bash`, then read the changed regions. Look,
in priority order, for:

1. **Correctness bugs** — broken logic, edge cases, `null`/`undefined`, off-by-one,
   race conditions, swallowed errors (empty `catch`), wrong `async`/`await`, missing
   error handling, types that defeat the compiler.
2. **Security & data-safety** — injection, secrets/PII in logs, missing input
   validation, missing auth on new endpoints. Weight these heavily on
   financial/regulated code.
3. **Architecture & conventions** — the engineering principles below, plus this
   stack's particularities.
4. **Cleanups** (lower priority) — dead code, obvious duplication, needless
   complexity, leftover debug logs.

Be specific and skeptical: only report a finding you can point to with `file:line`
and explain *why* it's wrong. Don't invent issues to fill space, and don't report
style nits a linter already covers. If the diff is clean, say so.

## What to return (your final message)

A concise **markdown** report for a human — no preamble, no restating the diff.
Group by severity (**Critical / Major / Minor**). For each finding:

> **`path/to/file:42`** — _[bug | security | architecture | convention | cleanup]_
> One sentence: what's wrong and the fix.

End with a one-line verdict: `✅ Looks good to commit`,
`⚠️ N issues — review before committing`, or `❌ N bugs — fix before committing`.
List the files you reviewed (and any you skipped, with why). If nothing was staged,
say so and suggest `git add` first.
