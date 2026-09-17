#!/usr/bin/env node
// check-neutrality — guard against leaking one organisation's private facts into a
// community marketplace.
//
// Agents here serve repos the author will never see, so a plugin must carry no facts
// about any single company: internal hostnames, private addresses, live credentials,
// corporate contacts. Those arrive by accident — someone harvests a useful standard
// from a private repo and a hostname rides along in an example. A human reviewer
// catches that on a good day. This catches it every day.
//
// It looks for SHAPES of leakage, not for any particular company's name, so it
// protects against organisations this repo has never heard of:
//   • internal hostnames    web01.corp.local, svc.internal
//   • private IPv4          10.x, 192.168.x, 172.16-31.x  (loopback is fine)
//   • assigned credentials  APP_KEY=<something that looks real>
//   • corporate contacts    someone@a-real-company.com
//
// Literal names are deliberately NOT in this file: writing them here would publish
// the very association the guard exists to prevent. Keep those in an untracked
// `.neutrality-local.json` at the repo root, which this script reads when present:
//
//     { "terms": ["acme", "acmecorp"], "allow": ["some-known-false-positive"] }
//
// A guard that cries wolf gets ignored, so every pattern is anchored and the common
// innocents are excluded by design: `localhost`, `PSR-12`, prose that merely NAMES a
// variable (`never commit an APP_KEY`), documented placeholders, and `example.*`
// addresses all stay quiet.
//
// It also scans GIT METADATA — the authors, committers and taggers of the commits this
// branch adds — because that is where a leak actually happened here: six commits went
// out carrying an employer address inherited from a global ~/.gitconfig, while this
// guard reported the tree clean. Metadata is checked against the LOCAL TERMS ONLY, and
// that limit is real rather than an oversight: `someone@employer.com` and
// `someone@gmail.com` are the same shape, so no pattern can tell them apart. Without an
// overlay there is no identity protection, and the script says so rather than implying
// cover it does not give.
//
// Only commits NEW since the baseline are examined, never the whole history: history
// already published is a decision its owner has made, and a gate that fails forever on
// an accepted past is a gate people switch off. The point is to catch the next one
// before it ships.
//
// Scans git-tracked text files and new-commit metadata. Exit 0 when clean, 1 with a
// report otherwise. No dependencies, no tokens, no network.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = 'scripts/check-neutrality.mjs';
const LOCAL = '.neutrality-local.json';

// A value that is obviously a stand-in, not a real credential.
const PLACEHOLDER = /^(?:["'<{$]|your[-_]|my[-_]|xxx|\.\.\.|changeme|placeholder|example|dummy|fake|test|token|secret|value|redacted|\*+$)/i;
// Hosts and mail domains that are reserved for documentation.
const DOC_DOMAIN = /(?:^|\.)(?:example\.(?:com|org|net)|example|invalid|test|localhost|noreply\.github\.com)$/i;

const RULES = [
  {
    id: 'internal-host',
    why: 'internal hostname',
    re: /\b(?![0-9]+\.)[a-z0-9][a-z0-9-]{1,62}(?:\.[a-z0-9][a-z0-9-]{1,62})*\.(?:local|internal|corp|lan|intranet)\b/gi,
    // `localhost` has no dot, so it never reaches here.
  },
  {
    id: 'private-ip',
    why: 'private network address',
    re: /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g,
  },
  {
    id: 'assigned-credential',
    why: 'credential with a real-looking value',
    re: /\b([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|CREDENTIAL))\s*[=:]\s*(\S+)/g,
    check: (m) => !PLACEHOLDER.test(m[2]) && m[2].replace(/["';,]/g, '').length >= 16,
  },
  {
    id: 'corporate-contact',
    why: 'contact address',
    re: /\b[\w.+-]+@([\w-]+(?:\.[\w-]+)+)\b/g,
    check: (m) => !DOC_DOMAIN.test(m[1]),
  },
];

// ─── optional local overlay: literal terms, never committed ──────────────────────
let allow = [];
const localRules = [];
const localPath = path.join(ROOT, LOCAL);
if (fs.existsSync(localPath)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    allow = (cfg.allow || []).map((s) => String(s).toLowerCase());
    for (const term of cfg.terms || []) {
      const esc = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      localRules.push({ id: 'local-term', why: `term from ${LOCAL}`, re: new RegExp(`\\b${esc}\\b`, 'gi') });
    }
  } catch (e) {
    console.error(`✗ ${LOCAL} is present but unreadable — ${e.message}`);
    process.exit(1);
  }
}

// ─── scan every tracked text file ────────────────────────────────────────────────
const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((f) => f !== SELF && f !== LOCAL);

const findings = [];
for (const rel of files) {
  let text;
  try {
    text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    continue;
  }
  if (text.includes('\0')) continue; // binary

  const lines = text.split('\n');
  for (const rule of [...RULES, ...localRules]) {
    for (let i = 0; i < lines.length; i++) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(lines[i])) !== null) {
        if (rule.check && !rule.check(m)) continue;
        if (allow.includes(m[0].toLowerCase())) continue;
        findings.push({ file: rel, line: i + 1, why: rule.why, hit: m[0].slice(0, 80) });
      }
    }
  }
}

// ─── git metadata: identity on the commits this branch adds ──────────────────────
const metaFindings = [];
let metaScope = null;

if (localRules.length) {
  const g = (args) => {
    try {
      return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch {
      return null;
    }
  };
  const scan = (where, text) => {
    for (const rule of localRules) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(text)) !== null) {
        if (allow.includes(m[0].toLowerCase())) continue;
        metaFindings.push({ where, hit: m[0] });
      }
    }
  };

  // The identity that will sign the next commit — always checkable, no history needed.
  scan('git config user.name / user.email', `${g(['config', 'user.name']) || ''} ${g(['config', 'user.email']) || ''}`);

  // Commits this branch adds on top of the baseline.
  const baseSha =
    (g(['rev-parse', '--verify', 'origin/main^{commit}']) && g(['merge-base', 'origin/main', 'HEAD'])) ||
    g(['rev-parse', '--verify', 'HEAD~1^{commit}']);

  if (baseSha) {
    metaScope = `${baseSha.slice(0, 7)}..HEAD`;
    const log = g(['log', `${baseSha}..HEAD`, '--format=%H%x1f%an <%ae>%x1f%cn <%ce>']) || '';
    const newShas = new Set();
    for (const line of log.split('\n').filter(Boolean)) {
      const [sha, author, committer] = line.split('\x1f');
      newShas.add(sha);
      scan(`commit ${sha.slice(0, 7)} author`, author);
      if (committer !== author) scan(`commit ${sha.slice(0, 7)} committer`, committer);
    }
    // Annotated tags pointing INTO that new range — a tagger is published too.
    for (const tag of (g(['tag']) || '').split('\n').filter(Boolean)) {
      if (!newShas.has(g(['rev-list', '-n1', tag]) || '')) continue;
      const tagger = ((g(['cat-file', '-p', tag]) || '').match(/^tagger (.+) \d+/m) || [])[1];
      if (tagger) scan(`tag ${tag} tagger`, tagger);
    }
  } else {
    metaScope = 'SKIP — no baseline commit to diff against';
  }
}

// ─── report ──────────────────────────────────────────────────────────────────────
if (findings.length || metaFindings.length) {
  const total = findings.length + metaFindings.length;
  console.error(`✗ ${total} possible leak(s) of a private organisation's facts:`);
  for (const f of findings) console.error(`    ${f.file}:${f.line} — ${f.why}: ${f.hit}`);
  for (const f of metaFindings) console.error(`    ${f.where} — ${f.hit}`);
  console.error('');
  if (findings.length) {
    console.error('  In a file: replace it with a detection instruction or a documented placeholder.');
  }
  if (metaFindings.length) {
    console.error('  In git metadata: set the right identity for THIS repo before committing —');
    console.error('      git config user.name "…" && git config user.email "…"');
    console.error('  A repo-local setting beats the global one, and it only affects new commits:');
    console.error('  rewriting what is already published is a separate, deliberate decision.');
  }
  console.error(`  A real false positive belongs in "allow" inside ${LOCAL}.`);
  process.exit(1);
}
console.log(
  `✓ no private-organisation facts — ${files.length} tracked files scanned` +
    (localRules.length
      ? `, ${localRules.length} local term(s) applied to files and git identity (${metaScope})`
      : ', no local overlay — file shapes only, git identity NOT checked'),
);
