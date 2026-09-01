#!/usr/bin/env node
// Published numbers rot. The rates move every time the corpus is re-measured or
// the labs retune, and an article quoting last month's figure is wrong in a way
// nobody notices, because nothing on the page announces it.
//
// This finds those. It does not try to understand prose. It compares every
// decimal in every published page against the rates we have measured, now and
// in the past. A number that matches a current rate is fine. A number that
// matches only an older rate has moved, and the article needs a note.
//
//   node scripts/check-staleness.mjs          report, and save this week's snapshot
//   node scripts/check-staleness.mjs --dry    report only
//
// Reads:  study/rates.json  (written by build-glossary.mjs)
//         study/rates-history/*.json
// Writes: study/rates-history/<measured>.json

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HIST = join(ROOT, "study", "rates-history");
const DRY = process.argv.includes("--dry");

// How far a figure has to move before it is worth your attention. A rate that
// drifts from 3.83 to 3.80 needs no correction note; one that halves does.
const MATERIAL = 0.20;

const current = JSON.parse(readFileSync(join(ROOT, "study", "rates.json"), "utf8"));
const armName = Object.fromEntries(current.arms.map((a) => [a.key, a.name]));

// value -> [{rule, arm}] for one snapshot
function index(snap) {
  const m = new Map();
  for (const [rule, byArm] of Object.entries(snap.rates)) {
    for (const [arm, v] of Object.entries(byArm)) {
      if (v === null || v === 0) continue;          // 0.00 is too common to match on
      const k = v.toFixed(2);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push({ rule, arm });
    }
  }
  return m;
}

const nowIdx = index(current);
mkdirSync(HIST, { recursive: true });
const history = readdirSync(HIST).filter((f) => f.endsWith(".json")).sort()
  .map((f) => ({ file: f, snap: JSON.parse(readFileSync(join(HIST, f), "utf8")) }));

// Pages a reader can reach. Working notes under study/ are not published.
function pages(dir, acc = []) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (f.name.startsWith(".") || ["study", "scripts", "assets", "node_modules", "_to_delete"].includes(f.name)) continue;
    const p = join(dir, f.name);
    if (f.isDirectory()) pages(p, acc);
    else if (f.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

const findings = [];
for (const page of pages(ROOT)) {
  const html = readFileSync(page, "utf8");
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
  for (const m of text.matchAll(/(?<![\d.])(\d{1,2}\.\d{2})(?![\d])/g)) {
    const val = m[1];
    if (nowIdx.has(val)) continue;                  // still a current figure

    // Did this number used to be one of ours?
    for (let i = history.length - 1; i >= 0; i--) {
      const hit = index(history[i].snap).get(val);
      if (!hit) continue;
      for (const { rule, arm } of hit) {
        const now = current.rates[rule]?.[arm];
        if (now === null || now === undefined) continue;
        const moved = Math.abs(now - Number(val)) / Math.max(Number(val), 0.01);
        if (moved < MATERIAL) continue;
        findings.push({
          page: relative(ROOT, page).replace(/\\/g, "/"),
          quoted: val, now: now.toFixed(2), rule, arm: armName[arm] || arm,
          since: history[i].snap.measured,
          context: text.slice(Math.max(0, m.index - 70), m.index + 40).replace(/\s+/g, " ").trim(),
        });
      }
      break;                                        // newest snapshot that knew it
    }
  }
}

// "Nothing to report" has two very different causes, and until 2026-08-31 the
// output did not distinguish them: either every published figure still matches
// the current rates, or none of the snapshots on disk hold a rate that differs
// from the current ones, so there was never anything a published figure could
// be stale against. The second is not a pass, it is an absence of evidence, and
// a weekly log line that reads the same either way invites false confidence.
const movedCells = history.reduce((n, h) => {
  for (const [rule, byArm] of Object.entries(current.rates)) {
    for (const [arm, v] of Object.entries(byArm)) {
      const old = h.rates?.[rule]?.[arm];
      if (old !== undefined && old !== null && old !== v) n++;
    }
  }
  return n;
}, 0);

if (!history.length) {
  console.log(`No history yet. Saving the first snapshot (${current.measured}); drift is checked from next run.`);
} else if (!findings.length && movedCells === 0) {
  console.log(`Staleness: nothing could be stale yet. ${history.length} prior snapshot${history.length === 1 ? "" : "s"} on disk, and not one rate differs from ${current.measured}, so there is no drift for a published figure to be behind.`);
  console.log("This check only has something to say once a rate actually moves between two rebuilds.");
} else if (!findings.length) {
  console.log(`Staleness: nothing to report. ${movedCells} rate${movedCells === 1 ? " has" : "s have"} moved across ${history.length} prior snapshot${history.length === 1 ? "" : "s"}, and no published figure quotes an old value.`);
} else {
  console.log(`Staleness: ${findings.length} published figure${findings.length === 1 ? "" : "s"} ${findings.length === 1 ? "has" : "have"} moved more than ${MATERIAL * 100}% since publication.\n`);
  for (const f of findings) {
    console.log(`  ${f.page}`);
    console.log(`    quotes ${f.quoted} for ${f.rule} / ${f.arm}, measured ${f.since}`);
    console.log(`    now ${f.now}`);
    console.log(`    "...${f.context}..."\n`);
  }
  console.log("Each one needs a dated note on the article, or a correction in changelog.html.");
  console.log("Do not silently edit a published number: somebody may have quoted it.");
}

if (!DRY) {
  writeFileSync(join(HIST, `${current.measured}.json`), JSON.stringify(current, null, 2) + "\n");
}
