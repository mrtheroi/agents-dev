---
name: batch-review
description: >-
  Orchestrator playbook for reviewing a wide diff (many changed files) by
  fanning out a code-reviewer subagent across folder-scoped batches instead of
  one subagent per file. Picks the installed stack-specific *-code-reviewer
  when the repo has one, falling back to the generic common pr-reviewer
  otherwise. Use when a working-tree diff, staged change set, or PR is too
  large for a single reviewer pass to hold in context comfortably — decides
  which reviewer to use, when to stay inline vs. batch, how to group files by
  directory under a line-budget cap, and how to merge each batch's findings
  into one deduplicated report.
---

# Batch code review (orchestrator playbook)

The unit of delegation is **how much related context a reviewer needs**, not
**how many files changed**. One subagent per file loses cross-file bugs (a
renamed function whose caller lives in another file) and multiplies overhead
for no benefit. This skill only fans out when the diff is genuinely too wide
for one reviewer pass, and when it does, it groups by folder/module first so
each subagent still sees related changes together.

## Universal orchestration rules

<!-- @include plugins/common/standards/orchestration.md -->
## Orchestration (universal)

You are the **orchestrator** (the main model). Subagents do the heavy, context-hungry
work in isolation; you decide *when* to delegate, keep the shared state coherent, and
stay accountable for cost. These rules hold for every stack — a plugin's skill layers
its specifics (which agents, which merge scripts, which gates) on top.

### When to fan out vs. stay inline

Delegate to a subagent when **any** of these is true; otherwise do it inline:

- **Heavy context** — the unit of work drags in large inputs (a big Figma JSON, a
  cloned repo, a wide diff, a long file) that would bloat your context and crowd out
  everything else. Isolation keeps that mass out of your window.
- **Independent units** — the task splits into N pieces that don't depend on each
  other's intermediate state (one screen, one resource, one IA domain, one file).
- **Parallelism pays** — those units can run concurrently and the wall-clock saving is
  real.

Stay inline for trivial, tightly-coupled, or inherently-sequential work: spinning up a
subagent has real overhead (its own context, its own tokens), so a one-liner or a step
that needs your running state is cheaper done directly. **More agents is not better —
each one costs tokens and latency.** Fan out for leverage, not reflex.

### One unit of work per subagent

Give each subagent exactly one well-scoped job and everything it needs to finish it
end to end. Don't make one agent do three screens; run three agents. A subagent must
**return a compact, structured result** (JSON or a short summary + the handles you need
next) — never a raw dump of what it read. The big inputs live and die in *its* context;
only the conclusion crosses back to you.

### Parallel fan-out, serial merge (never race on shared files)

Subagents running in parallel must **never write the same shared file** — i18n
catalogs, a navigator/router, a manifest, an index, a shared config. Concurrent writes
lose updates. The rule:

1. Fan out the isolated, independent work in parallel.
2. Each subagent **returns** what needs to land in the shared file (e.g. new i18n keys,
   route props, a manifest hash) — it does **not** edit it.
3. **You** apply those to the shared file **serially**, at a barrier after the batch,
   using the plugin's merge script when one exists (a surgical insert, not a rewrite).

Skip the serial merge and you get lost keys, clobbered routes, or a corrupt index.

### Gates — stop and wait, never auto-advance

When the flow has an approval or human-decision checkpoint (a BO sign-off, a "which
domain?" choice, a destructive publish), **halt and wait for the explicit go-ahead**.
Do not infer approval, batch past a gate, or take an irreversible/outward-facing action
(push, publish, delete, external write) on your own initiative. Present the result in
the audience's language and let them decide.

### Fail one, not all

A subagent that fails or returns nothing must not sink the batch. Collect the
successes, report the failures by name with why, and **never merge partial garbage** into
a shared file. Let the developer decide whether to retry the failed units — don't
silently drop them.

### Be accountable for cost and provenance

Delegation is measurable, so make it visible:

- Each subagent ends with the telemetry footer from the **subagent contract**; the
  observability plugin logs `SUBAGENT_LAUNCH` / `SUBAGENT_STOP` with `duration_ms` and,
  when the platform exposes it, `tokens`. Surface per-subagent provenance in your reply
  (which agent, one-line task, tokens/time from its `Task` card) so a batch's cost is
  never a black box.
- **Bound the fan-out.** Cap how many units you dispatch at once; if you process only a
  top-N slice of a larger set, **say so** — silent truncation reads as "covered
  everything" when it didn't.
- If an agent turns out slow or token-heavy across runs (see `/ai-logs` and
  `/improve-suggest`), that's a signal to tighten its scope or trim its composed
  context — feed it back into the improvement loop, don't just pay it every time.
<!-- @end plugins/common/standards/orchestration.md -->

## Step 1 — Pick the reviewer agent (once, for the whole run)

Every stack plugin in this marketplace ships its own `<stack>-code-reviewer`
(`nest-code-reviewer`, `react-web-code-reviewer`, `rn-code-reviewer`,
`net-code-reviewer`, …) — these `@include` the full `code-review.md` doctrine
(security, architecture, severity grouping) *plus* stack-specific rules that
the generic `pr-reviewer` doesn't have. Prefer them:

1. Look at your available agent types for one matching `*-code-reviewer` whose
   stack matches this repo (e.g. a NestJS repo → `nest-code-reviewer`).
2. **Exactly one match** → use it for every batch in this run.
3. **No match**, or the repo is genuinely mixed-stack with more than one
   plausible reviewer → fall back to the generic `pr-reviewer`. Don't guess
   between two equally-plausible stack reviewers.
4. Use the **same** reviewer for every batch in a run — never mix reviewers
   batch to batch, or findings become inconsistent in severity/format.

Name the picked reviewer in the final coverage line (Step 5) — and see the
**Reviewer visibility** note below: every `Task` call you make from this skill
must say, in its own description, which reviewer this is and why.

## Reviewer visibility (dev-facing, no new tooling needed)

Claude Code already surfaces every `Task` launch to the dev on its own card,
showing the call's `description` along with the agent name, tokens and duration.
That already tells the dev which reviewer ran and on what, **as long as the
description says so**. Don't build a separate log for this; just write
descriptions worth reading:

- Inline (Step 2, single pass): `"<reviewer> — single pass review, <N> files"`.
- Each batch (Step 4): `"<reviewer> — batch <i>/<n>, <fileCount> files (~<lines> lines)"`.

If the consumer's setup adds its own subagent logging, these descriptions are what
it records — so they are the only change needed for the dev to see which reviewer
got picked and on what slice of the diff.

## Step 2 — Measure the diff, decide inline vs. batch

Get the scope exactly as the picked reviewer would: staged changes by default
(`git diff --cached --numstat`), or the range/files the user named. `--numstat`
gives `<added>\t<deleted>\t<path>` per file — use it to get file count `N` and
total changed lines `L` (sum of added+deleted) without reading any content yet.

**Stay inline** if `N ≤ 10` and `L ≤ 600`: delegate exactly **one**
`Task(<picked reviewer>)` for the whole diff, same as a normal review, with
the description from **Reviewer visibility** above. Batching a diff that
already fits in one pass only adds overhead — don't.

**Batch** otherwise — continue to Step 3.

## Step 3 — Group files into batches (folder-first, size-capped)

1. Group the changed files by directory (top-level module, or top two path
   segments in a monorepo) so files that likely share context land in the
   same batch.
2. Sum `added+deleted` per directory group.
3. Pack groups **in order** into batches under a **~500-line budget**: keep
   adding whole groups to the current batch while the running total stays at
   or under budget; when the next group would push it over and the batch is
   non-empty, close the batch and start a new one.
4. Only split a *single* directory across batches if that directory **alone**
   exceeds the budget — then split just that directory's files (largest
   first) into as few sub-batches as needed. Never split a directory that
   fits, even if doing so would balance batches more evenly.
5. Cap the batches dispatched **at once** at 8 (bound the fan-out — see the
   orchestration standard above). If grouping produces more than 8 batches,
   run them in waves of ≤ 8 and say so explicitly before starting — never
   truncate silently.

## Step 4 — Fan out, one Task per batch with the picked reviewer

Dispatch one `Task(<picked reviewer>)` per batch, in parallel (same message,
one tool-call block per batch). Give each one:

- A `description` following **Reviewer visibility** above — this is what the
  dev sees live and in the log, so don't leave it generic.
- The explicit list of files in **its** batch.
- An instruction to review only those files, though it may `Read` other files
  in the repo for context (a shared type, an interface, a caller) — it must
  not report findings on files outside its own list, since another subagent
  already owns those.

## Step 5 — Merge serially into one report

Findings are read-only text, not a shared file write, so there is no race —
but you still merge **serially and yourself**, not by concatenating blindly:

1. Collect every batch's report. A batch that errors or returns nothing is
   recorded as failed **by name** — never silently dropped (fail one, not
   all). Offer to retry just that batch.
2. Merge all findings into **one** list, re-grouped by severity
   (Critical / Major / Minor) instead of by batch.
3. Dedupe: two batches occasionally flag the same cross-boundary issue from
   opposite sides (e.g. both call out a signature mismatch between a caller
   in batch A and the callee in batch B) — keep one instance, pointing at
   both locations.
4. Close with one coverage line: **which reviewer agent was used** (Step 1),
   how many files were reviewed, how many batches/subagents ran (and in how
   many waves, if more than one), and any failed batch by name. Then the
   usual verdict (`✅` / `⚠️ N issues` / `❌ N bugs`).

## Output format

Same shape as a normal review: a prioritized markdown list, one entry per
finding as `path/to/file:line` — severity — what's wrong and the fix — plus
the Step 5 coverage line and verdict. No per-batch sub-reports in the final
message; the batching is an implementation detail, the user sees one report.
