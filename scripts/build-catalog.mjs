#!/usr/bin/env node
// build-catalog — single source of truth → README.md + docs/marketplace.html
//
// Reads .claude-plugin/marketplace.json, each plugin's plugin.json, and the
// frontmatter of every agent / command / skill, then regenerates BOTH the
// Markdown README catalog and the visual HTML page. Run it after adding or
// editing any agent/plugin:
//
//   node scripts/build-catalog.mjs
//
// Zero dependencies (Node >= 18). Prose lives in this file; per-agent blurbs come
// from each agent's `summary:` frontmatter if present, else the first sentence of
// its `description:`. Stack accent colors are configured below (not in the data).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Compose the two layers first (universal standards → each agent) so the catalog
// always reflects synced agents. See scripts/compose-agents.mjs.
execFileSync('node', [path.join(ROOT, 'scripts/compose-agents.mjs')], { stdio: 'inherit' });
// Clone URL of this marketplace. Used verbatim in the install snippets and in the
// `source.url` example, so it must be the full URL, not the owner/repo shorthand.
const REMOTE = 'https://github.com/mrtheroi/agents-dev';
const ORG = 'claude-dev-agents contributors';

// Accent color per plugin (config — rarely changes). Unknown plugins cycle the palette.
const COLORS = {
  common: '#E8B341',
  python: '#6FB3D9',
};
const PALETTE = ['#E8B341', '#E0788F', '#86C06A', '#A593E8', '#56C0CF', '#D9A05B', '#6FB3D9'];

// ─── helpers ──────────────────────────────────────────────────────────────────
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const exists = (p) => fs.existsSync(p);
const unquote = (s) => s.replace(/^['"]|['"]$/g, '').trim();

function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return {};
  const block = m[1];
  const out = {};
  const name = /^name:\s*(.+)$/m.exec(block);
  if (name) out.name = unquote(name[1].trim());
  const sum = /^summary:\s*(.+)$/m.exec(block);
  if (sum) out.summary = unquote(sum[1].trim());
  const d = /^description:\s*(.*)$/m.exec(block);
  if (d) {
    let val = d[1].trim();
    if (['>-', '>', '|', '|-', ''].includes(val)) {
      const lines = [];
      for (const ln of block.slice(d.index + d[0].length).split('\n')) {
        if (/^\s+\S/.test(ln)) lines.push(ln.trim());
        else if (lines.length) break;
        else if (ln.trim() === '') continue;
        else break;
      }
      val = lines.join(' ');
    } else val = unquote(val);
    out.description = val;
  }
  return out;
}

function blurb(it) {
  if (it.summary) return it.summary;
  const d = (it.description || '').replace(/\s+/g, ' ').trim();
  const m = /^(.+?[.!?])(?:\s+[A-Z(]|$)/.exec(d);
  let s = m ? m[1] : d;
  if (!m || s.length > 185) {
    s = d.slice(0, 180).replace(/\s+\S*$/, '').replace(/[,;:—-]+$/, '') + '…';
  }
  return s;
}

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escMd = (s) => String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

// ─── load data ──────────────────────────────────────────────────────────────────
const marketplace = JSON.parse(read(path.join(ROOT, '.claude-plugin/marketplace.json')));
const MP = marketplace.name;

// Human-friendly headline for a plugin. Prefer an explicit `displayName` from the
// marketplace entry / plugin.json; otherwise derive one from the technical name by
// title-casing it, with a few special cases the generic rule can't know (.NET, Node.js).
const DISPLAY_OVERRIDES = {};
function displayName(entry, pj) {
  if (entry.displayName) return entry.displayName;
  if (pj.displayName) return pj.displayName;
  if (DISPLAY_OVERRIDES[pj.name]) return DISPLAY_OVERRIDES[pj.name];
  return pj.name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function loadPlugin(entry, i) {
  const dir = path.join(ROOT, entry.source);
  const pj = JSON.parse(read(path.join(dir, '.claude-plugin/plugin.json')));
  const items = [];
  const agentsDir = path.join(dir, 'agents');
  if (exists(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md')).sort()) {
      const fm = frontmatter(read(path.join(agentsDir, f)));
      items.push({ name: fm.name || f.replace(/\.md$/, ''), kind: 'subagent', blurb: blurb(fm) });
    }
  }
  const cmdDir = path.join(dir, 'commands');
  if (exists(cmdDir)) {
    for (const f of fs.readdirSync(cmdDir).filter((f) => f.endsWith('.md')).sort()) {
      const fm = frontmatter(read(path.join(cmdDir, f)));
      items.push({ name: '/' + f.replace(/\.md$/, ''), kind: 'command', blurb: blurb(fm), slash: true });
    }
  }
  const skillsDir = path.join(dir, 'skills');
  if (exists(skillsDir)) {
    for (const d of fs.readdirSync(skillsDir).sort()) {
      const sp = path.join(skillsDir, d, 'SKILL.md');
      if (exists(sp)) {
        const fm = frontmatter(read(sp));
        items.push({ name: fm.name || d, kind: 'skill', blurb: blurb(fm) });
      }
    }
  }
  const hooksPath = path.join(dir, 'hooks/hooks.json');
  if (exists(hooksPath)) {
    let events = [];
    try { events = Object.keys(JSON.parse(read(hooksPath)).hooks || {}); } catch {}
    // Generic label/blurb built from the events the plugin's hooks.json declares.
    const meta = { name: 'hooks', blurb: `Automatic ${events.join(' / ') || 'lifecycle'} hooks — active on install, no config.` };
    items.push({ name: meta.name, kind: 'automatic', blurb: meta.blurb });
  }
  const settingsPath = path.join(dir, 'settings.json');
  if (exists(settingsPath)) {
    try {
      if (JSON.parse(read(settingsPath)).statusLine) {
        items.push({ name: 'status line', kind: 'automatic', blurb: 'A persistent status line naming the stack plugin that applies to the current repo.' });
      }
    } catch {}
  }
  return {
    name: pj.name,
    display: displayName(entry, pj),
    version: pj.version || '—',
    desc: pj.description || '',
    color: COLORS[pj.name] || PALETTE[i % PALETTE.length],
    items,
  };
}

const plugins = marketplace.plugins.map(loadPlugin);

// A real stack plugin to use in the "install your stack" examples (README + HTML demo),
// so the docs never advertise a plugin this marketplace doesn't ship.
const stackExample = (plugins.find((p) => p.name !== 'common') || plugins[0] || { name: '<stack>' }).name;

const totals = plugins.reduce(
  (a, p) => {
    a.subagents += p.items.filter((i) => i.kind === 'subagent').length;
    a.commands += p.items.filter((i) => i.kind === 'command').length;
    a.skills += p.items.filter((i) => i.kind === 'skill').length;
    return a;
  },
  { subagents: 0, commands: 0, skills: 0 }
);
const stats = [
  { n: plugins.length, l: 'plugins' },
  { n: totals.subagents, l: 'subagents' },
  { n: totals.commands, l: 'commands' },
  { n: totals.skills, l: 'skills' },
];

const kindLabel = { subagent: 'subagent', command: 'command', skill: 'skill', automatic: 'automatic' };
const kindClass = { subagent: 'sub', automatic: 'auto', command: '', skill: '' };

// ─── README.md ──────────────────────────────────────────────────────────────────
function renderReadme() {
  const statLine = stats.map((s) => `${s.n} ${s.l}`).join(' · ');
  const pluginRows = plugins
    .map((p) => `| **${escMd(p.display)}**<br>\`${p.name}\` | ${escMd(p.desc)} |`)
    .join('\n');

  const catalog = plugins
    .map((p) => {
      const rows = p.items
        .map((it) => `| \`${it.name}\` | ${kindLabel[it.kind]} | ${escMd(it.blurb)} |`)
        .join('\n');
      return `### ${escMd(p.display)} <sub>\`${p.name}\` · v${p.version}</sub>\n\n${escMd(p.desc)}\n\n| Item | Kind | What it does |\n|---|---|---|\n${rows}`;
    })
    .join('\n\n');

  return `# ${MP}

A community **Claude Code plugin marketplace** of shared subagents — no company behind
it, just a small set of plugins distributed per stack. Subagents are defined here once
and delivered through Claude Code's native plugin system: **nothing is copied into your
project repos**, so they stay clean and never drift out of sync.

> 🧩 **Visual catalog:** open [\`docs/marketplace.html\`](docs/marketplace.html) in a
> browser (Agents · Setup · How it works). Most git hosts render it as source — download
> it or serve it as a static page to view it rendered.

> ✨ **Design a new plugin:** open [\`docs/plugin-designer.html\`](docs/plugin-designer.html)
> — a visual form that emits a config for [\`scripts/new-plugin.mjs\`](scripts/new-plugin.mjs),
> which scaffolds \`plugins/<stack>/\`, registers it here, and regenerates this catalog.

> ⚙️ **This file is generated.** Edit the agents/plugins, then run
> \`node scripts/build-catalog.mjs\` to regenerate README.md + docs/marketplace.html.
> Don't hand-edit the catalog below.

\`\`\`text
/plugin marketplace add ${REMOTE}
/plugin install common@${MP}
/plugin install ${stackExample}@${MP}          # or your stack
\`\`\`

\`${statLine}\`

## Plugins

| Plugin | What's inside |
|---|---|
${pluginRows}

Install only your stack's plugin (plus \`common\`). Subagents are dispatched **on
demand** from their description, so an extra one costs nothing.

## Catalog

${catalog}

## Setup

1. **Add the marketplace** (by its remote URL — no manual clone):
   \`\`\`text
   /plugin marketplace add ${REMOTE}
   \`\`\`
2. **Install** \`common\` + your stack:
${plugins.map((p) => `   \`\`\`text\n   /plugin install ${p.name}@${MP}\n   \`\`\``).join('\n')}

### Auto-update for a whole team (optional)

Third-party marketplaces ship with auto-update **off**. To force it for every machine,
deploy this to the managed settings file or via the Claude.ai admin console. Path per OS:
\`/Library/Application Support/ClaudeCode/managed-settings.json\` (macOS),
\`/etc/claude-code/managed-settings.json\` (Linux),
\`C:\\ProgramData\\ClaudeCode\\managed-settings.json\` (Windows):

\`\`\`json
{
  "extraKnownMarketplaces": {
    "${MP}": {
      "source": { "source": "url", "url": "${REMOTE}" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "common@${MP}": true
  }
}
\`\`\`

## How it works

\`\`\`
marketplace repo  ──►  ~/.claude/plugins/cache  ──►  your project
 source of truth       cloned & cached, offline       stays clean
\`\`\`

- **The plugin is the unit of installation**, not the single agent. Subagents are
  invoked on demand from their description; to silence one, add
  \`deny: ["Agent(name)"]\` to settings.
- **Updates** are gated by each plugin's \`version\` (in \`plugin.json\`): bump + push, and
  the team gets it via \`/plugin marketplace update\` or auto-update.
- Per-project state lives in the project's own repo and never mixes between clones.

## Two layers: universal standards + stack specialization

Design patterns, architecture and review standards are universal; only language and
project particulars differ. So agents are authored in two layers:

- **Universal layer** — [\`plugins/common/standards/\`](plugins/common/standards/) holds
  the single source of truth: the review doctrine, the engineering principles, and the
  subagent contract.
- **Specialization** — each \`plugins/<stack>/agents/*.md\` keeps only its stack's
  particularities (SQL injection rules, brand tokens, framework idioms…).

Subagents load as one self-contained file, so an agent pulls a standard in with a
directive — \`<!-- @include plugins/common/standards/code-review.md -->\` — and
[\`scripts/compose-agents.mjs\`](scripts/compose-agents.mjs) expands it in place
(idempotent; \`--check\` mode for CI). Edit a standard once → every stack's agent
inherits it on the next compose. No drift between the reviewers.

## Add / edit a subagent

1. Copy [\`plugins/_TEMPLATE.md\`](plugins/_TEMPLATE.md) as a base.
2. Place it under the right plugin: \`plugins/<stack>/agents/<name>.md\`.
3. Reuse the universal layer with \`<!-- @include plugins/common/standards/<file>.md -->\`
   instead of copy-pasting; write only the stack particularities.
4. **Bump the \`version\`** in that plugin's \`plugins/<stack>/.claude-plugin/plugin.json\`.
5. New stack? Register the plugin in [\`.claude-plugin/marketplace.json\`](.claude-plugin/marketplace.json).
6. Run \`node scripts/build-catalog.mjs\` (it composes the agents, then regenerates this README + the visual page).
7. Commit + push.

> Tip: add an optional \`summary:\` line to an agent's frontmatter for a hand-tuned
> one-line blurb; otherwise the generator uses the first sentence of \`description:\`.

## Regression evals for agents

Editing a shared standard silently changes every agent that composes it in. Guard
against that with the eval harness — golden cases distributed next to the agents:

- **Author** an eval at \`plugins/<stack>/evals/<agent>.eval.json\` (fixtures under
  \`plugins/<stack>/evals/fixtures/\`). Each case has an \`input\` (a fixture file or
  inline \`text\`) and \`expect.mustMention\` / \`expect.mustNotMention\` substrings.
- **CI (cheap, no tokens):** \`node scripts/run-evals.mjs --check\` — validates every
  eval file, that its agent exists, that the agent's \`@include\` targets still
  resolve, and that fixtures are present; prints per-agent coverage. Exit 1 on any
  problem. Run this on every PR.
- **Full (spends tokens):** \`node scripts/run-evals.mjs --run [--agent <name>]\` —
  dispatches each case to the agent headless via \`claude -p\` and grades the output.
`;
}

// ─── docs/marketplace.html ────────────────────────────────────────────────────
const CSS = `
  :root{
    --ink:#14161e;--ink-2:#191c26;--ink-3:#1e2230;--line:#2a2f3d;--line-2:#3a4153;
    --text:#ECE7DB;--text-dim:#9aa1b2;--text-faint:#6b7287;--brand:#E8B341;--brand-soft:rgba(232,179,65,.14);
    --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;--maxw:1080px;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--ink);color:var(--text);font-family:var(--sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
  a{color:var(--brand);text-decoration:none}a:hover{text-decoration:underline}
  ::selection{background:var(--brand);color:#1a1407}
  :focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:3px}
  .layout{display:grid;grid-template-columns:35fr 65fr;min-height:100vh}
  .side{position:sticky;top:0;height:100vh;overflow-y:auto;border-right:1px solid var(--line);padding:30px 32px;display:flex;flex-direction:column;gap:22px;background-image:radial-gradient(700px 420px at 15% -5%,rgba(232,179,65,.08),transparent 60%)}
  .brand{display:flex;align-items:center;gap:10px;font-family:var(--mono);font-weight:600;letter-spacing:-.02em;font-size:15px;color:var(--text)}
  .brand .mark{width:22px;height:22px;border:1.5px solid var(--brand);border-radius:6px;display:grid;place-items:center;color:var(--brand);font-size:12px;line-height:1}
  .brand .dim{color:var(--text-faint)}
  .eyebrow{font-family:var(--mono);font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--text-faint);margin:0}
  .side h1{font-size:clamp(26px,2.6vw,34px);line-height:1.1;letter-spacing:-.025em;margin:0;text-wrap:balance}
  .side h1 em{font-style:normal;color:var(--brand)}
  .side .lede{color:var(--text-dim);font-size:15px;margin:0}
  .term{background:#0f1118;border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 16px 40px -28px rgba(0,0,0,.8)}
  .term-bar{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--line);background:#12141c}
  .term-bar i{width:10px;height:10px;border-radius:50%;background:#2f3543;display:inline-block}
  .term-bar i:nth-child(1){background:#46506a}
  .term-bar span{margin-left:8px;font-family:var(--mono);font-size:11px;color:var(--text-faint);letter-spacing:.04em}
  .term-body{padding:18px 20px;font-family:var(--mono);font-size:14.5px;line-height:1.95;overflow-x:auto}
  .term-body .ln{white-space:pre;color:var(--text)}.term-body .pr{color:var(--brand);user-select:none}.term-body .cm{color:var(--text-faint)}.term-body .ok{color:#86C06A}
  .cursor{display:inline-block;width:8px;height:1.05em;background:var(--brand);vertical-align:-2px;margin-left:2px;animation:blink 1.1s steps(1) infinite}
  @keyframes blink{50%{opacity:0}}
  .stats{display:grid;grid-template-columns:1fr 1fr;gap:14px 18px;border-top:1px solid var(--line);padding-top:20px;margin:0}
  .stat b{display:block;font-family:var(--mono);font-size:24px;font-variant-numeric:tabular-nums;letter-spacing:-.02em;color:var(--text)}
  .stat small{color:var(--text-faint);font-size:12px;font-family:var(--mono);letter-spacing:.04em}
  .designer-cta{display:flex;align-items:center;justify-content:center;gap:8px;font-family:var(--mono);font-size:12.5px;color:var(--brand);background:var(--brand-soft);border:1px solid color-mix(in srgb,var(--brand) 45%,transparent);border-radius:10px;padding:11px 14px;text-decoration:none;transition:background .15s,border-color .15s}
  .designer-cta:hover{background:color-mix(in srgb,var(--brand) 22%,transparent);border-color:var(--brand);text-decoration:none}
  .side-foot{margin-top:auto;border-top:1px solid var(--line);padding-top:16px;font-family:var(--mono);font-size:11px;color:var(--text-faint);line-height:1.7}
  .content{min-width:0;display:flex;flex-direction:column}
  .tabs{position:sticky;top:0;z-index:10;display:flex;gap:4px;padding:14px 30px;background:rgba(20,22,30,.86);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
  .tab{appearance:none;background:transparent;border:0;cursor:pointer;font-family:var(--mono);font-size:13px;color:var(--text-dim);padding:8px 14px;border-radius:8px;letter-spacing:.01em;transition:color .15s,background .15s}
  .tab:hover{color:var(--text);background:var(--ink-3)}
  .tab[aria-selected="true"]{color:var(--brand);background:var(--brand-soft)}
  .panels{padding:30px 30px 72px;min-width:0}
  .panel[hidden]{display:none}
  .panel-intro{max-width:62ch;margin:0 0 36px}
  .panel-intro h2{font-size:24px;letter-spacing:-.02em;margin:0 0 10px}
  .panel-intro p{color:var(--text-dim);margin:0}
  .plugin{margin:0 0 38px;border:1px solid var(--line);border-radius:14px;background:var(--ink-2);overflow:hidden}
  .plugin-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;padding:20px 22px;border-bottom:1px solid var(--line);position:relative}
  .plugin-head::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent)}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 22%,transparent);align-self:center}
  .plugin-name{font-family:var(--mono);font-size:15px;color:var(--text);font-weight:600}
  .vpill{font-family:var(--mono);font-size:11px;color:var(--text-faint);border:1px solid var(--line-2);border-radius:20px;padding:2px 9px;align-self:center}
  .plugin-desc{color:var(--text-dim);font-size:14px;flex-basis:100%;margin-top:2px}
  .install{flex-basis:100%;margin-top:4px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:1px;background:var(--line);padding:1px}
  .card{background:var(--ink-2);padding:18px 20px;display:flex;flex-direction:column;gap:9px;transition:background .15s}
  .card:hover{background:var(--ink-3)}
  .card-top{display:flex;align-items:center;gap:8px;justify-content:space-between}
  .card-name{font-family:var(--mono);font-size:14px;color:var(--text);letter-spacing:-.01em}
  .card-name .sl{color:var(--accent)}
  .card p{margin:0;color:var(--text-dim);font-size:13.5px;line-height:1.55}
  .kind{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border-radius:6px;white-space:nowrap;border:1px solid var(--line-2);color:var(--text-faint)}
  .kind.sub{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 40%,var(--line-2))}
  .kind.auto{color:#86C06A;border-color:color-mix(in srgb,#86C06A 40%,var(--line-2))}
  .cmd{display:flex;align-items:center;gap:10px;background:#0f1118;border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-family:var(--mono);font-size:13px;overflow:hidden}
  .cmd code{color:var(--text);white-space:nowrap;overflow-x:auto;flex:1;scrollbar-width:thin}
  .cmd code .pr{color:var(--brand);user-select:none}
  .copy{appearance:none;border:1px solid var(--line-2);background:var(--ink-3);color:var(--text-dim);font-family:var(--mono);font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;white-space:nowrap;transition:all .15s}
  .copy:hover{color:var(--text);border-color:var(--brand)}.copy.done{color:#86C06A;border-color:#86C06A}
  .steps{display:flex;flex-direction:column;gap:20px;max-width:760px}
  .step{border:1px solid var(--line);border-radius:13px;background:var(--ink-2);padding:20px 22px}
  .step-h{display:flex;align-items:baseline;gap:12px;margin:0 0 6px}
  .step-n{font-family:var(--mono);font-size:13px;color:var(--brand);border:1px solid color-mix(in srgb,var(--brand) 40%,var(--line-2));border-radius:7px;padding:2px 9px;font-variant-numeric:tabular-nums}
  .step-h h3{font-size:16px;margin:0;letter-spacing:-.01em}
  .step .note{color:var(--text-dim);font-size:13.5px;margin:4px 0 12px}
  .step .cmd+ .cmd{margin-top:8px}
  pre.code{background:#0f1118;border:1px solid var(--line);border-radius:10px;padding:14px 16px;overflow-x:auto;font-family:var(--mono);font-size:12.5px;line-height:1.7;color:var(--text);margin:6px 0 0}
  pre.code .k{color:#56C0CF}pre.code .s{color:#86C06A}pre.code .b{color:var(--brand)}
  .how{display:flex;flex-direction:column;gap:30px;max-width:820px}
  .prose p{color:var(--text-dim);margin:0 0 12px}.prose strong{color:var(--text)}
  .flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:stretch;gap:10px;margin:6px 0}
  .node{border:1px solid var(--line);background:var(--ink-2);border-radius:12px;padding:16px;text-align:center}
  .node .t{font-family:var(--mono);font-size:12.5px;color:var(--text);margin-bottom:4px}
  .node .d{font-size:12px;color:var(--text-faint);line-height:1.45}
  .arrow{display:grid;place-items:center;color:var(--text-faint);font-family:var(--mono);font-size:18px}
  .feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .feat{border:1px solid var(--line);border-radius:13px;background:var(--ink-2);padding:20px;position:relative;overflow:hidden}
  .feat::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent)}
  .feat h4{font-family:var(--mono);font-size:14px;margin:0 0 8px;color:var(--text)}
  .feat p{margin:0 0 10px;color:var(--text-dim);font-size:13.5px}
  .feat ul{margin:0;padding-left:18px;color:var(--text-dim);font-size:13px;line-height:1.7}
  .sample{font-family:var(--mono);font-size:11.5px;color:var(--text-faint);background:#0f1118;border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow-x:auto;white-space:nowrap;margin-top:10px}
  .sample b{color:var(--brand);font-weight:400}
  .h-section h3{font-size:13px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint);margin:0 0 16px;font-weight:500}
  footer{border-top:1px solid var(--line);padding:26px 0;color:var(--text-faint);font-family:var(--mono);font-size:12px}
  footer .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}
  @media(max-width:900px){.layout{grid-template-columns:1fr}.side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}}
  @media(max-width:600px){.tabs{gap:0;padding:12px 16px}.tab{padding:8px 9px;font-size:12px}.flow{grid-template-columns:1fr}.arrow{transform:rotate(90deg)}.feat-grid{grid-template-columns:1fr}.panels{padding:24px 16px 60px}.side{padding:24px 20px}}
  @media(prefers-reduced-motion:reduce){.cursor{animation:none}*{transition:none!important}}`;

function renderCard(it, color) {
  const cls = kindClass[it.kind];
  const nm = it.slash ? `<span class="sl">/</span>${escHtml(it.name.slice(1))}` : escHtml(it.name);
  return `        <div class="card"><div class="card-top"><span class="card-name">${nm}</span><span class="kind${cls ? ' ' + cls : ''}">${kindLabel[it.kind]}</span></div><p>${escHtml(it.blurb)}</p></div>`;
}

function renderPlugin(p) {
  const cards = p.items.map((it) => renderCard(it, p.color)).join('\n');
  return `    <section class="plugin" style="--accent:${p.color}">
      <div class="plugin-head">
        <span class="dot"></span><span class="plugin-name">${escHtml(p.display)}</span><span class="vpill">v${escHtml(p.version)}</span>
        <span class="plugin-desc">${escHtml(p.desc)}</span>
        <div class="install"><div class="cmd"><code><span class="pr">/</span>plugin install ${escHtml(p.name)}@${escHtml(MP)}</code><button class="copy">Copy</button></div></div>
      </div>
      <div class="grid">
${cards}
      </div>
    </section>`;
}

function renderHtml() {
  const statsHtml = stats.map((s) => `      <div class="stat"><b>${s.n}</b><small>${s.l}</small></div>`).join('\n');
  const sections = plugins.map(renderPlugin).join('\n\n');
  const installList = plugins
    .map((p) => `        <div class="cmd"><code><span class="pr">/</span>plugin install ${escHtml(p.name)}@${escHtml(MP)}</code><button class="copy">Copy</button></div>`)
    .join('\n');

  return `<title>${escHtml(MP)} · marketplace</title>
<style>${CSS}
</style>

<div class="layout">
  <aside class="side">
    <div class="brand"><span class="mark">/&gt;</span>${escHtml(MP)} <span class="dim">· marketplace</span></div>
    <p class="eyebrow">Claude Code subagents · distributed as plugins</p>
    <h1>One home for the agents <em>your stack</em> needs.</h1>
    <p class="lede">A community catalog of Claude Code subagents. Installed once per machine — project repos stay clean and never drift.</p>
    <div class="term" aria-hidden="true">
      <div class="term-bar"><i></i><i></i><i></i><span>Claude Code</span></div>
      <div class="term-body">
<div class="ln"><span class="pr">/</span>plugin marketplace add ${escHtml(REMOTE)}</div>
<div class="ln"><span class="pr">/</span>plugin install ${escHtml(stackExample)}@${escHtml(MP)}</div>
<div class="ln"><span class="ok">✓</span> installed <span class="cm"># ${plugins.length} plugins · ${totals.subagents} subagents</span><span class="cursor"></span></div>
      </div>
    </div>
    <div class="stats">
${statsHtml}
    </div>
    <a class="designer-cta" href="plugin-designer.html">🧩 Design a new plugin <span aria-hidden="true">→</span></a>
    <div class="side-foot">${escHtml(MP)} · marketplace of Claude Code subagents<br>${escHtml(ORG)} · ${escHtml(REMOTE)}</div>
  </aside>

  <section class="content">
    <nav class="tabs" role="tablist" aria-label="Sections">
      <button class="tab" role="tab" data-tab="agents" aria-selected="true">Agents</button>
      <button class="tab" role="tab" data-tab="config" aria-selected="false">Setup</button>
      <button class="tab" role="tab" data-tab="how" aria-selected="false">How it works</button>
    </nav>
    <div class="panels">

  <section id="panel-agents" class="panel" role="tabpanel">
    <div class="panel-intro">
      <h2>The catalog</h2>
      <p>Each plugin groups one stack's subagents. You install only yours — plus the cross-cutting ones. Agents are dispatched on demand from their description, so an extra one costs nothing.</p>
    </div>

${sections}
  </section>

  <section id="panel-config" class="panel" role="tabpanel" hidden>
    <div class="panel-intro">
      <h2>Setup</h2>
      <p>Once per machine you add the marketplace and install your stack. You never clone this repository — Claude Code caches it in <code>~/.claude/plugins/cache/</code> and runs offline.</p>
    </div>
    <div class="steps">
      <div class="step">
        <div class="step-h"><span class="step-n">1</span><h3>Add the marketplace</h3></div>
        <p class="note">By its remote URL. No manual <code>git clone</code>.</p>
        <div class="cmd"><code><span class="pr">/</span>plugin marketplace add ${escHtml(REMOTE)}</code><button class="copy">Copy</button></div>
      </div>
      <div class="step">
        <div class="step-h"><span class="step-n">2</span><h3>Install <code>common</code> + your stack</h3></div>
        <p class="note">Everyone installs <strong>common</strong>; then just their stack's plugin.</p>
${installList}
      </div>
      <div class="step">
        <div class="step-h"><span class="step-n">3</span><h3>Auto-update for a whole team <span style="color:var(--text-faint);font-family:var(--mono);font-size:12px">· optional</span></h3></div>
        <p class="note">Third-party marketplaces ship with auto-update <strong>off</strong>. To force it for every machine, deploy this to the managed settings file or via the Claude.ai admin console. Path per OS: <code>/Library/Application&nbsp;Support/ClaudeCode/managed-settings.json</code> (macOS), <code>/etc/claude-code/managed-settings.json</code> (Linux), <code>C:\\ProgramData\\ClaudeCode\\managed-settings.json</code> (Windows).</p>
<pre class="code">{
  <span class="k">"extraKnownMarketplaces"</span>: {
    <span class="k">"${escHtml(MP)}"</span>: {
      <span class="k">"source"</span>: { <span class="k">"source"</span>: <span class="s">"url"</span>, <span class="k">"url"</span>: <span class="s">"${escHtml(REMOTE)}"</span> },
      <span class="k">"autoUpdate"</span>: <span class="b">true</span>
    }
  },
  <span class="k">"enabledPlugins"</span>: {
    <span class="k">"common@${escHtml(MP)}"</span>: <span class="b">true</span>
  }
}</pre>
      </div>
    </div>
  </section>

  <section id="panel-how" class="panel" role="tabpanel" hidden>
    <div class="panel-intro">
      <h2>How it works</h2>
      <p>The repository is a Claude Code <strong>marketplace</strong>: a catalog that lists plugins, one per stack. Distribution and updates are native — project repos copy nothing.</p>
    </div>
    <div class="how">
      <div class="h-section">
        <h3>The distribution flow</h3>
        <div class="flow">
          <div class="node"><div class="t">${escHtml(MP)}</div><div class="d">central git repo · source of truth</div></div>
          <div class="arrow">→</div>
          <div class="node"><div class="t">~/.claude/plugins/cache</div><div class="d">Claude Code clones &amp; caches it · runs offline</div></div>
          <div class="arrow">→</div>
          <div class="node"><div class="t">your project</div><div class="d">stays clean · no copied scripts or .claude/agents</div></div>
        </div>
      </div>
      <div class="h-section prose">
        <h3>The model</h3>
        <p>The <strong>unit of installation is the plugin</strong>, not the single agent. Installing one brings all its subagents, but they are invoked <strong>on demand</strong> from their description — an agent that doesn't apply uses no context. To silence one, a <code>deny: ["Agent(name)"]</code> in settings is enough.</p>
        <p><strong>Updates</strong> are gated by each plugin's <code>version</code>: you bump it and push, and the team gets it via <code>/plugin marketplace update</code> or, if enabled, auto-update. Per-project state lives in the project's own repo and never mixes between clones.</p>
      </div>
      <div class="h-section">
        <h3>Two layers: universal standards + stack specialization</h3>
        <p class="note">Design patterns, architecture and review standards are universal; only language and project particulars differ. So they live in two layers — written once, never copy-pasted across stacks.</p>
        <div class="flow">
          <div class="node"><div class="t">common/standards</div><div class="d">universal layer · review doctrine, engineering principles, the subagent contract</div></div>
          <div class="arrow">+</div>
          <div class="node"><div class="t">&lt;stack&gt;/agents</div><div class="d">specialization · only this stack's particularities (SQL injection, brand tokens, framework idioms…)</div></div>
          <div class="arrow">→</div>
          <div class="node"><div class="t">composed agent</div><div class="d">one self-contained file Claude Code loads at runtime</div></div>
        </div>
        <div class="prose" style="margin-top:18px">
          <p>Subagents run in an isolated context with no import mechanism, so each must be a single self-contained file. An agent pulls in a standard with a directive — <code>&lt;!-- @include plugins/common/standards/code-review.md --&gt;</code> — and <code>scripts/compose-agents.mjs</code> expands it in place (substituting the agent's name). It is idempotent and ships a <code>--check</code> mode for CI; <code>build-catalog.mjs</code> runs it automatically.</p>
          <p><strong>The payoff:</strong> edit a standard once and every stack's agent inherits the change on the next compose — no drift between the reviewers of different stacks. Each stack file stays short, holding only what is genuinely particular to it.</p>
        </div>
      </div>
    </div>
  </section>

    </div>
  </section>
</div>

<script>
  (function(){
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    var panels = { agents: document.getElementById('panel-agents'), config: document.getElementById('panel-config'), how: document.getElementById('panel-how') };
    function activate(id){
      tabs.forEach(function(t){ t.setAttribute('aria-selected', String(t.dataset.tab===id)); });
      Object.keys(panels).forEach(function(k){ panels[k].hidden = (k!==id); });
      window.scrollTo({top:0,behavior:'auto'});
    }
    tabs.forEach(function(t){
      t.addEventListener('click', function(){ activate(t.dataset.tab); });
      t.addEventListener('keydown', function(e){
        var i = tabs.indexOf(t);
        if(e.key==='ArrowRight'){ e.preventDefault(); tabs[(i+1)%tabs.length].focus(); tabs[(i+1)%tabs.length].click(); }
        if(e.key==='ArrowLeft'){ e.preventDefault(); tabs[(i-1+tabs.length)%tabs.length].focus(); tabs[(i-1+tabs.length)%tabs.length].click(); }
      });
    });
    document.querySelectorAll('.copy').forEach(function(btn){
      btn.addEventListener('click', function(){
        var code = btn.parentNode.querySelector('code');
        var text = (code ? code.textContent : '').trim();
        var done = function(){ btn.textContent='Copied'; btn.classList.add('done'); setTimeout(function(){ btn.textContent='Copy'; btn.classList.remove('done'); },1400); };
        if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done).catch(done); } else { done(); }
      });
    });
  })();
</script>
`;
}

// ─── write ──────────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, 'README.md'), renderReadme());
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/marketplace.html'), renderHtml());

console.log(`✓ Generated README.md + docs/marketplace.html`);
console.log(`  ${plugins.length} plugins · ${totals.subagents} subagents · ${totals.commands} commands · ${totals.skills} skills`);
for (const p of plugins) console.log(`    ${p.name} v${p.version} — ${p.items.length} items`);
