#!/usr/bin/env node
// Person drift as a distribution. 2026-09-03.
//
// Gregg's own observation: the checker cannot see mixed pronoun usage. A piece
// addressed to "you" throughout that says "us" once or twice has changed its
// mind about who is talking, and nothing in the fifteen rules notices.
//
// The slop experiment measured it as a binary flag and it fired on 45% of the
// slop pile against 5% of the good pile -- better behaviour than anything in
// Wave 1. But that experiment's two piles were nearly aligned with authorship
// (9 of 11 slop documents were model-written), so the design guard refused the
// result and it could not be shown to be measuring quality rather than
// authorship. It also never ran against the corpora, which need no labelling.
//
//   node study/person-drift.mjs study/corpus/* [--json out.json]
//
// The flag is copied verbatim from study/slop.mjs so this is the same measure:
//
//   spp >= 5 && fpp >= 1 && fpp <= 2
//
// RAW COUNTS, and that is the first thing this script checks rather than
// assumes. `spp >= 5` gets easier as a document lengthens and `fpp <= 2` gets
// harder, so the flag is not monotonic in length -- it peaks somewhere in the
// middle and falls off at both ends. A corpus whose arms differ in length will
// separate on the flag for that reason alone, and length has already produced
// one false finding in this project (2026-08-19, contrastive negation).
//
// So four things get reported, in this order:
//   1. the flag rate per arm, which is the number the slop experiment produced
//   2. the same rate within word-count bands, which is the length control
//   3. the eligible denominator -- among documents that are ACTUALLY second
//      person, how many drift? The flag conflates "is this addressed to you"
//      with "does it slip", and those are different questions
//   4. a length-invariant restatement, to see whether anything survives it
//
// Bootstrap over documents, seeded per arm and per statistic, 100-word floor
// and near-duplicate drop -- all copied from measure.mjs so these numbers sit
// beside the others.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";
import { measureDoc } from "./lib/substance-metrics.mjs";

// First-person SINGULAR, needed only as this run's control, so it lives here
// rather than in the shared metrics lib.
const FPS = /\b(?:i|me|my|mine|myself)\b/gi;

const BOOTSTRAP = 2000;
const STUDY_SEED = 20260831;
const MIN_FOR_CLAIMS = 20;

// Verbatim from study/slop.mjs line 82. Do not "improve" it here -- the point
// of this run is to test the measure that produced the 45%/5% split, not a
// better one. Variants are reported separately, further down.
const flagOf = (c) => (c.spp >= 5 && c.fpp >= 1 && c.fpp <= 2) ? 1 : 0;

// Genre from MANIFEST.tsv, by header name rather than position -- the five
// manifest schemas in this repo do not agree on column order, and reading one
// by position is what put a URL under the heading "date" in the substack arm.
function genresIn(dir) {
  try {
    const lines = readFileSync(join(dir, "MANIFEST.tsv"), "utf8").trim().split("\n");
    const header = lines[0].split("\t").map((h) => h.trim().toLowerCase());
    const fi = header.indexOf("file"), gi = header.indexOf("genre");
    if (fi === -1 || gi === -1) return {};
    const out = {};
    for (const r of lines.slice(1)) {
      const c = r.split("\t");
      if (c.length !== header.length) continue;
      out[basename(c[fi] || "", ".txt")] = (c[gi] || "").trim();
    }
    return out;
  } catch { return {}; }
}

function docsIn(dir) {
  const seen = new Set();
  const genres = genresIn(dir);
  const out = [];
  let short = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".txt")).sort()) {
    const text = readFileSync(join(dir, f), "utf8");
    if ((text.match(/\S+/g) || []).length < 100) { short++; continue; }
    const key = createHash("sha1").update(text.replace(/\s+/g, " ").trim().toLowerCase()).digest("hex");
    if (seen.has(key)) continue;
    seen.add(key);
    const m = measureDoc(text);
    out.push({
      name: basename(f, ".txt"), words: m.words,
      genre: genres[basename(f, ".txt")] || "",
      spp: m.counts.spp, fpp: m.counts.fpp,
      fps: (text.replace(/[\u2018\u2019]/g, "'").match(FPS) || []).length,
      sppRate: (m.counts.spp / m.words) * 1000,
      fppRate: (m.counts.fpp / m.words) * 1000,
      flag: flagOf(m.counts),
    });
  }
  if (short) console.log(`  ! ${basename(dir)}: ${short} file(s) under 100 words, excluded`);
  return out;
}

const seedFrom = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Share of documents satisfying a predicate, with a bootstrap CI over documents.
function shareCI(docs, pred, key) {
  if (!docs.length) return { share: 0, lo: 0, hi: 0, n: 0, k: 0 };
  const per = docs.map((d) => (pred(d) ? 1 : 0));
  const point = per.reduce((a, b) => a + b, 0) / per.length;
  const rand = mulberry32((seedFrom(key) ^ STUDY_SEED) >>> 0);
  const s = [];
  for (let b = 0; b < BOOTSTRAP; b++) {
    let t = 0;
    for (let i = 0; i < per.length; i++) t += per[(rand() * per.length) | 0];
    s.push(t / per.length);
  }
  s.sort((a, b) => a - b);
  return { share: point, lo: s[Math.floor(BOOTSTRAP * 0.025)], hi: s[Math.floor(BOOTSTRAP * 0.975)], n: per.length, k: per.reduce((a, b) => a + b, 0) };
}

const argv = process.argv.slice(2);
const ji = argv.indexOf("--json");
const JSONOUT = ji === -1 ? null : argv[ji + 1];
const dirs = (ji === -1 ? argv : argv.filter((_, i) => i !== ji && i !== ji + 1)).filter((d) => { try { return statSync(d).isDirectory(); } catch { return false; } });
if (!dirs.length) { console.error("usage: node study/person-drift.mjs <dir>... [--json out.json]"); process.exit(1); }

const arms = dirs.map((dir) => ({ arm: basename(dir), dir, docs: docsIn(dir) }));
const all = arms.flatMap((a) => a.docs.map((d) => ({ ...d, arm: a.arm })));
const pct = (x) => (x * 100).toFixed(0) + "%";
const med = (xs) => { if (!xs.length) return 0; const t = [...xs].sort((a, b) => a - b); return t[Math.floor(t.length / 2)]; };
const pad = (s, n) => String(s).padEnd(n);

console.log(`\n${all.length} documents across ${arms.length} arms.`);

// ---- 1. the flag as the slop experiment defined it --------------------------
console.log("\n=== 1. Person-drift flag, as defined (spp>=5, 1<=fpp<=2) ===");
console.log(pad("arm", 16) + "docs".padStart(6) + "flagged".padStart(9) + "share".padStart(8) + "        95% CI");
const out = { generated: new Date().toISOString(), seed: STUDY_SEED, bootstrap: BOOTSTRAP, flag: "spp>=5 && fpp>=1 && fpp<=2", arms: {} };
for (const a of arms) {
  const r = shareCI(a.docs, (d) => d.flag === 1, `${a.arm}:flag`);
  out.arms[a.arm] = { documents: r.n, flagged: r.k, share: r.share, lo: r.lo, hi: r.hi };
  console.log(pad(a.arm, 16) + String(r.n).padStart(6) + String(r.k).padStart(9) + pct(r.share).padStart(8) +
    `   [${pct(r.lo)}, ${pct(r.hi)}]`.padEnd(18) + (r.n < MIN_FOR_CLAIMS ? " ! thin" : ""));
}

// ---- 2. the length control --------------------------------------------------
// If the flag is a property of length rather than of authorship, the arms will
// converge inside a band and the differences will live between bands.
const BANDS = [[100, 400], [400, 800], [800, 1600], [1600, 3200], [3200, Infinity]];
console.log("\n=== 2. Same flag, within word-count bands (the length control) ===");
console.log("A flag built from raw counts cannot be read across arms of different lengths.\n");
console.log(pad("arm", 16) + BANDS.map(([lo, hi]) => `${lo}-${hi === Infinity ? "+" : hi}`.padStart(12)).join(""));
for (const a of arms) {
  let row = pad(a.arm, 16);
  for (const [lo, hi] of BANDS) {
    const sub = a.docs.filter((d) => d.words >= lo && d.words < hi);
    row += (sub.length ? `${pct(sub.filter((d) => d.flag).length / sub.length)} (${sub.length})` : "-").padStart(12);
  }
  console.log(row);
}
console.log("\n" + pad("ALL ARMS", 16) + BANDS.map(([lo, hi]) => {
  const sub = all.filter((d) => d.words >= lo && d.words < hi);
  return (sub.length ? `${pct(sub.filter((d) => d.flag).length / sub.length)} (${sub.length})` : "-").padStart(12);
}).join(""));
console.log("If that bottom row is not flat, the flag is partly measuring length.");

// ---- 3. the eligible denominator -------------------------------------------
// The flag fires only on second-person prose, so an arm with no second-person
// documents scores zero for a reason that has nothing to do with drifting. The
// honest denominator is documents that are actually addressed to a reader.
const SECOND_PERSON = (d) => d.sppRate >= 5;
const HUMAN_ARMS = new Set(["human", "medium", "newsletter", "substack"]);
console.log("\n=== 3. Among documents that are ACTUALLY second person (spp >= 5 per 1k) ===");
console.log("Eligible = the denominator the flag should have had.\n");
console.log(pad("arm", 16) + "eligible".padStart(10) + "of".padStart(6) + "drifted".padStart(9) + "share".padStart(8) + "        95% CI");
for (const a of arms) {
  const elig = a.docs.filter(SECOND_PERSON);
  const r = shareCI(elig, (d) => d.fpp >= 1 && d.fpp <= 2, `${a.arm}:drift-among-2p`);
  out.arms[a.arm].eligible = elig.length;
  out.arms[a.arm].driftAmongEligible = elig.length ? r.share : null;
  console.log(pad(a.arm, 16) + String(elig.length).padStart(10) + String(a.docs.length).padStart(6) +
    String(r.k).padStart(9) + (elig.length ? pct(r.share) : "-").padStart(8) +
    (elig.length ? `   [${pct(r.lo)}, ${pct(r.hi)}]`.padEnd(18) : "") + (elig.length < MIN_FOR_CLAIMS ? " ! thin" : ""));
}

// ---- 4. a length-invariant restatement -------------------------------------
// Rates instead of raw counts. Drift as a shape: heavily second person, and a
// first-person-plural presence that is non-zero but small. Thresholds are
// arbitrary and are stated rather than tuned; the point is whether ANY
// length-invariant version behaves, not to find the one that separates.
const DRIFT_RATE = (d) => d.sppRate >= 5 && d.fppRate > 0 && d.fppRate <= 1.5;
console.log("\n=== 4. Length-invariant restatement (spp>=5/1k, 0 < fpp <= 1.5/1k) ===");
console.log(pad("arm", 16) + "docs".padStart(6) + "flagged".padStart(9) + "share".padStart(8) + "        95% CI");
for (const a of arms) {
  const r = shareCI(a.docs, DRIFT_RATE, `${a.arm}:driftrate`);
  out.arms[a.arm].driftRateShare = r.share;
  console.log(pad(a.arm, 16) + String(r.n).padStart(6) + String(r.k).padStart(9) + pct(r.share).padStart(8) +
    `   [${pct(r.lo)}, ${pct(r.hi)}]`.padEnd(18) + (r.n < MIN_FOR_CLAIMS ? " ! thin" : ""));
}

// ---- 5. length-matched, human against model --------------------------------
// Sections 1 and 3 both still contain a raw count in the NUMERATOR: "fpp
// between 1 and 2". Fixing the denominator did not fix that. A 200-word
// document lands on one or two first-person-plurals easily; a 1,200-word
// document that says "we" at the same rate lands on seven and does not fire.
// The model arms have a median length of 207 to 546 words and the substack
// arm 1,156, so section 3 is comparing a measure to itself at two different
// scales.
//
// The only comparison this design supports is inside a word band, on documents
// that are actually second person, pooling every human arm against every model
// arm. Anything the flag has to say survives here or it does not survive.
console.log("\n=== 5. Length-matched: human vs model, second-person documents only ===");
console.log("The only comparison the flag's construction actually supports.\n");
console.log(pad("band (words)", 16) + "human n".padStart(10) + "drift".padStart(8) + "        95% CI" +
  "    model n".padStart(12) + "drift".padStart(8) + "        95% CI");
const bandRows = [];
for (const [lo, hi] of BANDS) {
  const inBand = all.filter((d) => d.words >= lo && d.words < hi && SECOND_PERSON(d));
  const h = inBand.filter((d) => HUMAN_ARMS.has(d.arm));
  const m = inBand.filter((d) => !HUMAN_ARMS.has(d.arm));
  if (!h.length && !m.length) continue;
  const drift = (d) => d.fpp >= 1 && d.fpp <= 2;
  const rh = shareCI(h, drift, `band${lo}:human`), rm = shareCI(m, drift, `band${lo}:model`);
  const thin = h.length < MIN_FOR_CLAIMS || m.length < MIN_FOR_CLAIMS;
  bandRows.push({ band: `${lo}-${hi === Infinity ? "+" : hi}`, human: rh, model: rm, thin });
  console.log(pad(`${lo}-${hi === Infinity ? "+" : hi}`, 16) +
    String(rh.n).padStart(10) + (rh.n ? pct(rh.share) : "-").padStart(8) +
    (rh.n ? `   [${pct(rh.lo)}, ${pct(rh.hi)}]`.padEnd(18) : " ".repeat(18)) +
    String(rm.n).padStart(9) + (rm.n ? pct(rm.share) : "-").padStart(8) +
    (rm.n ? `   [${pct(rm.lo)}, ${pct(rm.hi)}]` : "") + (thin ? "  ! thin" : ""));
}
out.lengthMatched = bandRows;
const anySep = bandRows.some((r) => !r.thin && (r.human.lo > r.model.hi || r.model.lo > r.human.hi));
console.log(anySep
  ? "\n  At least one band separates. Report which, and only that one."
  : "\n  No band separates. Within matched lengths, human and model prose drift alike.");

// ---- 6. the inversion, genre-matched ---------------------------------------
// Section 5 pointed somewhere the flag was not built to look. In the 800-1600
// band the model documents that did NOT fire mostly sat at zero
// first-person-plural, and the median model document in that band had 1 while
// the median human document had 11, at the same length. The flag's window of
// "one or two" is not catching a slip into an unearned "us". It is sitting on
// top of a model distribution that lives near zero, while the human
// distribution sails straight past it.
//
// So the thing to measure is not drift. It is ABSENCE. And it has to be
// genre-matched, because a cover letter has no legitimate "we" and neither
// does a chat answer -- both would manufacture the effect on their own. The
// model arms are therefore restricted to blog_post and newsletter, the same
// restriction the 2026-08-19 genre-matched pass used, and the human arms are
// long-form blog and newsletter prose throughout.
const GENRE_MATCH = new Set(["blog_post", "newsletter"]);
console.log("\n=== 6. First-person plural, genre-matched (blog + newsletter only) ===");
console.log("Model arms restricted by manifest genre. Human arms are this genre throughout.\n");
console.log(pad("arm", 16) + "docs".padStart(6) + "fpp/1k".padStart(9) + "        95% CI" +
  "   zero-fpp".padStart(12) + "med words".padStart(11));
const gRows = [];
for (const a of arms) {
  const isHuman = HUMAN_ARMS.has(a.arm);
  const sub = isHuman ? a.docs : a.docs.filter((d) => GENRE_MATCH.has(d.genre));
  if (!sub.length) continue;
  const per = sub.map((d) => ({ n: d.fpp, w: d.words }));
  const tot = per.reduce((x, p) => x + p.w, 0);
  const point = tot ? (per.reduce((x, p) => x + p.n, 0) / tot) * 1000 : 0;
  const rand = mulberry32((seedFrom(`${a.arm}:fpp-genre`) ^ STUDY_SEED) >>> 0);
  const bs = [];
  for (let b = 0; b < BOOTSTRAP; b++) {
    let n = 0, w = 0;
    for (let i = 0; i < per.length; i++) { const q = per[(rand() * per.length) | 0]; n += q.n; w += q.w; }
    bs.push(w ? (n / w) * 1000 : 0);
  }
  bs.sort((x, y) => x - y);
  const r = { rate: point, lo: bs[Math.floor(BOOTSTRAP * 0.025)], hi: bs[Math.floor(BOOTSTRAP * 0.975)] };
  const z = shareCI(sub, (d) => d.fpp === 0, `${a.arm}:zerofpp`);
  gRows.push({ arm: a.arm, human: isHuman, n: sub.length, ...r, zero: z.share, zeroLo: z.lo, zeroHi: z.hi });
  console.log(pad(a.arm, 16) + String(sub.length).padStart(6) + r.rate.toFixed(2).padStart(9) +
    `   [${r.lo.toFixed(2)}, ${r.hi.toFixed(2)}]`.padEnd(18) + pct(z.share).padStart(9) +
    String(med(sub.map((d) => d.words))).padStart(11) + (sub.length < MIN_FOR_CLAIMS ? "  ! thin" : ""));
}
out.genreMatched = gRows;
const hR = gRows.filter((r) => r.human), mR = gRows.filter((r) => !r.human);
if (hR.length && mR.length) {
  const hLo = Math.min(...hR.map((r) => r.lo)), mHi = Math.max(...mR.map((r) => r.hi));
  const mLo = Math.min(...mR.map((r) => r.lo)), hHi = Math.max(...hR.map((r) => r.hi));
  console.log(`\n  human intervals span [${hLo.toFixed(2)}, ${hHi.toFixed(2)}]`);
  console.log(`  model intervals span [${mLo.toFixed(2)}, ${mHi.toFixed(2)}]`);
  console.log(hLo > mHi || mLo > hHi
    ? "  Every human arm clears every model arm. No overlap."
    : "  The ranges overlap. Not a separation.");
}

// ---- 6b. the control that decides what section 6 means ---------------------
// If the model arms are simply low on ALL first person in this genre, section 6
// is a register effect and not a fact about "we". Same arms, same genre match,
// singular instead of plural. This has to be run before section 6 is described
// as anything.
console.log("\n=== 6b. CONTROL: first-person SINGULAR, same arms, same genre match ===");
console.log("If the models are low here too, section 6 is register and not a fact about \"we\".\n");
console.log(pad("arm", 16) + "docs".padStart(6) + "fps/1k".padStart(9) + "        95% CI" + "   fpp:fps".padStart(11));
const cRows = [];
for (const a of arms) {
  const isHuman = HUMAN_ARMS.has(a.arm);
  const sub = isHuman ? a.docs : a.docs.filter((d) => GENRE_MATCH.has(d.genre));
  if (!sub.length) continue;
  const per = sub.map((d) => ({ n: d.fps, w: d.words }));
  const tot = per.reduce((x, q) => x + q.w, 0);
  const point = tot ? (per.reduce((x, q) => x + q.n, 0) / tot) * 1000 : 0;
  const rand = mulberry32((seedFrom(`${a.arm}:fps-genre`) ^ STUDY_SEED) >>> 0);
  const bs = [];
  for (let b = 0; b < BOOTSTRAP; b++) {
    let n = 0, w = 0;
    for (let i = 0; i < per.length; i++) { const q = per[(rand() * per.length) | 0]; n += q.n; w += q.w; }
    bs.push(w ? (n / w) * 1000 : 0);
  }
  bs.sort((x, y) => x - y);
  const fppRate = gRows.find((g) => g.arm === a.arm)?.rate ?? 0;
  cRows.push({ arm: a.arm, human: isHuman, n: sub.length, rate: point, lo: bs[Math.floor(BOOTSTRAP * 0.025)], hi: bs[Math.floor(BOOTSTRAP * 0.975)] });
  console.log(pad(a.arm, 16) + String(sub.length).padStart(6) + point.toFixed(2).padStart(9) +
    `   [${bs[Math.floor(BOOTSTRAP * 0.025)].toFixed(2)}, ${bs[Math.floor(BOOTSTRAP * 0.975)].toFixed(2)}]`.padEnd(18) +
    (point ? (fppRate / point).toFixed(2) : "-").padStart(8));
}
out.control = cRows;
{
  const h = cRows.filter((r) => r.human), m = cRows.filter((r) => !r.human);
  const hLo = Math.min(...h.map((r) => r.lo)), mHi = Math.max(...m.map((r) => r.hi));
  const mLo = Math.min(...m.map((r) => r.lo)), hHi = Math.max(...h.map((r) => r.hi));
  console.log(`\n  human [${hLo.toFixed(2)}, ${hHi.toFixed(2)}]   model [${mLo.toFixed(2)}, ${mHi.toFixed(2)}]`);
  console.log(hLo > mHi || mLo > hHi
    ? "  The control ALSO separates. Section 6 is a first-person register effect, not a fact about \"we\"."
    : "  The control does not separate. Whatever section 6 found is specific to the plural.");
}

// ---- pooled, with leave-one-out --------------------------------------------
// Ten documents per model arm is below this study's own bar. Pooled across the
// five article arms it is fifty, which clears it, and the pooled estimate is
// the one worth stressing.
{
  const mDocs = arms.filter((a) => !HUMAN_ARMS.has(a.arm)).flatMap((a) => a.docs.filter((d) => GENRE_MATCH.has(d.genre)));
  const hDocs = arms.filter((a) => HUMAN_ARMS.has(a.arm)).flatMap((a) => a.docs);
  const rateOf = (docs, key) => {
    const per = docs.map((d) => ({ n: d.fpp, w: d.words }));
    const tot = per.reduce((x, q) => x + q.w, 0);
    const point = tot ? (per.reduce((x, q) => x + q.n, 0) / tot) * 1000 : 0;
    const rand = mulberry32((seedFrom(key) ^ STUDY_SEED) >>> 0);
    const bs = [];
    for (let b = 0; b < BOOTSTRAP; b++) {
      let n = 0, w = 0;
      for (let i = 0; i < per.length; i++) { const q = per[(rand() * per.length) | 0]; n += q.n; w += q.w; }
      bs.push(w ? (n / w) * 1000 : 0);
    }
    bs.sort((x, y) => x - y);
    return { rate: point, lo: bs[Math.floor(BOOTSTRAP * 0.025)], hi: bs[Math.floor(BOOTSTRAP * 0.975)], n: docs.length };
  };
  const M = rateOf(mDocs, "pooled:model"), H = rateOf(hDocs, "pooled:human");
  console.log("\n=== Pooled, genre-matched ===");
  console.log(`  model  n=${M.n}  ${M.rate.toFixed(2)} [${M.lo.toFixed(2)}, ${M.hi.toFixed(2)}]`);
  console.log(`  human  n=${H.n}  ${H.rate.toFixed(2)} [${H.lo.toFixed(2)}, ${H.hi.toFixed(2)}]`);
  const gap = Math.max(M.lo, H.lo) - Math.min(M.hi, H.hi);
  console.log(`  gap ${gap >= 0 ? "+" : ""}${gap.toFixed(2)} per 1,000 words`);
  // Leave-one-out on the model side, which is the thin one.
  let flips = 0;
  for (let i = 0; i < mDocs.length; i++) {
    const r = rateOf(mDocs.filter((_, k) => k !== i), "pooled:model");
    if (!(Math.max(r.lo, H.lo) - Math.min(r.hi, H.hi) > 0)) flips++;
  }
  console.log(`  leave-one-out on the model side: ${flips} of ${mDocs.length} single deletions overturn it`);
  out.pooled = { model: M, human: H, gap, looFlips: flips };
}

// ---- underlying distributions ----------------------------------------------
// Whatever the flags say, these are the raw materials. If the arms do not
// differ here, no threshold over them will separate.
console.log("\n=== Underlying distributions (per 1,000 words) ===");
console.log(pad("arm", 16) + "median spp".padStart(12) + "median fpp".padStart(12) + "docs w/ 0 fpp".padStart(15) + "median words".padStart(14));
for (const a of arms) {
  console.log(pad(a.arm, 16) + med(a.docs.map((d) => d.sppRate)).toFixed(1).padStart(12) +
    med(a.docs.map((d) => d.fppRate)).toFixed(1).padStart(12) +
    pct(a.docs.filter((d) => d.fpp === 0).length / (a.docs.length || 1)).padStart(15) +
    String(med(a.docs.map((d) => d.words))).padStart(14));
}

if (JSONOUT) { writeFileSync(JSONOUT, JSON.stringify(out, null, 2) + "\n"); console.log(`\nwrote ${JSONOUT}`); }
console.log("");
