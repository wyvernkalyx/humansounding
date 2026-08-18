#!/usr/bin/env node
// HumanSounding corpus measurement.
//
// Counts every tell the live checker knows about across a corpus of plain-text
// files, and reports a rate per 1,000 words with a bootstrap confidence
// interval. The rules are parsed out of checker.html at runtime rather than
// copied, so the study and the site can never drift apart. If a rule changes,
// rerun and the numbers change with it.
//
//   node study/measure.mjs study/corpus/ai study/corpus/human
//
// Each argument is a directory of .txt files, one document per file. Output is
// a table plus machine-readable JSON on stderr-free stdout.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// Resolved against this file, not the shell's cwd, so the study can be run
// from anywhere and still measure the checker it ships beside. fileURLToPath
// rather than URL.pathname, which on Windows returns "/D:/..." and produces
// paths like D:\D:\repo\checker.html.
const CHECKER = fileURLToPath(new URL("../checker.html", import.meta.url));
const BOOTSTRAP = 2000;
// Below this many documents per arm the script will still print rates, but it
// will not print a separation verdict. A bootstrap over four documents produces
// a tight-looking interval and a confident-looking answer, and both are
// artefacts of the sample size rather than findings.
const MIN_FOR_CLAIMS = 20;

function loadRules() {
  const src = readFileSync(CHECKER, "utf8");
  const m = src.match(/const RULES = \[[\s\S]*?\n\];/);
  if (!m) throw new Error("Could not find RULES in " + CHECKER);
  // eslint-disable-next-line no-eval
  const rules = eval(m[0].replace(/^const RULES = /, ""));
  return rules.map((r) => ({ id: r.id, label: r.label, re: r.re }));
}

function docsIn(dir) {
  const seen = new Set();
  const out = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".txt")).sort()) {
    const text = readFileSync(join(dir, f), "utf8");
    if ((text.match(/\S+/g) || []).length < 100) continue;
    // Near-duplicates are the easiest way to accidentally manufacture a
    // confidence interval. One document, one observation.
    const key = createHash("sha1").update(text.replace(/\s+/g, " ").trim().toLowerCase()).digest("hex");
    if (seen.has(key)) { console.log(`  ! skipping duplicate ${f}`); continue; }
    seen.add(key);
    out.push({ name: basename(f, ".txt"), text });
  }
  return out;
}

// Per document: hits per rule, plus words. Em-dash density is counted the way
// the checker counts it (raw dashes), not the way it flags it.
function measureDoc(text, rules) {
  const words = (text.match(/\S+/g) || []).length;
  const counts = {};
  for (const r of rules) {
    r.re.lastIndex = 0;
    counts[r.id] = (text.match(r.re) || []).length;
  }
  counts.em_dash = (text.match(/—|--/g) || []).length;
  const lens = text.split(/[.!?]+[\s"')\]]*/).map((s) => (s.match(/\S+/g) || []).length).filter((n) => n > 0);
  const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (lens.length || 1));
  return { words, counts, sentences: lens.length, meanSentence: mean, cadenceCV: mean ? sd / mean : 0 };
}

// Rate per 1000 words across a corpus, with a bootstrap CI over documents.
// Resampling documents rather than sentences keeps the unit of independence
// honest: one long AI article is one observation, not four hundred.
function rateWithCI(docs, id) {
  const per = docs.map((d) => ({ n: d.counts[id] || 0, w: d.words }));
  const point = (per.reduce((a, p) => a + p.n, 0) / per.reduce((a, p) => a + p.w, 0)) * 1000;
  const samples = [];
  for (let b = 0; b < BOOTSTRAP; b++) {
    let n = 0, w = 0;
    for (let i = 0; i < per.length; i++) {
      const p = per[(Math.random() * per.length) | 0];
      n += p.n; w += p.w;
    }
    samples.push(w ? (n / w) * 1000 : 0);
  }
  samples.sort((a, b) => a - b);
  return { rate: point, lo: samples[Math.floor(BOOTSTRAP * 0.025)], hi: samples[Math.floor(BOOTSTRAP * 0.975)] };
}

const dirs = process.argv.slice(2);
if (dirs.length < 1) { console.error("usage: node study/measure.mjs <dir> [dir2 ...]"); process.exit(1); }

const rules = loadRules();
const ids = [...rules.map((r) => r.id), "em_dash"];
const labels = Object.fromEntries([...rules.map((r) => [r.id, r.label]), ["em_dash", "Em dashes (raw)"]]);

const arms = dirs.map((dir) => {
  if (!statSync(dir).isDirectory()) throw new Error(dir + " is not a directory");
  const docs = docsIn(dir).map((d) => ({ name: d.name, ...measureDoc(d.text, rules) }));
  return { arm: basename(dir), dir, docs };
});

for (const a of arms) {
  const w = a.docs.reduce((s, d) => s + d.words, 0);
  console.log(`\n${a.arm}: ${a.docs.length} documents, ${w.toLocaleString()} words`);
  if (a.docs.length < 20) console.log(`  ! ${a.docs.length} documents is thin. Treat the interval as indicative, not publishable.`);
  // Provenance is the whole argument in the human arm. A number without it is
  // not evidence, it is a number.
  if (!existsSync(join(a.dir, "MANIFEST.tsv"))) console.log(`  ! no MANIFEST.tsv in ${a.dir}. These documents have no recorded provenance.`);
}

const empty = arms.filter((a) => a.docs.length === 0);
if (empty.length) {
  console.log(`\nNothing to measure in: ${empty.map((a) => a.dir).join(", ")}`);
  console.log("Add .txt documents of 100 words or more, then run again.");
  console.log("For the AI arm: ANTHROPIC_API_KEY=... node study/generate.mjs --n 5");
  process.exit(0);
}

console.log("\nRate per 1,000 words (95% CI over documents)\n");
const head = "tell".padEnd(24) + arms.map((a) => a.arm.padStart(26)).join("");
console.log(head);
console.log("-".repeat(head.length));
const out = { generated: new Date().toISOString(), checker: CHECKER, arms: {}, rules: ids };
for (const a of arms) out.arms[a.arm] = { documents: a.docs.length, words: a.docs.reduce((s, d) => s + d.words, 0), rates: {} };
for (const id of ids) {
  let row = (labels[id] || id).slice(0, 23).padEnd(24);
  for (const a of arms) {
    const r = rateWithCI(a.docs, id);
    out.arms[a.arm].rates[id] = r;
    row += `${r.rate.toFixed(2)} [${r.lo.toFixed(2)}-${r.hi.toFixed(2)}]`.padStart(26);
  }
  console.log(row);
}
const cad = (a) => a.docs.reduce((s, d) => s + d.cadenceCV, 0) / (a.docs.length || 1);
console.log("\n" + "sentence-length CV".padEnd(24) + arms.map((a) => cad(a).toFixed(3).padStart(26)).join(""));

// Non-overlapping intervals are the only claim this design supports.
if (arms.length === 2 && arms.every((a) => a.docs.length >= MIN_FOR_CLAIMS)) {
  console.log("\nSeparated (95% intervals do not overlap):");
  let any = false;
  for (const id of ids) {
    const [x, y] = arms.map((a) => out.arms[a.arm].rates[id]);
    if (x.lo > y.hi || y.lo > x.hi) { any = true; console.log(`  ${labels[id]}: ${x.rate.toFixed(2)} vs ${y.rate.toFixed(2)}`); }
  }
  if (!any) console.log("  none. On this corpus, no tell separates the two arms.");
} else if (arms.length === 2) {
  console.log(`\nSeparation verdict suppressed: needs ${MIN_FOR_CLAIMS}+ documents in each arm.`);
}
console.log("\nJSON:");
console.log(JSON.stringify(out));
