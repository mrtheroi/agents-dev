#!/usr/bin/env node
// run-evals — a regression harness for the marketplace's subagents.
//
// Why this exists: agents are authored in two layers (plugins/common/standards +
// per-stack specialization). Editing a shared standard silently changes every
// agent that composes it in. This harness gives you a safety net and a quality
// signal per agent, distributed with each plugin — you never leave the marketplace
// concept.
//
// Eval files live next to the agents they cover:
//     plugins/<stack>/evals/<agent>.eval.json
//
//     {
//       "agent": "nest-code-reviewer",              // must match agents/<agent>.md
//       "cases": [
//         {
//           "name": "flags raw SQL string interpolation",
//           "input": { "file": "evals/fixtures/sql-injection.diff" },  // or { "text": "..." }
//           "expect": {
//             "mustMention":    ["sql injection", "parameter"],  // case-insensitive substrings
//             "mustNotMention": ["looks fine"]
//           }
//         }
//       ]
//     }
//
// Two modes:
//   --check   (default)  Cheap, no tokens, CI-safe. Validates every eval file,
//                        that its agent exists, that the agent's @include targets
//                        still resolve, and that fixtures exist. Prints a coverage
//                        table (which agents have evals). Exit 1 on any hard error.
//                        THIS is what belongs in CI on every PR.
//   A case may override the instruction sent with its fixture via `instruction`.
//   The default is review-shaped, which is wrong for a task builder: asked to "report
//   findings" a builder answers as a reviewer and its own doctrine is never exercised.
//
//   --run                Spends tokens. Dispatches each case to the agent headless
//                        via `claude -p`, then grades the output against
//                        mustMention/mustNotMention. Exit 1 on any failing case.
//                        Filter with --agent <name> or --plugin <stack>.
//
// Zero dependencies (Node >= 18).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// ─── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const MODE = argv.includes('--run') ? 'run' : 'check';
const flag = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : null;
};
const filterAgent = flag('--agent');
const filterPlugin = flag('--plugin');

// ─── discover eval files ────────────────────────────────────────────────────────
function* evalFiles() {
  const pluginsDir = path.join(ROOT, 'plugins');
  for (const stack of fs.readdirSync(pluginsDir)) {
    if (filterPlugin && stack !== filterPlugin) continue;
    const evalsDir = path.join(pluginsDir, stack, 'evals');
    if (!fs.existsSync(evalsDir)) continue;
    for (const f of fs.readdirSync(evalsDir).filter((f) => f.endsWith('.eval.json'))) {
      yield { stack, file: path.join(evalsDir, f) };
    }
  }
}

// Every agent .md across the plugins, for coverage reporting.
function allAgents() {
  const out = [];
  const pluginsDir = path.join(ROOT, 'plugins');
  for (const stack of fs.readdirSync(pluginsDir)) {
    const agentsDir = path.join(pluginsDir, stack, 'agents');
    if (!fs.existsSync(agentsDir)) continue;
    for (const f of fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'))) {
      out.push({ stack, name: f.replace(/\.md$/, ''), path: path.join(agentsDir, f) });
    }
  }
  return out;
}

// ─── validation (the --check layer) ──────────────────────────────────────────────
function validateSpec(spec, ctx, errors) {
  const where = ctx.rel;
  if (!spec || typeof spec !== 'object') return errors.push(`${where}: not a JSON object`);
  if (!spec.agent || typeof spec.agent !== 'string')
    return errors.push(`${where}: missing string "agent"`);

  // Agent must exist in the SAME plugin.
  const agentPath = path.join(ROOT, 'plugins', ctx.stack, 'agents', `${spec.agent}.md`);
  if (!fs.existsSync(agentPath)) {
    errors.push(`${where}: agent "${spec.agent}" not found at plugins/${ctx.stack}/agents/${spec.agent}.md`);
  } else {
    // Its @include targets must still resolve (a deleted standard would break it).
    const body = read(agentPath);
    for (const m of body.matchAll(/<!-- @include (\S+) -->/g)) {
      if (!fs.existsSync(path.join(ROOT, m[1])))
        errors.push(`${where}: agent "${spec.agent}" @includes missing standard ${m[1]}`);
    }
  }

  if (!Array.isArray(spec.cases) || !spec.cases.length)
    return errors.push(`${where}: "cases" must be a non-empty array`);

  spec.cases.forEach((c, i) => {
    const cw = `${where} case[${i}]`;
    if (!c.name) errors.push(`${cw}: missing "name"`);
    if (!c.input || (c.input.file == null && c.input.text == null))
      errors.push(`${cw}: "input" must have a "file" or "text"`);
    if (c.input && c.input.file) {
      const fp = path.join(ROOT, 'plugins', ctx.stack, c.input.file);
      if (!fs.existsSync(fp)) errors.push(`${cw}: fixture not found: ${c.input.file}`);
    }
    if (c.instruction != null && typeof c.instruction !== 'string')
      errors.push(`${cw}: "instruction" must be a string when present`);
    const exp = c.expect || {};
    const mm = exp.mustMention || [];
    const mn = exp.mustNotMention || [];
    if (!Array.isArray(mm) || !Array.isArray(mn))
      errors.push(`${cw}: expect.mustMention / mustNotMention must be arrays`);
    if (!mm.length && !mn.length)
      errors.push(`${cw}: expect needs at least one mustMention or mustNotMention entry`);
  });
}

function runCheck() {
  const errors = [];
  const specs = [];
  for (const { stack, file } of evalFiles()) {
    const rel = path.relative(ROOT, file);
    let spec;
    try {
      spec = JSON.parse(read(file));
    } catch (e) {
      errors.push(`${rel}: invalid JSON — ${e.message}`);
      continue;
    }
    validateSpec(spec, { rel, stack }, errors);
    if (spec && spec.agent) specs.push({ stack, agent: spec.agent, cases: (spec.cases || []).length });
  }

  // Coverage: which agents have evals, which don't.
  const covered = new Set(specs.map((s) => `${s.stack}/${s.agent}`));
  const agents = allAgents();
  const uncovered = agents.filter((a) => !covered.has(`${a.stack}/${a.name}`));

  console.log('── Eval coverage ────────────────────────────────');
  console.log(`  agents with evals : ${covered.size}/${agents.length}`);
  for (const s of specs) console.log(`    ✓ ${s.stack}/${s.agent}  (${s.cases} case${s.cases === 1 ? '' : 's'})`);
  if (uncovered.length) {
    console.log(`  no evals yet (${uncovered.length}):`);
    for (const a of uncovered) console.log(`    · ${a.stack}/${a.name}`);
  }
  console.log('');

  if (errors.length) {
    console.error(`✗ ${errors.length} eval problem(s):`);
    for (const e of errors) console.error(`    ${e}`);
    process.exit(1);
  }
  console.log('✓ all eval files valid (agents exist, includes resolve, fixtures present)');
}

// ─── dispatch + grade (the --run layer) ──────────────────────────────────────────
// Strip YAML frontmatter → the composed agent body is the system prompt.
function agentSystemPrompt(agentPath) {
  const text = read(agentPath);
  return text.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

function inputText(c, stack) {
  if (c.input.text != null) return String(c.input.text);
  return read(path.join(ROOT, 'plugins', stack, c.input.file));
}

// Best-effort headless dispatch. Returns the agent's text output, or throws with a
// clear message if the `claude` CLI isn't available / errors.
const DEFAULT_INSTRUCTION = 'Review the material above and report your findings.';

// Read-only by construction. The agent's own `tools:` frontmatter is stripped before
// this runs, so without a restriction a case whose instruction says "implement" would
// be free to write into the working tree. An eval that mutates the repo it is grading
// is not an eval. This also makes a run hermetic: the agent works from the fixture
// text, never from whatever the repo happens to look like right now.
const EVAL_TOOLS = ['Read', 'Grep', 'Glob'];

function dispatch(systemPrompt, userPrompt, instruction) {
  const prompt = `${userPrompt}\n\n---\n${instruction || DEFAULT_INSTRUCTION}`;
  try {
    return execFileSync(
      'claude',
      ['-p', prompt, '--append-system-prompt', systemPrompt, '--tools', ...EVAL_TOOLS],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (e) {
    if (e.code === 'ENOENT')
      throw new Error('the `claude` CLI was not found on PATH — --run needs it. Use --check for CI.');
    throw new Error(`claude -p failed: ${String(e.stderr || e.message).trim()}`);
  }
}

function grade(output, expect) {
  const hay = output.toLowerCase();
  const missing = (expect.mustMention || []).filter((s) => !hay.includes(String(s).toLowerCase()));
  const forbidden = (expect.mustNotMention || []).filter((s) => hay.includes(String(s).toLowerCase()));
  return { pass: !missing.length && !forbidden.length, missing, forbidden };
}

function runDispatch() {
  let total = 0;
  let failed = 0;
  for (const { stack, file } of evalFiles()) {
    let spec;
    try {
      spec = JSON.parse(read(file));
    } catch {
      continue; // --check already reports malformed files; --run just skips them
    }
    if (filterAgent && spec.agent !== filterAgent) continue;
    const agentPath = path.join(ROOT, 'plugins', stack, 'agents', `${spec.agent}.md`);
    if (!fs.existsSync(agentPath)) continue;
    const systemPrompt = agentSystemPrompt(agentPath);

    console.log(`▶ ${stack}/${spec.agent}`);
    for (const c of spec.cases) {
      total++;
      process.stdout.write(`  · ${c.name} … `);
      let output;
      try {
        output = dispatch(systemPrompt, inputText(c, stack), c.instruction);
      } catch (e) {
        console.log(`ERROR (${e.message})`);
        failed++;
        continue;
      }
      const g = grade(output, c.expect || {});
      if (g.pass) {
        console.log('PASS');
      } else {
        failed++;
        console.log('FAIL');
        if (g.missing.length) console.log(`      expected to mention: ${g.missing.join(', ')}`);
        if (g.forbidden.length) console.log(`      should not have mentioned: ${g.forbidden.join(', ')}`);
      }
    }
  }
  console.log('');
  console.log(`${total - failed}/${total} case(s) passed`);
  if (failed) process.exit(1);
}

// ─── main ──────────────────────────────────────────────────────────────────────
if (MODE === 'run') runDispatch();
else runCheck();
