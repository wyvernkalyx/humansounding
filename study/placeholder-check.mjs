#!/usr/bin/env node
// Does template placeholder text move any of the published rules?
//
// The AI arms carry bracket placeholders -- [Your Name], [Company], [Date] --
// in 14 to 35 of 40 documents each. The human arms carry almost none, and the
// few they do carry are footnote markers and editorial insertions rather than
// template slots. That is an asymmetry between the arms that has nothing to do
// with how a model writes, and every rate this project publishes was measured
// with it in place.
//
// This script answers the narrow question: if the bracketed spans were not
// there, would any published number change, and would any separation verdict
// flip?
//
//   node study/placeholder-check.mjs study/corpus/ai study/corpus/human
//
// Method. Every bracketed span is DELETED from every arm, so the treatment is
// identical on both sides and cannot itself introduce an asymmetry. The
// measurement is not reimplemented here: the script shells out to measure.mjs
// twice, once on the corpora as they are and once on stripped copies, and
// diffs the two JSON payloads. Same reason the study parses RULES out of
// checker.html instead of copying them -- a second implementation of a metric
// drifts, and the first sign of it is a number nobody can reproduce.
//
// The stripped copies keep their arm's directory basename. measure.mjs derives
// its bootstrap seed from `${arm}:${rule}`, so a renamed directory would move
// every confidence interval for reasons that have nothing to do with stripping.
//
// LIMITATION, and it bounds what this can conclude. Deleting [Your Name] is not
// the same as filling it in. A human writing the same letter would put two
// capitalised tokens there, so the stripped AI arms understate what a completed
// template would score on anything keyed to proper nouns. This measures the
// size of the scaffolding, not what the document would look like if a person
// finished it. The substitution counterfactual is a different run and is not
// this one.

import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { measureDoc as substanceDoc } from "./lib/substance-metrics.mjs";

const MEASURE = fileURLToPath(new URL("./measure.mjs", import.meta.url));

// A bracketed span on one line, up to 60 characters. Deliberately broad: it
// catches the human arms' [1] and [emphasis added] as well as the model arms'
// [Company Name], because a rule applied to one side only is not a control.
const BRACKET = /\[[^\]\n]{1,60}\]/g;

const strip = (t) =>
  t.replace(BRACKET, "")
    // A deleted span leaves doubled spaces, and a line that was nothing but a
    // placeholder leaves a blank line inside a paragraph. Neither is prose.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n");

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error("usage: node study/placeholder-check.mjs <corpus-dir> [dir2 ...]");
  process.exit(1);
}

const root = join(tmpdir(), `hs-placeholder-${process.pid}`);
const strippedDirs = [];
const survey = [];

for (const dir of dirs) {
  const arm = basename(dir);
  const out = join(root, arm);
  mkdirSync(out, { recursive: true });
  let docs = 0, withPh = 0, spans = 0, wordsBefore = 0, wordsAfter = 0;
  const examples = new Map();

  for (const f of readdirSync(dir).filter((f) => f.endsWith(".txt")).sort()) {
    const text = readFileSync(join(dir, f), "utf8");
    const hits = text.match(BRACKET) || [];
    const out1 = strip(text);
    docs++;
    if (hits.length) withPh++;
    spans += hits.length;
    for (const h of hits) examples.set(h, (examples.get(h) || 0) + 1);
    wordsBefore += (text.match(/\S+/g) || []).length;
    wordsAfter += (out1.match(/\S+/g) || []).length;
    writeFileSync(join(out, f), out1);
  }
  // measure.mjs warns when an arm has no MANIFEST. Copy it so the stripped run
  // does not emit a provenance warning the original run did not.
  try { writeFileSync(join(out, "MANIFEST.tsv"), readFileSync(join(dir, "MANIFEST.tsv"))); } catch { /* arm has none */ }

  strippedDirs.push(out);
  survey.push({ arm, docs, withPh, spans, wordsBefore, wordsAfter,
    top: [...examples.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) });
}

const run = (ds) => {
  const stdout = execFileSync(process.execPath, [MEASURE, ...ds], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const line = stdout.trim().split("\n").pop();
  return JSON.parse(line);
};

const before = run(dirs.map((d) => resolve(d)));
const after = run(strippedDirs);

console.log("\n=== What was removed ===\n");
console.log("arm".padEnd(18) + "docs".padStart(6) + "w/ph".padStart(6) + "spans".padStart(7) +
  "words before".padStart(14) + "words after".padStart(13) + "  loss");
for (const s of survey) {
  const loss = s.wordsBefore ? ((s.wordsBefore - s.wordsAfter) / s.wordsBefore) * 100 : 0;
  console.log(s.arm.padEnd(18) + String(s.docs).padStart(6) + String(s.withPh).padStart(6) +
    String(s.spans).padStart(7) + s.wordsBefore.toLocaleString().padStart(14) +
    s.wordsAfter.toLocaleString().padStart(13) + `  ${loss.toFixed(2)}%`);
}

console.log("\n=== Rate change per rule (per 1,000 words) ===");
console.log("Blank means the rate did not move at the second decimal.\n");
for (const arm of Object.keys(before.arms)) {
  const b = before.arms[arm].rates, a = after.arms[arm].rates;
  const moved = before.rules.filter((id) => Math.abs((b[id]?.rate ?? 0) - (a[id]?.rate ?? 0)) >= 0.005);
  if (!moved.length) { console.log(`${arm}: no rule moved.`); continue; }
  console.log(`${arm}:`);
  for (const id of moved) {
    const d = a[id].rate - b[id].rate;
    const pct = b[id].rate ? (d / b[id].rate) * 100 : Infinity;
    console.log("  " + id.padEnd(24) + b[id].rate.toFixed(2).padStart(8) + " -> " +
      a[id].rate.toFixed(2).padStart(8) + `   ${d >= 0 ? "+" : ""}${d.toFixed(2)}` +
      (Number.isFinite(pct) ? ` (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""));
  }
}

// Separation is the claim the site actually publishes, so it is the thing that
// has to be checked -- a rate can move without any verdict changing, and a
// verdict can flip on a rate that barely moved.
console.log("\n=== Separation verdicts, every arm pair ===");
console.log("Reported only where both arms clear the 20-document bar.\n");
const armNames = Object.keys(before.arms);
const sep = (set, x, y, id) => {
  const p = set.arms[x].rates[id], q = set.arms[y].rates[id];
  return p.lo > q.hi || q.lo > p.hi;
};
let flips = 0;
for (let i = 0; i < armNames.length; i++) {
  for (let j = i + 1; j < armNames.length; j++) {
    const [x, y] = [armNames[i], armNames[j]];
    if (before.arms[x].documents < 20 || before.arms[y].documents < 20) continue;
    for (const id of before.rules) {
      const wasSep = sep(before, x, y, id), nowSep = sep(after, x, y, id);
      if (wasSep !== nowSep) {
        flips++;
        console.log(`  FLIP  ${x} vs ${y}  ${id}: ${wasSep ? "separated -> not" : "not -> separated"}` +
          `  (${before.arms[x].rates[id].rate.toFixed(2)}/${before.arms[y].rates[id].rate.toFixed(2)}` +
          ` -> ${after.arms[x].rates[id].rate.toFixed(2)}/${after.arms[y].rates[id].rate.toFixed(2)})`);
      }
    }
  }
}
if (!flips) console.log("  No separation verdict changed in any pair.");

// The substance metrics are the exposed ones by construction: proper_nouns
// counts capitalised non-sentence-initial tokens, and [Your Name] is two of
// them. Specificity was about to be promoted to a first-class metric, so the
// size of this effect decides whether that promotion survives.
console.log("\n=== Substance metrics, before -> after ===");
console.log("specificity = numerals + proper nouns per 1,000 words.\n");
console.log("arm".padEnd(18) + "specificity".padStart(22) + "proper nouns".padStart(22) + "numerals".padStart(20));
for (const dir of dirs) {
  const arm = basename(dir);
  const agg = (d) => {
    let w = 0, spec = 0, pn = 0, num = 0;
    for (const f of readdirSync(d).filter((f) => f.endsWith(".txt")).sort()) {
      const t = readFileSync(join(d, f), "utf8");
      if ((t.match(/\S+/g) || []).length < 100) continue;
      const m = substanceDoc(t);
      w += m.words; spec += m.counts.specificity; pn += m.counts.proper_nouns; num += m.counts.numerals;
    }
    return w ? { spec: (spec / w) * 1000, pn: (pn / w) * 1000, num: (num / w) * 1000 } : { spec: 0, pn: 0, num: 0 };
  };
  const b = agg(dir), a = agg(join(root, arm));
  const cell = (x, y) => `${x.toFixed(1)} -> ${y.toFixed(1)} (${y - x >= 0 ? "+" : ""}${(y - x).toFixed(1)})`;
  console.log(arm.padEnd(18) + cell(b.spec, a.spec).padStart(22) + cell(b.pn, a.pn).padStart(22) + cell(b.num, a.num).padStart(20));
}

rmSync(root, { recursive: true, force: true });
console.log("");
