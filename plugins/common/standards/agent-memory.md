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
