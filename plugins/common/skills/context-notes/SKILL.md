---
name: context-notes
description: >-
  Orchestrator playbook for leaving a finding behind in the consumer repo so the
  next person — or the next session — does not re-derive it. Use when a change is
  finished and something was learned that the code does not say: why an obvious
  fix was deliberately not applied, a trap that looks like a bug and is not, a
  dead end already investigated, or a mental model the repo quietly contradicts.
  Covers the bar for what earns a note, the format, how a note is found again by
  grep rather than by reading a folder, and what must never be written into a
  store the whole team can read. Not for recording activity — the diff and the
  PR already do that.
---

You are the orchestrator. A change just finished. This decides whether anything
learned along the way should outlive the session, and how to write it so it is
found again cheaply.

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

<!-- @include plugins/common/standards/agent-memory.md -->
## Memory (universal) — the orchestrator's job, never the subagent's

Work that is not written down is work the next session repeats. These rules say what
to persist, what must never be persisted, and how much to trust what comes back.

### The subagent never writes to memory

A subagent that declares a memory tool its environment does not provide **does not
load at all** — there is no graceful degradation, no partial start, just a spawn that
fails. Since a plugin runs in repos you will never see, no subagent here may carry
that dependency.

So memory follows the same shape as the fan-out rule: **the subagent returns, the
orchestrator records.** You are the one process that can see which tools actually
exist, and the one that already merges shared state serially.

### Detect a backend, never require one

Look at the tools you actually have. If one of them persists and recalls across
sessions, use it. If none does, **the final report is the memory** — say so in one
line at the end, so the human knows nothing outlived the session and can decide where
to put it. Do not invent a store: writing a file into the consumer repo to fake one
dirties a repo that never asked for it.

### What is worth recording

- **Decisions, with the reason.** A decision without its why is trivia — nobody can
  reopen it safely later.
- **Findings that survived**, and the ones you rejected with why you rejected them.
  The rejections are what stop the next pass from re-raising them.
- **What you already verified**, so the next run does not re-derive it.
- **Where** — real paths, so a claim can be checked.

Not transcripts, not whole diffs, not file contents. A memory that stores the artifact
instead of the conclusion is a slower way to read the repo.

### What must never leave the consumer repo

A memory store may be shared, synced, or read by people who never had access to this
code. Treat every write as if it will be.

**Never record**: secrets, credentials, tokens or keys — not even redacted, not even
"as an example"; personal or customer data; internal hostnames, addresses, or private
endpoints; proprietary source pasted in wholesale; anything the repo's own
documentation marks confidential.

**Record the shape, not the payload.** A credential literal at `src/config.py:42` is
the finding. The credential is not. The same rule the security checklist applies to
logs applies here, for the same reason and with a longer blast radius.

### Recall before you spawn

Before fanning out over an area, check whether it was already looked at. A subagent
you did not need to launch is the cheapest subagent there is, and re-reporting a
finding the team already dismissed costs more than tokens — it costs trust in the
report.

### What comes back is a claim, not a fact

A memory was true when it was written. The code has moved since; nobody updated the
note. So it ranks **below the code**, exactly like a project's own documentation: if a
memory names a file, function, flag, or command, confirm it still exists before you
act on it.

When a recalled memory turns out to be stale, say so plainly — and correct it if your
backend allows, so the next session does not pay the same toll. A stale memory
presented as current is worse than no memory, because it carries false confidence.

### Write it so a stranger can use it

The reader is a future session with none of your context. Name the project, say what
changed and why, give the paths, and note what you deliberately did **not** do. If you
would have to be in this conversation to understand the note, rewrite it.
<!-- @end plugins/common/standards/agent-memory.md -->

## Step 1 — Decide whether there is anything to write

Most changes leave nothing. That is the normal outcome, and writing a note anyway is
how a notes folder becomes something nobody reads.

**The bar: record findings, not activity.**

| Not a finding | A finding |
|---|---|
| "bumped the versions and regenerated the catalog" | "this counter reports 0 because the statement measures the previous UPDATE, not the INSERT" |
| "added the endpoint and its tests" | "we know this is wrong; we deliberately left it until the module is ported by hand" |
| "refactored the service" | "the obvious cache invalidation looks like a bug — the payment provider requires it" |

A useful test: **will someone re-derive this, and lose hours doing it?** If the answer
is no, the diff and the PR description already cover it.

Four shapes almost always earn a note:

- **A decision not to act.** Someone will find the same defect, think it is a two-minute
  fix, and undo a plan they never saw. This is the single highest-value note there is.
- **A trap** — code that reads wrong and is right, for a reason outside the file.
- **A dead end already investigated.** "We tried X; it deadlocked under load."
- **A mental model the repo contradicts** — "this table is not where you think it is".

## Step 2 — Find out where the repo keeps them

Do not impose a location. Look for an existing convention: a folder of markdown with a
`triggers:` / `covers:` frontmatter, decision records, ADRs, or whatever the project's
`CLAUDE.md` names. Use what is there.

If the repo has no convention and the change genuinely produced a finding, `docs/context/`
with one file per finding is a reasonable default — but say you are introducing it, in
the PR, rather than creating a folder silently.

## Step 3 — One finding, one file

Never append a second finding to an existing note. One file per finding is what makes
this cheap on both ends:

- the reader pays for the one finding they need, not for the area's whole history;
- two people working on different things never touch the same file, so there is nothing
  to merge.

If a finding evolves — the decision is revisited, the trap is fixed — **rewrite that
file**. The filename is the identity of the finding, not a timestamp.

## Step 4 — Write it so grep finds it

```markdown
---
triggers: [symbolName, "exact error text", symptom]
covers: [src/area/**, path/to/specific/file.ext]
verified: YYYY-MM-DD
---

# The finding stated as a conclusion, not as a topic

**What** — what is actually true, in one or two sentences.

**Why** — the mechanism. Why it behaves this way, not just that it does.

**Learned** — the transferable part: what this costs, what to do instead, and what
was deliberately *not* done.

Evidence anyone can repeat: the command, the query, the observed output.
```

**`triggers` is the field that gets used.** Nobody thinks "I will look in the CI config";
they hit `GH013` and search for that. Put the symbols, error strings and symptoms that
bring someone here — not a description of the topic.

**Title the finding as a conclusion.** "Counter reports 0 because ROW_COUNT measures the
UPDATE" is findable and settles the question at a glance. "Notes on the invoice
procedure" is neither.

**Anchor to symbols, never to line numbers.** `file.ts:42` is wrong after the next edit,
and a note with wrong coordinates poisons more than it helps. Name the function, the
constant, the query — those survive the file moving.

**Date it and cite evidence.** `verified:` plus a command and its output is what lets a
reader decide whether to trust the note or re-check it. An undated claim ages invisibly.

## Step 5 — What must never go in

A note lives in the repo, so **anyone with repo access can read it, now and forever**,
and in a public repo that means everyone. This is not hypothetical: an unfiltered memory
export of ordinary working notes was found to contain an employer address, a colleague's
private key name, and the name of an unrelated private repository.

**Never write**: secrets, credentials, tokens or keys — not even redacted, not even as an
example; personal or customer data; internal hostnames, addresses or private endpoints;
the name of another organisation's private repository; anything the project's own
documentation marks confidential.

**Record the shape, not the payload.** "A credential literal sits in the config loader"
is the finding. The credential is not. The same rule the security checklist applies to
logs applies here, with a longer blast radius — a log rotates, a repo does not.

## Step 6 — Ship it inside the change

The note belongs in the same PR as the code it describes. That is what keeps it honest:
it gets reviewed like code, and a reviewer who knows better corrects it before it can
mislead anyone.

A note merged separately, later, is a note nobody reviewed.
