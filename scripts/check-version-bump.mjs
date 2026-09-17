#!/usr/bin/env node
// check-version-bump — a plugin whose content changed must declare a new version.
//
// The two-layer model means `compose-agents` rewrites every agent that composes an
// edited standard, SILENTLY and across plugins. Edit one file in common/standards and
// three plugins change on disk. Nothing then reminds you that each of them needs its
// own `version` raised — and a plugin whose version did not move is a plugin that
// installed consumers never receive. The fix ships, the catalog looks right, CI stays
// green, and the bug lives on in every machine that already had it.
//
// That is not hypothetical: it is how this guard came to exist. A standard was fixed,
// `laravel`'s two agents were recomposed, and the bump was missed by the author and by
// all five existing gates. A human caught it.
//
// The rule is deliberately blunt: ANY tracked change under plugins/<stack>/ requires
// that plugin's `version` to be strictly greater than at the baseline. A version-only
// edit satisfies it by construction, so the rule never fights a legitimate bump.
//
//   node scripts/check-version-bump.mjs [--base <ref>]
//
// Baseline resolution, in order: --base, then origin/main (via merge-base), then HEAD~1.
// When none is available — a shallow clone, or the very first commit — the check
// reports SKIP and exits 0. A gate that cannot see its input says so; it never reports
// a pass it did not verify.
//
// Compares the baseline against the WORKING TREE, so it is just as useful before you
// commit as it is in CI. No dependencies, no tokens, no network.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => (argv.indexOf(n) !== -1 ? argv[argv.indexOf(n) + 1] : null);

// stderr is PIPED, not inherited: `git show` on a path that does not exist at the
// baseline is an expected outcome here (a brand-new plugin), and a gate that prints
// `fatal:` on a successful run teaches people to ignore its output.
const git = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (args) => {
  try {
    return git(args);
  } catch {
    return null;
  }
};

// ─── baseline ────────────────────────────────────────────────────────────────────
function resolveBase() {
  const explicit = flag('--base');
  if (explicit) {
    const sha = gitOk(['rev-parse', '--verify', `${explicit}^{commit}`]);
    if (!sha) {
      console.error(`✗ --base ${explicit} is not a commit this clone can see`);
      process.exit(1);
    }
    return { ref: explicit, sha };
  }
  const remote = gitOk(['rev-parse', '--verify', 'origin/main^{commit}']);
  if (remote) {
    const mb = gitOk(['merge-base', 'origin/main', 'HEAD']);
    if (mb) return { ref: 'origin/main', sha: mb };
  }
  const parent = gitOk(['rev-parse', '--verify', 'HEAD~1^{commit}']);
  if (parent) return { ref: 'HEAD~1', sha: parent };
  return null;
}

const base = resolveBase();
if (!base) {
  console.log('⊘ version bump — SKIP, not verified: no baseline commit available');
  console.log('    (a shallow clone or the first commit — use --base <ref>, or fetch history');
  console.log('     with actions/checkout fetch-depth: 0)');
  process.exit(0);
}

// ─── semver ──────────────────────────────────────────────────────────────────────
const parse = (v) => (/^\d+\.\d+\.\d+$/.test(v || '') ? v.split('.').map(Number) : null);
const greater = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

// ─── which plugins changed ───────────────────────────────────────────────────────
const changed = (gitOk(['diff', '--name-only', base.sha]) || '')
  .split('\n')
  .filter((f) => f.startsWith('plugins/'));

const touched = new Map();
for (const f of changed) {
  const stack = f.split('/')[1];
  if (!stack || !fs.existsSync(path.join(ROOT, 'plugins', stack, '.claude-plugin', 'plugin.json'))) continue;
  if (!touched.has(stack)) touched.set(stack, []);
  touched.get(stack).push(f);
}

// ─── verdict ─────────────────────────────────────────────────────────────────────
const errors = [];
const passed = [];
for (const [stack, files] of [...touched].sort()) {
  const rel = `plugins/${stack}/.claude-plugin/plugin.json`;
  const now = parse(JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')).version);
  if (!now) {
    errors.push(`plugins/${stack}: version is not semver (x.y.z)`);
    continue;
  }

  const beforeRaw = gitOk(['show', `${base.sha}:${rel}`]);
  if (beforeRaw === null) {
    passed.push(`plugins/${stack} v${now.join('.')} — new plugin, nothing to bump from`);
    continue;
  }
  const before = parse(JSON.parse(beforeRaw).version);
  if (!before) {
    passed.push(`plugins/${stack} v${now.join('.')} — baseline version unreadable, treated as new`);
    continue;
  }

  const b = before.join('.');
  const n = now.join('.');
  if (n === b) {
    errors.push(
      `plugins/${stack}: ${files.length} file(s) changed but version is still ${b}\n` +
        files.slice(0, 6).map((f) => `        ${f}`).join('\n') +
        (files.length > 6 ? `\n        … and ${files.length - 6} more` : ''),
    );
  } else if (!greater(now, before)) {
    errors.push(`plugins/${stack}: version went BACKWARDS, ${b} → ${n}`);
  } else {
    passed.push(`plugins/${stack} ${b} → ${n} (${files.length} file(s))`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} plugin(s) changed without a version bump (baseline ${base.ref}):`);
  for (const e of errors) console.error(`    ${e}`);
  console.error('');
  console.error('  Raise "version" in the plugin.json, or installed consumers never get the change.');
  console.error('  Editing a shared standard recomposes several plugins — bump each one it touched.');
  process.exit(1);
}
console.log(
  touched.size
    ? `✓ version bumps present — baseline ${base.ref}\n` + passed.map((p) => `    ${p}`).join('\n')
    : `✓ version bumps present — no plugin content changed since ${base.ref}`,
);
