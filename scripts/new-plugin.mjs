#!/usr/bin/env node
// new-plugin — scaffold a new marketplace plugin from a JSON config.
//
// Companion to the "Plugin Designer" Artifact (a visual form that emits the
// config). This script is the half that actually touches the repo: it reads a
// config object, materializes plugins/<stack>/ (plugin.json + agents/commands/
// skills/scripts), registers the plugin in .claude-plugin/marketplace.json, and
// then runs compose-agents + build-catalog so README.md / docs/marketplace.html
// stay in sync. Zero dependencies (Node >= 18).
//
// Usage:
//   node scripts/new-plugin.mjs --config path/to/plugin.json
//   node scripts/new-plugin.mjs < plugin.json            # config from stdin
//   node scripts/new-plugin.mjs --config x.json --dry-run # preview, write nothing
//   node scripts/new-plugin.mjs --config x.json --no-build # skip compose/catalog
//
// Config shape (everything except name + plugin.description is optional):
//   {
//     "name": "python",
//     "source": "./plugins/python",          // derived from name if absent
//     "marketplaceDescription": "...",        // entry blurb in marketplace.json
//     "plugin": {
//       "description": "...",                 // required
//       "version": "0.1.0",
//       "author": { "name": "claude-dev-agents contributors" },
//       "keywords": ["python"]
//     },
//     "agents":   [{ "name", "description", "tools"?, "model"?, "body"?, "includes"?: [] }],
//     "commands": [{ "name", "description", "body"? }],
//     "skills":   [{ "name", "description", "body"? }],
//     "scripts":  [{ "filename": "foo.mjs", "body"? }]
//   }
//
// `includes` on an agent is a list of standard slugs under plugins/common/standards/
// (e.g. "subagent-contract", "code-review", "engineering-principles"); each becomes
// an `<!-- @include ... -->` directive that compose-agents.mjs expands in place.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const DRY = has('--dry-run');
const NO_BUILD = has('--no-build');

function flagValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// ─── load config (from --config <path> or stdin) ─────────────────────────────
function readConfig() {
  const cfgPath = flagValue('--config');
  let raw;
  if (cfgPath) {
    if (!fs.existsSync(cfgPath)) die(`config not found: ${cfgPath}`);
    raw = fs.readFileSync(cfgPath, 'utf8');
  } else {
    try {
      raw = fs.readFileSync(0, 'utf8'); // fd 0 = stdin
    } catch {
      raw = '';
    }
    if (!raw.trim()) {
      die('no config: pass --config <path> or pipe JSON via stdin. See --help.');
    }
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    die(`config is not valid JSON: ${e.message}`);
  }
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

if (has('--help') || has('-h')) {
  console.log(
    [
      'new-plugin — scaffold a marketplace plugin from a JSON config.',
      '',
      'Usage:',
      '  node scripts/new-plugin.mjs --config plugin.json',
      '  node scripts/new-plugin.mjs < plugin.json',
      '',
      'Flags:',
      '  --config <path>  read config from a file (else stdin)',
      '  --dry-run        print the file plan, write nothing',
      '  --no-build       skip compose-agents + build-catalog',
      '',
      'Generate the config with the "Plugin Designer" Artifact.',
    ].join('\n'),
  );
  process.exit(0);
}

const cfg = readConfig();

// ─── validate ────────────────────────────────────────────────────────────────
const name = (cfg.name || '').trim();
if (!name) die('config.name is required (e.g. "python").');
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  die(`invalid name "${name}" — use lowercase kebab-case (letters, digits, dashes).`);
}
if (!cfg.plugin || !String(cfg.plugin.description || '').trim()) {
  die('config.plugin.description is required.');
}

const source = (cfg.source || `./plugins/${name}`).trim();
const pluginDir = path.join(ROOT, source);

const marketplacePath = path.join(ROOT, '.claude-plugin/marketplace.json');
const marketplace = JSON.parse(read(marketplacePath));
if (marketplace.plugins.some((p) => p.name === name)) {
  die(`a plugin named "${name}" is already registered in marketplace.json.`);
}
if (fs.existsSync(pluginDir)) {
  die(`directory already exists: ${path.relative(ROOT, pluginDir)} — pick another name/source.`);
}

// ─── build the file plan ─────────────────────────────────────────────────────
const writes = []; // { path, content }
const queue = (rel, content) => writes.push({ path: path.join(pluginDir, rel), content });

const author = cfg.plugin.author || marketplace.owner || { name: 'claude-dev-agents contributors' };
const pluginJson = {
  name,
  description: cfg.plugin.description.trim(),
  version: cfg.plugin.version || '0.1.0',
  author,
  ...(Array.isArray(cfg.plugin.keywords) && cfg.plugin.keywords.length
    ? { keywords: cfg.plugin.keywords }
    : {}),
};
queue('.claude-plugin/plugin.json', JSON.stringify(pluginJson, null, 2) + '\n');

const slug = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function frontmatter(fields) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || v === '') continue;
    lines.push(`${k}: ${v}`);
  }
  lines.push('---');
  return lines.join('\n');
}

// Agents
for (const a of cfg.agents || []) {
  const an = slug(a.name);
  if (!an) die('every agent needs a name.');
  if (!String(a.description || '').trim()) die(`agent "${an}" needs a description.`);
  const fm = frontmatter({
    name: an,
    description: a.description.trim(),
    tools: a.tools,
    model: a.model,
  });
  let body = (a.body || `You are the ${an} subagent.\n\n## Role\n\nDescribe what this agent does.`).trimEnd();
  const includes = Array.isArray(a.includes) ? a.includes : [];
  if (includes.length) {
    const directives = includes
      .map((slugName) => `<!-- @include plugins/common/standards/${slug(slugName)}.md -->`)
      .join('\n');
    body += `\n\n## Subagent signal (required)\n\n${directives}`;
  }
  queue(`agents/${an}.md`, `${fm}\n\n${body}\n`);
}

// Commands
for (const c of cfg.commands || []) {
  const cn = slug(c.name);
  if (!cn) die('every command needs a name.');
  const fm = frontmatter({ description: (c.description || '').trim() });
  const body = (c.body || `Describe what /${cn} does and how to invoke it.`).trimEnd();
  queue(`commands/${cn}.md`, `${fm}\n\n${body}\n`);
}

// Skills
for (const s of cfg.skills || []) {
  const sn = slug(s.name);
  if (!sn) die('every skill needs a name.');
  const fm = frontmatter({ name: sn, description: (s.description || '').trim() });
  const body = (s.body || `# ${sn}\n\nSkill instructions go here.`).trimEnd();
  queue(`skills/${sn}/SKILL.md`, `${fm}\n\n${body}\n`);
}

// Scripts
for (const sc of cfg.scripts || []) {
  let fn = String(sc.filename || '').trim();
  if (!fn) die('every script needs a filename.');
  if (!/\.[a-z]+$/.test(fn)) fn += '.mjs';
  const body = (sc.body || '#!/usr/bin/env node\n').replace(/\s*$/, '\n');
  queue(`scripts/${fn}`, body);
}

// ─── execute ─────────────────────────────────────────────────────────────────
const rel = (p) => path.relative(ROOT, p);
console.log(`Plugin: ${name}  →  ${source}`);
for (const w of writes) console.log(`  ${DRY ? 'would write' : 'write'}  ${rel(w.path)}`);
console.log(`  ${DRY ? 'would register' : 'register'}  ${rel(marketplacePath)}  (+ "${name}")`);

if (DRY) {
  console.log('\n(dry run — nothing written)');
  process.exit(0);
}

for (const w of writes) {
  fs.mkdirSync(path.dirname(w.path), { recursive: true });
  fs.writeFileSync(w.path, w.content);
}

// Register in marketplace.json (append, preserve 2-space formatting + newline).
// displayName is the human-friendly headline shown in the catalog; the technical
// `name` stays the install id. Derive a sensible default when not provided.
const displayName =
  (cfg.displayName || '').trim() ||
  name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
marketplace.plugins.push({
  name,
  displayName,
  source,
  description: (cfg.marketplaceDescription || cfg.plugin.description).trim(),
});
fs.writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + '\n');

// Regenerate the composed agents + README/HTML catalog.
if (!NO_BUILD) {
  const node = process.execPath;
  try {
    console.log('\n› compose-agents');
    execFileSync(node, [path.join(ROOT, 'scripts/compose-agents.mjs')], { stdio: 'inherit' });
    console.log('› build-catalog');
    execFileSync(node, [path.join(ROOT, 'scripts/build-catalog.mjs')], { stdio: 'inherit' });
  } catch (e) {
    console.error(`\n⚠ scaffold written, but a build step failed: ${e.message}`);
    console.error('  fix the issue and re-run compose-agents.mjs / build-catalog.mjs.');
    process.exit(1);
  }
}

console.log(`\n✓ plugin "${name}" scaffolded. Review ${source} and bump version when ready.`);
