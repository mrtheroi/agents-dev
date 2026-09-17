#!/usr/bin/env node
// check-manifest — integrity guard for the marketplace manifest and every plugin.
//
// A broken .claude-plugin/marketplace.json or a plugin someone forgot to register
// breaks `/plugin marketplace add` / `/plugin install` for the WHOLE team, silently,
// until a dev hits it. This is the cheap CI gate that catches it on the PR instead.
//
// It verifies, with zero dependencies (Node >= 18):
//   • marketplace.json is valid JSON with a non-empty plugins array.
//   • every registered plugin has name/source/description, its source dir exists,
//     and that dir has a valid .claude-plugin/plugin.json with a name + semver version.
//   • no ORPHAN plugin: every plugins/<dir> that has a .claude-plugin/plugin.json is
//     registered in marketplace.json (a plugin added but not wired in).
//
// Exit 0 when clean, 1 with a list of problems otherwise. No tokens, no network.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(p, 'utf8');
const isSemver = (v) => typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v);
const errors = [];
const err = (m) => errors.push(m);

// ─── marketplace.json ─────────────────────────────────────────────────────────
const marketplacePath = path.join(ROOT, '.claude-plugin', 'marketplace.json');
let manifest;
try {
  manifest = JSON.parse(read(marketplacePath));
} catch (e) {
  console.error(`✗ .claude-plugin/marketplace.json: ${e.code === 'ENOENT' ? 'not found' : 'invalid JSON — ' + e.message}`);
  process.exit(1);
}
if (!Array.isArray(manifest.plugins) || !manifest.plugins.length) {
  console.error('✗ marketplace.json: "plugins" must be a non-empty array');
  process.exit(1);
}

// ─── each registered plugin ─────────────────────────────────────────────────────
const registeredSources = new Set();
for (const p of manifest.plugins) {
  const label = p && p.name ? `plugin "${p.name}"` : 'a plugin entry';
  if (!p || typeof p !== 'object') { err(`${label}: not an object`); continue; }
  for (const field of ['name', 'source', 'description']) {
    if (!p[field] || typeof p[field] !== 'string') err(`${label}: missing string "${field}"`);
  }
  if (!p.source) continue;
  registeredSources.add(p.source.replace(/^\.\//, '').replace(/\/$/, ''));

  const srcDir = path.join(ROOT, p.source);
  if (!fs.existsSync(srcDir)) { err(`${label}: source dir does not exist: ${p.source}`); continue; }

  const pjPath = path.join(srcDir, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(pjPath)) { err(`${label}: no .claude-plugin/plugin.json under ${p.source}`); continue; }
  let pj;
  try {
    pj = JSON.parse(read(pjPath));
  } catch (e) {
    err(`${label}: ${p.source}/.claude-plugin/plugin.json is invalid JSON — ${e.message}`);
    continue;
  }
  if (!pj.name || typeof pj.name !== 'string') err(`${label}: plugin.json missing string "name"`);
  if (!isSemver(pj.version)) err(`${label}: plugin.json "version" must be semver (x.y.z), got ${JSON.stringify(pj.version)}`);
}

// ─── orphan check: a plugin on disk that nobody registered ───────────────────────
const pluginsDir = path.join(ROOT, 'plugins');
if (fs.existsSync(pluginsDir)) {
  for (const dir of fs.readdirSync(pluginsDir)) {
    const pjPath = path.join(pluginsDir, dir, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(pjPath)) continue; // not a plugin (e.g. _TEMPLATE.md)
    if (!registeredSources.has(`plugins/${dir}`))
      err(`plugins/${dir} has a plugin.json but is NOT registered in marketplace.json (run scripts/new-plugin.mjs or add it)`);
  }
}

// ─── report ──────────────────────────────────────────────────────────────────────
if (errors.length) {
  console.error(`✗ ${errors.length} manifest problem(s):`);
  for (const e of errors) console.error(`    ${e}`);
  process.exit(1);
}
console.log(`✓ marketplace manifest valid — ${manifest.plugins.length} plugins registered, all sources & plugin.json present`);
