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
