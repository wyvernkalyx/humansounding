#!/usr/bin/env node
// Wave 1 substance measurement. 2026-09-02.
//
// Three things the main harness does not measure:
//   1. self-narration DENSITY  - per-document counts, not the corpus mean.
//      The 2026-08-28 run reported means and could not see clustering.
//   2. lexical density         - content words / total words (Ure 1971).
//   3. specificity density     - numerals, units and proper nouns per 1k words,
//      plus the share of evidence-claim sentences carrying no evidence.
//
// Conventions deliberately copied from measure.mjs so the numbers are
// comparable: 100-word floor, near-duplicate drop, rate per 1000 words,
// bootstrap over DOCUMENTS (one document is one observation), seeded per arm
// and per metric from STUDY_SEED so reruns reproduce.
//
//   node study/substance.mjs study/corpus/* --json study/substance.json

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";

const BOOTSTRAP = 2000;
const STUDY_SEED = 20260831;
const MIN_FOR_CLAIMS = 20;

import { straighten, SELFNARR, measureDoc, sentencesOf } from "./lib/substance-metrics.mjs";

function docsIn(dir) {
  const seen = new Set();
  const out = [];
  let short = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".txt")).sort()) {
    const text = readFileSync(join(dir, f), "utf8");
    if ((text.match(/\S+/g) || []).length < 100) { short++; continue; }
    const key = createHash("sha1").update(text.replace(/\s+/g, " ").trim().toLowerCase()).digest("hex");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: basename(f, ".txt"), ...measureDoc(text) });
  }
  if (short) console.log(`  ! ${dir}: ${short} file(s) under 100 words, excluded`);
  return out;
}

function seedFrom(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rateWithCI(docs, id, arm) {
  const per = docs.map((d) => ({ n: d.counts[id] || 0, w: d.words }));
  const tot = per.reduce((a, p) => a + p.w, 0);
  const point = tot ? (per.reduce((a, p) => a + p.n, 0) / tot) * 1000 : 0;
  const rand = mulberry32((seedFrom(`${arm}:${id}`) ^ STUDY_SEED) >>> 0);
  const s = [];
  for (let b = 0; b < BOOTSTRAP; b++) {
    let n = 0, w = 0;
    for (let i = 0; i < per.length; i++) { const p = per[(rand() * per.length) | 0]; n += p.n; w += p.w; }
    s.push(w ? (n / w) * 1000 : 0);
  }
  s.sort((a, b) => a - b);
  return { rate: point, lo: s[Math.floor(BOOTSTRAP * 0.025)], hi: s[Math.floor(BOOTSTRAP * 0.975)] };
}
// Bootstrap CI for a plain per-document mean (lexical density), same seeding.
function meanWithCI(docs, id, arm) {
  const per = docs.map((d) => d.counts[id] || 0);
  const point = per.reduce((a, b) => a + b, 0) / (per.length || 1);
  const rand = mulberry32((seedFrom(`${arm}:mean:${id}`) ^ STUDY_SEED) >>> 0);
  const s = [];
  for (let b = 0; b < BOOTSTRAP; b++) {
    let t = 0;
    for (let i = 0; i < per.length; i++) t += per[(rand() * per.length) | 0];
    s.push(t / per.length);
  }
  s.sort((a, b) => a - b);
  return { rate: point, lo: s[Math.floor(BOOTSTRAP * 0.025)], hi: s[Math.floor(BOOTSTRAP * 0.975)] };
}

const argv = process.argv.slice(2);
const ji = argv.indexOf("--json");
const JSONOUT = ji === -1 ? null : argv[ji + 1];
const dirs = ji === -1 ? argv : argv.filter((_, i) => i !== ji && i !== ji + 1);
if (!dirs.length) { console.error("usage: node study/substance.mjs <dir>... [--json out.json]"); process.exit(1); }

const arms = dirs.filter((d) => statSync(d).isDirectory()).map((dir) => ({ arm: basename(dir), dir, docs: docsIn(dir) }));

const pad = (s, n) => String(s).padEnd(n);
const num = (v, d = 2) => v.toFixed(d).padStart(7);

console.log("\n=== 1.1 SELF-NARRATION: mean rate vs distribution ===");
console.log(pad("arm", 16), pad("docs", 5), "rate/1k", "   max", "  >=1", "  >=2", "  >=4");
for (const a of arms) {
  const r = rateWithCI(a.docs, "sn_total", a.arm);
  const per = a.docs.map((d) => d.counts.sn_total);
  const max = Math.max(0, ...per);
  const sh = (k) => ((per.filter((n) => n >= k).length / per.length) * 100).toFixed(0) + "%";
  console.log(pad(a.arm, 16), pad(a.docs.length, 5), num(r.rate), num(max, 0), sh(1).padStart(6), sh(2).padStart(6), sh(4).padStart(6));
}

console.log("\n=== 1.1b self-narration by form (rate/1k) ===");
const forms = Object.keys(SELFNARR);
console.log(pad("arm", 16), forms.map((f) => f.replace("sn_", "").slice(0, 8).padStart(9)).join(""));
for (const a of arms) {
  console.log(pad(a.arm, 16), forms.map((f) => rateWithCI(a.docs, f, a.arm).rate.toFixed(2).padStart(9)).join(""));
}

console.log("\n=== 1.2 LEXICAL DENSITY (content words / all words) ===");
console.log(pad("arm", 16), "  mean", "        95% CI");
for (const a of arms) {
  const m = meanWithCI(a.docs, "lexical_density", a.arm);
  console.log(pad(a.arm, 16), num(m.rate, 4), ` [${m.lo.toFixed(4)}, ${m.hi.toFixed(4)}]`);
}

console.log("\n=== 1.3 SPECIFICITY (per 1,000 words) ===");
console.log(pad("arm", 16), "numerals", "  units", " proper", "   spec95CI");
for (const a of arms) {
  const n = rateWithCI(a.docs, "numerals", a.arm);
  const u = rateWithCI(a.docs, "units", a.arm);
  const p = rateWithCI(a.docs, "proper_nouns", a.arm);
  const s = rateWithCI(a.docs, "specificity", a.arm);
  console.log(pad(a.arm, 16), num(n.rate), num(u.rate), num(p.rate), ` [${s.lo.toFixed(1)}, ${s.hi.toFixed(1)}]`);
}

console.log("\n=== 1.3b UNBACKED EVIDENCE CLAIMS ===");
console.log(pad("arm", 16), "claims", " unbacked", " share");
for (const a of arms) {
  const c = a.docs.reduce((s, d) => s + d.counts.claim_sentences, 0);
  const u = a.docs.reduce((s, d) => s + d.counts.claim_unbacked, 0);
  console.log(pad(a.arm, 16), String(c).padStart(6), String(u).padStart(9), (c ? ((u / c) * 100).toFixed(0) + "%" : "-").padStart(6));
}

console.log("\n=== 5.1 PILOT: pronoun mix (per 1,000 words) ===");
console.log(pad("arm", 16), "  we/us", " you/yr", "  docs 2nd-person-only w/ any we");
for (const a of arms) {
  const f = rateWithCI(a.docs, "fpp", a.arm);
  const s = rateWithCI(a.docs, "spp", a.arm);
  const secondPerson = a.docs.filter((d) => d.counts.spp >= 5);
  const leak = secondPerson.filter((d) => d.counts.fpp >= 1 && d.counts.fpp <= 2);
  console.log(pad(a.arm, 16), num(f.rate), num(s.rate), `   ${leak.length}/${secondPerson.length}`);
}

if (JSONOUT) {
  writeFileSync(JSONOUT, JSON.stringify({
    generated: new Date().toISOString(),
    seed: STUDY_SEED, bootstrap: BOOTSTRAP,
    what: "Wave 1 substance metrics. Counts only, no text.",
    note: "Self-narration regexes reconstructed 2026-09-02 from skill rule 13. The 2026-08-28 patterns were never committed, so this is a new measurement and not a rerun.",
    corpora: arms.map((a) => ({ key: a.arm, documents: a.docs.length, words: a.docs.reduce((s, d) => s + d.words, 0),
      rows: a.docs.map((d) => ({ id: d.name, words: d.words, sentences: d.sentences, ...d.counts })) })),
  }, null, 2) + "\n");
  console.log(`\nwrote ${JSONOUT}`);
}
