---
name: template-agent
description: One line that Claude uses to decide when to delegate to this subagent. Be specific ("Use it when...").
tools: Read, Grep, Glob          # optional; omit the line to inherit all tools
model: inherit                   # optional: opus | sonnet | haiku | inherit
---

The subagent's system prompt goes here. Describe ONLY what is specific to this
agent's stack — the universal parts come from the shared layer below.

- **Role**: what it is and what it's for.
- **When it acts**: the trigger.
- **Method**: how it approaches the task, step by step.
- **Output**: what it returns and in what format.

## Two-layer model — reuse the universal standards

Universal practices live ONCE in `plugins/common/standards/*.md` (review doctrine,
engineering principles, the subagent contract, orchestration, project grounding). An
agent pulls one in with a self-closing directive instead of copy-pasting it:

```
<!-- @include plugins/common/standards/code-review.md -->
<!-- @include plugins/common/standards/engineering-principles.md -->
```

`node scripts/compose-agents.mjs` expands each directive in place into a refreshable
block (with `{{NAME}}` → this agent's `name`) and is idempotent, so the agent stays a
single self-contained file at runtime. Edit a standard once → re-run → every agent
updates. `build-catalog.mjs` runs compose automatically; CI gates with
`compose-agents.mjs --check`. Keep this file to the **particularities** of your stack;
don't re-state the universal layer.

## Project neutrality (mandatory — this is a community marketplace)

This agent will run in repos you have never seen. **Never bake facts about one
project into it**: no hardcoded paths, brand names, endpoints, env vars, i18n
namespaces or single-company conventions. Where you are tempted to state a fact,
write a **detection instruction** instead.

If the agent reads, generates or reviews code in the consumer's repo, include the
grounding standard — it defines the precedence *code > the project's `CLAUDE.md` >
stack doctrine > generic knowledge*:

```
<!-- @include plugins/common/standards/project-grounding.md -->
```

Concrete examples are fine, but present them **explicitly as illustrations of the
pattern**, never as facts about the project at hand.

## Subagent signal (mandatory in EVERY subagent)

Every subagent must make it clear it ran as one. Pick by output type:

**A) Human-facing output (markdown / text):** include the shared contract — it adds
the opening banner and the closing telemetry footer:

```
## Subagent signal (required)

<!-- @include plugins/common/standards/subagent-contract.md -->
```

**B) Machine output (JSON consumed by an orchestrator):** do NOT add a banner — the
signal is emitted by the orchestrator from your JSON and the `Task(<name>)` card
(which already shows name, tokens, and duration).

## Where this file lives

Drop the finished agent into the right plugin: `plugins/<stack>/agents/<name>.md`
(`common` for stack-agnostic ones, else the stack plugin — `python`, …).
Then bump that plugin's `version` in `plugins/<stack>/.claude-plugin/plugin.json`
so installed devs receive the update. Versioning lives in `plugin.json`, not in the
agent frontmatter.

Finally, run `node scripts/build-catalog.mjs` and commit the regenerated catalog.
