# claude-dev-agents

A community **Claude Code plugin marketplace** of shared subagents — no company behind
it, just a small set of plugins distributed per stack. Subagents are defined here once
and delivered through Claude Code's native plugin system: **nothing is copied into your
project repos**, so they stay clean and never drift out of sync.

> 🧩 **Visual catalog:** open [`docs/marketplace.html`](docs/marketplace.html) in a
> browser (Agents · Setup · How it works). Most git hosts render it as source — download
> it or serve it as a static page to view it rendered.

> ✨ **Design a new plugin:** open [`docs/plugin-designer.html`](docs/plugin-designer.html)
> — a visual form that emits a config for [`scripts/new-plugin.mjs`](scripts/new-plugin.mjs),
> which scaffolds `plugins/<stack>/`, registers it here, and regenerates this catalog.

> ⚙️ **This file is generated.** Edit the agents/plugins, then run
> `node scripts/build-catalog.mjs` to regenerate README.md + docs/marketplace.html.
> Don't hand-edit the catalog below.

```text
/plugin marketplace add https://github.com/mrtheroi/agents-dev
/plugin install common@claude-dev-agents
/plugin install python@claude-dev-agents          # or your stack
```

`3 plugins · 5 subagents · 1 commands · 1 skills`

## Plugins

| Plugin | What's inside |
|---|---|
| **Common**<br>`common` | Stack-agnostic Claude Code subagents (e.g. pr-reviewer) plus the universal standards layer (standards/) that the per-stack agents compose in. |
| **Python**<br>`python` | Claude Code subagents for Python projects: implements tasks test-first inside a Hexagonal Architecture with Poetry-managed dependencies, and reviews changes for correctness, security, and architecture violations. |
| **Laravel**<br>`laravel` | Laravel subagents that detect the consumer repo's own architecture tier (canonical / service layer / hexagonal) and surface (API-only / fullstack) before acting: a test-first task builder and a code reviewer that reports defects plainly, quantifies consequences, and stays silent on taste. |

Install only your stack's plugin (plus `common`). Subagents are dispatched **on
demand** from their description, so an extra one costs nothing.

## Catalog

### Common <sub>`common` · v1.5.0</sub>

Stack-agnostic Claude Code subagents (e.g. pr-reviewer) plus the universal standards layer (standards/) that the per-stack agents compose in.

| Item | Kind | What it does |
|---|---|---|
| `pr-reviewer` | subagent | Reviews the current git diff for correctness bugs and quick cleanups. |
| `/batch-review` | command | Review a wide diff (many changed files) by fanning out pr-reviewer across folder-scoped batches. |
| `batch-review` | skill | Orchestrator playbook for reviewing a wide diff (many changed files) by fanning out a code-reviewer subagent across folder-scoped batches instead of one subagent per file. |

### Python <sub>`python` · v0.2.4</sub>

Claude Code subagents for Python projects: implements tasks test-first inside a Hexagonal Architecture with Poetry-managed dependencies, and reviews changes for correctness, security, and architecture violations.

| Item | Kind | What it does |
|---|---|---|
| `python-code-reviewer` | subagent | Reviews the staged changes (or a given set of files / diff range) of this Python backend for correctness bugs, security issues, and violations of Hexagonal Architecture or Strict… |
| `python-task-builder` | subagent | Implements ONE Python task (a use case, endpoint, or feature) end to end in this backend, following strict TDD (Red-Green-Refactor) and Hexagonal Architecture (domain /… |

### Laravel <sub>`laravel` · v0.1.0</sub>

Laravel subagents that detect the consumer repo's own architecture tier (canonical / service layer / hexagonal) and surface (API-only / fullstack) before acting: a test-first task builder and a code reviewer that reports defects plainly, quantifies consequences, and stays silent on taste.

| Item | Kind | What it does |
|---|---|---|
| `laravel-code-reviewer` | subagent | Reviews the staged changes (or a given set of files / diff range) of a Laravel codebase in its own isolated context. |
| `laravel-task-builder` | subagent | Implements ONE Laravel task (a use case, endpoint, job, or command) end to end, following strict TDD (Red-Green-Refactor) INSIDE the architecture the consumer repo already uses … |

## Setup

1. **Add the marketplace** (by its remote URL — no manual clone):
   ```text
   /plugin marketplace add https://github.com/mrtheroi/agents-dev
   ```
2. **Install** `common` + your stack:
   ```text
   /plugin install common@claude-dev-agents
   ```
   ```text
   /plugin install python@claude-dev-agents
   ```
   ```text
   /plugin install laravel@claude-dev-agents
   ```

### Auto-update for a whole team (optional)

Third-party marketplaces ship with auto-update **off**. To force it for every machine,
deploy this to the managed settings file or via the Claude.ai admin console. Path per OS:
`/Library/Application Support/ClaudeCode/managed-settings.json` (macOS),
`/etc/claude-code/managed-settings.json` (Linux),
`C:\ProgramData\ClaudeCode\managed-settings.json` (Windows):

```json
{
  "extraKnownMarketplaces": {
    "claude-dev-agents": {
      "source": { "source": "url", "url": "https://github.com/mrtheroi/agents-dev" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "common@claude-dev-agents": true
  }
}
```

## How it works

```
marketplace repo  ──►  ~/.claude/plugins/cache  ──►  your project
 source of truth       cloned & cached, offline       stays clean
```

- **The plugin is the unit of installation**, not the single agent. Subagents are
  invoked on demand from their description; to silence one, add
  `deny: ["Agent(name)"]` to settings.
- **Updates** are gated by each plugin's `version` (in `plugin.json`): bump + push, and
  the team gets it via `/plugin marketplace update` or auto-update.
- Per-project state lives in the project's own repo and never mixes between clones.

## Two layers: universal standards + stack specialization

Design patterns, architecture and review standards are universal; only language and
project particulars differ. So agents are authored in two layers:

- **Universal layer** — [`plugins/common/standards/`](plugins/common/standards/) holds
  the single source of truth: the review doctrine, the engineering principles, and the
  subagent contract.
- **Specialization** — each `plugins/<stack>/agents/*.md` keeps only its stack's
  particularities (SQL injection rules, brand tokens, framework idioms…).

Subagents load as one self-contained file, so an agent pulls a standard in with a
directive — `<!-- @include plugins/common/standards/code-review.md -->` — and
[`scripts/compose-agents.mjs`](scripts/compose-agents.mjs) expands it in place
(idempotent; `--check` mode for CI). Edit a standard once → every stack's agent
inherits it on the next compose. No drift between the reviewers.

## Add / edit a subagent

1. Copy [`plugins/_TEMPLATE.md`](plugins/_TEMPLATE.md) as a base.
2. Place it under the right plugin: `plugins/<stack>/agents/<name>.md`.
3. Reuse the universal layer with `<!-- @include plugins/common/standards/<file>.md -->`
   instead of copy-pasting; write only the stack particularities.
4. **Bump the `version`** in that plugin's `plugins/<stack>/.claude-plugin/plugin.json`.
5. New stack? Register the plugin in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).
6. Run `node scripts/build-catalog.mjs` (it composes the agents, then regenerates this README + the visual page).
7. Commit + push.

> Tip: add an optional `summary:` line to an agent's frontmatter for a hand-tuned
> one-line blurb; otherwise the generator uses the first sentence of `description:`.

## Regression evals for agents

Editing a shared standard silently changes every agent that composes it in. Guard
against that with the eval harness — golden cases distributed next to the agents:

- **Author** an eval at `plugins/<stack>/evals/<agent>.eval.json` (fixtures under
  `plugins/<stack>/evals/fixtures/`). Each case has an `input` (a fixture file or
  inline `text`) and `expect.mustMention` / `expect.mustNotMention` substrings.
- **CI (cheap, no tokens):** `node scripts/run-evals.mjs --check` — validates every
  eval file, that its agent exists, that the agent's `@include` targets still
  resolve, and that fixtures are present; prints per-agent coverage. Exit 1 on any
  problem. Run this on every PR.
- **Full (spends tokens):** `node scripts/run-evals.mjs --run [--agent <name>]` —
  dispatches each case to the agent headless via `claude -p` and grades the output.
