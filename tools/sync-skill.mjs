#!/usr/bin/env node
// sync-skill.mjs — make skill/SKILL.md in this repo match the account skill.
//
// Ownership, decided 2026-09-09:
//   - The ACCOUNT copy owns the rules. It is the only copy a human can edit
//     (via a skill proposal card), and no tool can write it, so it is source
//     of truth by necessity rather than by preference.
//   - CI owns the fenced <!-- TRENDING:START/END --> block. The Monday
//     "Weekly trend refresh" action writes it. This script never touches it.
//
// The repo file is therefore: account body, with the repo's own TRENDING block
// spliced back in. Run it from a Claude session, where the account copy is on
// disk; it is not visible to GitHub Actions.
//
//   node tools/sync-skill.mjs           write skill/SKILL.md and report
//   node tools/sync-skill.mjs --check   report only; exit 3 if they differ
//
// Exit codes: 0 in sync (or written), 3 drift found under --check,
//             1 a file or a TRENDING marker is missing.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const SKILL = "humansounding";
const BLOCK = /<!-- TRENDING:START -->[\s\S]*?<!-- TRENDING:END -->/;

const here = dirname(fileURLToPath(import.meta.url));
const repoFile = resolve(process.env.SKILL_REPO_FILE ?? join(here, "..", "skill", "SKILL.md"));

// The account copy lands in a synced/<uuid>/<skill>/ directory whose uuid is not
// stable, so search rather than hardcode.
function findAccountCopy() {
  if (process.env.SKILL_ACCOUNT_FILE) return process.env.SKILL_ACCOUNT_FILE;
  const roots = [
    join(homedir(), ".claude", "skills", "synced"),
    join(homedir(), ".claude", "skills"),
    "/root/.claude/skills/synced",
  ];
  const hits = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      const candidate = join(root, entry, SKILL, "SKILL.md");
      if (existsSync(candidate)) hits.push(candidate);
    }
  }
  if (hits.length === 0) return null;
  // Newest wins if an old synced directory was left behind.
  return hits.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

const die = (msg) => { console.error(`sync-skill: ${msg}`); process.exit(1); };

const accountFile = findAccountCopy();
if (!accountFile) die(`no account copy of "${SKILL}" found. Run this from a Claude session, or set SKILL_ACCOUNT_FILE.`);
if (!existsSync(repoFile)) die(`repo file not found: ${repoFile}`);

const lf = (s) => s.replace(/\r\n/g, "\n");
const account = lf(readFileSync(accountFile, "utf8"));
const repo = lf(readFileSync(repoFile, "utf8"));

if (!BLOCK.test(account)) die("account copy has no TRENDING block. Refusing to guess; fix the account skill first.");
if (!BLOCK.test(repo)) die("repo copy has no TRENDING block. The Monday refresh writes it; do not remove the markers.");

// Account body + repo's CI-owned trending block.
const merged = account.replace(BLOCK, repo.match(BLOCK)[0]);

const version = (s) => (s.match(/^Version\s+([^,\n]+)/m) ?? [, "unknown"])[1];
const label = `account ${version(account)} → repo ${version(repo)}`;

if (merged === repo) {
  console.log(`in sync (${version(repo)}). Nothing to do.`);
  process.exit(0);
}

if (process.argv.includes("--check")) {
  console.error(`DRIFT: skill/SKILL.md does not match the account copy (${label}).`);
  console.error(`Run: node tools/sync-skill.mjs`);
  console.error(`If the REPO is the side that is ahead, do not run it — that would`);
  console.error(`discard the repo's edits. Propose them as a skill change instead,`);
  console.error(`accept the card, then sync.`);
  process.exit(3);
}

writeFileSync(repoFile, merged, "utf8"); // LF, to match the repo
console.log(`wrote ${repoFile} (${label})`);
console.log(`TRENDING block preserved from the repo. Review 'git diff' before committing.`);
