#!/usr/bin/env node
// compose-agents — assemble self-contained subagents from two layers.
//
// Two-layer model:
//   • Universal layer  → plugins/common/standards/*.md  (single source of truth:
//     review doctrine, engineering principles, the subagent contract).
//   • Specialization   → each plugins/<stack>/agents/*.md keeps only its
//     stack/project particularities + frontmatter.
//
// Claude Code loads each agent as ONE self-contained file (subagents run in an
// isolated context with no import mechanism), so we inline the universal blocks
// at author time. An agent references a standard with a self-closing directive:
//
//     <!-- @include plugins/common/standards/code-review.md -->
//
// Running this script expands every directive in place into a refreshable block:
//
//     <!-- @include ... -->
//     ...inlined content ({{NAME}} -> the agent's frontmatter name)...
//     <!-- @end plugins/common/standards/code-review.md -->
//
// Re-running is idempotent: existing blocks are collapsed back to the directive
// and re-expanded from the current standard. Edit a standard once, run this, and
// every agent updates. Zero dependencies (Node >= 18).
//
//   node scripts/compose-agents.mjs            # write changes
//   node scripts/compose-agents.mjs --check    # CI: fail if anything is stale

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

function agentName(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text.replace(/\r\n/g, '\n'));
  const name = m && /^name:\s*(.+)$/m.exec(m[1]);
  return name ? name[1].trim().replace(/^['"]|['"]$/g, '') : 'subagent';
}

// Collapse any expanded block back to its bare directive, then re-expand all
// directives from the current standard. The backreference \1 keeps each block
// matched to its own path.
function compose(text, name) {
  const normalized = text.replace(/\r\n/g, '\n');
  // Match one @include plus any duplicate expanded/orphan blocks for the same path.
  const collapsed = normalized.replace(
    /<!-- @include (\S+) -->(?:\n[\s\S]*?\n<!-- @end \1 -->)+/g,
    '<!-- @include $1 -->',
  );
  return collapsed.replace(/<!-- @include (\S+) -->/g, (_, rel) => {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) throw new Error(`@include target not found: ${rel}`);
    const body = read(file).trim().replaceAll('{{NAME}}', name);
    return `<!-- @include ${rel} -->\n${body}\n<!-- @end ${rel} -->`;
  });
}

// Composable files: per-stack agents (consumed by isolated subagents) AND skills
// (consumed by the orchestrator). Both load as one self-contained file, so both
// inline the universal standards the same way — e.g. a skill @includes the
// orchestration standard instead of re-describing fan-out/merge/gates per plugin.
function* agentFiles() {
  const pluginsDir = path.join(ROOT, 'plugins');
  for (const stack of fs.readdirSync(pluginsDir)) {
    const agentsDir = path.join(pluginsDir, stack, 'agents');
    if (fs.existsSync(agentsDir)) {
      for (const f of fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'))) {
        yield path.join(agentsDir, f);
      }
    }
    // skills/<name>/SKILL.md — one level of skill dirs under the plugin.
    const skillsDir = path.join(pluginsDir, stack, 'skills');
    if (fs.existsSync(skillsDir)) {
      for (const s of fs.readdirSync(skillsDir)) {
        const skillFile = path.join(skillsDir, s, 'SKILL.md');
        if (fs.existsSync(skillFile)) yield skillFile;
      }
    }
  }
}

let changed = 0;
const stale = [];
for (const file of agentFiles()) {
  const src = read(file);
  if (!src.includes('<!-- @include ')) continue;
  const out = compose(src, agentName(src));
  if (out === src) continue;
  const rel = path.relative(ROOT, file);
  if (CHECK) {
    stale.push(rel);
  } else {
    fs.writeFileSync(file, out);
    console.log(`  composed ${rel}`);
  }
  changed++;
}

if (CHECK && stale.length) {
  console.error(`✗ ${stale.length} agent(s) out of sync with the standards layer:`);
  for (const r of stale) console.error(`    ${r}`);
  console.error(`  run: node scripts/compose-agents.mjs`);
  process.exit(1);
}
console.log(
  CHECK
    ? '✓ all agents in sync with plugins/common/standards/'
    : `✓ compose done — ${changed} file(s) updated`,
);
