#!/usr/bin/env node
// Slop experiment analysis. 2026-09-02.
// Protocol and locked metrics: study/slop/PREREGISTRATION.md
//
//   node study/slop.mjs [--docs study/slop/docs] [--labels study/slop/LABELS.tsv]
//
// Refuses to run if the design constraints in the preregistration are not met,
// rather than printing numbers from a design that cannot support them.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { measureDoc } from "./lib/substance-metrics.mjs";

const BOOTSTRAP = 2000;
const STUDY_SEED = 20260831;
const root = fileURLToPath(new URL(".", import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i === -1 ? d : argv[i + 1]; };
const FORCE = argv.includes("--force");

function seedFrom(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

// Bootstrap CI on the DIFFERENCE of two group means. Resamples each group
// independently, which is the right unit here: one document, one observation.
function diffCI(a, b, tag) {
  const rand = mulberry32((seedFrom(tag) ^ STUDY_SEED) >>> 0);
  const mean = (x) => x.reduce((s, v) => s + v, 0) / (x.length || 1);
  const point = mean(a) - mean(b);
  const s = [];
  for (let i = 0; i < BOOTSTRAP; i++) {
    let ta = 0, tb = 0;
    for (let j = 0; j < a.length; j++) ta += a[(rand() * a.length) | 0];
    for (let j = 0; j < b.length; j++) tb += b[(rand() * b.length) | 0];
    s.push(ta / a.length - tb / b.length);
  }
  s.sort((x, y) => x - y);
  return { diff: point, lo: s[Math.floor(BOOTSTRAP * 0.025)], hi: s[Math.floor(BOOTSTRAP * 0.975)],
           a: mean(a), b: mean(b), na: a.length, nb: b.length };
}
const clears = (r) => (r.lo > 0 && r.hi > 0) || (r.lo < 0 && r.hi < 0);

// ---- load ------------------------------------------------------------------
// Labels are keyed by passage number, not filename. The labeller never sees a
// filename, because a filename names the arm and an arm names the authorship.
// Same protocol as study/reedit/2026-09-01.
const LABELS_F = arg("--labels", join(root, "slop", "SLOP-LABELS.tsv"));
const KEY_F    = arg("--key",    join(root, "slop", "SLOP-KEY.tsv"));
const CORPUS   = join(root, "corpus");

function tsv(path) {
  if (!existsSync(path)) { console.error(`missing ${path}`); process.exit(1); }
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
  const head = lines[0].split("\t").map((h) => h.trim());
  return lines.slice(1).map((l) => Object.fromEntries(l.split("\t").map((v, i) => [head[i], (v || "").trim()])));
}

const labelRows = tsv(LABELS_F);
const keyRows = Object.fromEntries(tsv(KEY_F).map((r) => [r.n, r]));

const docs = [];
const problems = [];
const unlabelled = [];
for (const r of labelRows) {
  const k = keyRows[r.n];
  if (!k) { problems.push(`passage ${r.n} has no key row`); continue; }
  const label = (r.label || "").toLowerCase();
  if (!label) { unlabelled.push(r.n); continue; }
  if (!["slop", "good"].includes(label)) { problems.push(`passage ${r.n}: label "${r.label}" is not slop|good`); continue; }
  const p = join(CORPUS, k.arm, k.file);
  if (!existsSync(p)) { problems.push(`passage ${r.n}: source missing at ${k.arm}/${k.file}`); continue; }
  const m = measureDoc(readFileSync(p, "utf8"));
  const c = m.counts;
  docs.push({
    n: r.n, file: `p${r.n}`, label, confidence: (r.confidence || "").toLowerCase(),
    notes: r.notes || "", authorship: k.authorship, genre: k.arm,
    words: m.words, sentences: m.sentences,
    sn_rate: c.sn_total / m.words * 1000,
    specificity: (c.numerals + c.proper_nouns) / m.words * 1000,
    claim_unbacked_share: c.claim_sentences ? c.claim_unbacked / c.claim_sentences : null,
    person_drift: (c.spp >= 5 && c.fpp >= 1 && c.fpp <= 2) ? 1 : 0,
    lexical_density: c.lexical_density,
    raw: c,
  });
}
if (unlabelled.length) problems.push(`${unlabelled.length} passage(s) still unlabelled: ${unlabelled.slice(0, 12).join(", ")}${unlabelled.length > 12 ? "..." : ""}`);
if (!docs.length) { console.error("\nNo labelled passages yet. Fill in SLOP-LABELS.tsv first.\n"); process.exit(1); }

// ---- design guard ----------------------------------------------------------
const slop = docs.filter((d) => d.label === "slop");
const good = docs.filter((d) => d.label === "good");
const cnt = (set, a) => set.filter((d) => d.authorship === a).length;
const guard = [...problems];
if (slop.length < 10 || good.length < 10) guard.push(`piles are ${slop.length} slop / ${good.length} good; each needs at least 10 to support a comparison`);
for (const [name, set] of [["slop", slop], ["good", good]]) {
  if (cnt(set, "human") < 6) guard.push(`${name} pile has ${cnt(set, "human")} human-authored, needs >=6 (H2 cannot be tested otherwise)`);
  if (cnt(set, "ai") < 6) guard.push(`${name} pile has ${cnt(set, "ai")} ai-authored, needs >=6 (H2 cannot be tested otherwise)`);
}

console.log(`\nloaded ${docs.length} documents  |  ${slop.length} slop, ${good.length} good`);
console.log(`authorship  slop: ${cnt(slop,"human")}h/${cnt(slop,"ai")}ai/${cnt(slop,"mixed")}mixed/${cnt(slop,"unknown")}unk` +
            `   good: ${cnt(good,"human")}h/${cnt(good,"ai")}ai/${cnt(good,"mixed")}mixed/${cnt(good,"unknown")}unk`);
const genres = [...new Set(docs.map((d) => d.genre).filter(Boolean))];
for (const g of genres) console.log(`  genre ${g.padEnd(12)} slop ${slop.filter(d=>d.genre===g).length}  good ${good.filter(d=>d.genre===g).length}`);

if (guard.length) {
  console.log("\n!! DESIGN NOT MET — the preregistration says do not read numbers off this:");
  for (const g of guard) console.log("   - " + g);
  if (!FORCE) { console.log("\n   Fix the above, or pass --force to print anyway (and say so in any writeup).\n"); process.exit(2); }
  console.log("   --force given. Numbers below are not preregistered-valid.\n");
}

// ---- H1: does it separate on the SLOP label? -------------------------------
const METRICS = [
  ["sn_rate", "self-narration /1k", "primary"],
  ["specificity", "specificity /1k", "primary"],
  ["claim_unbacked_share", "unbacked claim share", "secondary"],
  ["person_drift", "person drift (0/1)", "secondary"],
  ["lexical_density", "lexical density", "CONTROL, expect null"],
];
const vals = (set, m) => set.map((d) => d[m]).filter((v) => v !== null && !Number.isNaN(v));

console.log("\n=== H1  slop vs good  (primary test) ===");
console.log("metric".padEnd(24), "slop".padStart(9), "good".padStart(9), "diff".padStart(9), "  95% CI of diff        verdict");
for (const [m, label, tier] of METRICS) {
  const r = diffCI(vals(slop, m), vals(good, m), `H1:${m}`);
  console.log(label.padEnd(24), r.a.toFixed(2).padStart(9), r.b.toFixed(2).padStart(9), r.diff.toFixed(2).padStart(9),
    `  [${r.lo.toFixed(2)}, ${r.hi.toFixed(2)}]`.padEnd(24), clears(r) ? "SEPARATES" : "no", tier === "CONTROL, expect null" ? " (control)" : "");
}

// ---- H2: does it ALSO separate on authorship, within each pile? ------------
console.log("\n=== H2  human vs ai WITHIN each pile  (must NOT separate) ===");
for (const [name, set] of [["slop", slop], ["good", good]]) {
  const h = set.filter((d) => d.authorship === "human");
  const a = set.filter((d) => d.authorship === "ai");
  if (h.length < 3 || a.length < 3) { console.log(`  ${name}: too few of one authorship (${h.length}h/${a.length}ai) to test`); continue; }
  for (const [m, label] of METRICS) {
    const r = diffCI(vals(h, m), vals(a, m), `H2:${name}:${m}`);
    console.log(`  ${name.padEnd(5)} ${label.padEnd(22)} human ${r.a.toFixed(2).padStart(8)}  ai ${r.b.toFixed(2).padStart(8)}` +
      `  [${r.lo.toFixed(2)}, ${r.hi.toFixed(2)}]`.padEnd(22) + (clears(r) ? "  SEPARATES  <-- problem for H2" : "  no"));
  }
}

// ---- the hard cases --------------------------------------------------------
const hard = slop.filter((d) => /competent|polished|well.written|hard case/i.test(d.notes));
if (hard.length) {
  console.log(`\n=== hard cases: ${hard.length} slop documents flagged as competently written ===`);
  for (const [m, label, tier] of METRICS) {
    if (tier !== "primary") continue;
    const r = diffCI(vals(hard, m), vals(good, m), `HARD:${m}`);
    console.log("  " + label.padEnd(22), `hard ${r.a.toFixed(2).padStart(8)}  good ${r.b.toFixed(2).padStart(8)}`,
      `[${r.lo.toFixed(2)}, ${r.hi.toFixed(2)}]`.padEnd(22), clears(r) ? "SEPARATES" : "no");
  }
  console.log("  (if the primaries separate on lazy slop but not on these, that is the finding)");
}

console.log("\n=== per document ===");
console.log("file".padEnd(30), "label".padEnd(6), "auth".padEnd(8), "words".padStart(6), "sn/1k".padStart(7), "spec/1k".padStart(8), "unbkd".padStart(7));
for (const d of [...docs].sort((x, y) => x.label.localeCompare(y.label) || y.sn_rate - x.sn_rate)) {
  console.log(d.file.slice(0, 29).padEnd(30), d.label.padEnd(6), (d.authorship||"-").padEnd(8),
    String(d.words).padStart(6), d.sn_rate.toFixed(2).padStart(7), d.specificity.toFixed(1).padStart(8),
    (d.claim_unbacked_share === null ? "-" : d.claim_unbacked_share.toFixed(2)).padStart(7));
}
console.log("\nreference points from Wave 1, 500-2000 word band, n=233:");
console.log("  self-narration  max 1.95 /1k     specificity  median 90.9 /1k");
console.log("  cannabis specimen: sn 4.33 /1k,  specificity 6.8 /1k\n");
