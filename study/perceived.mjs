#!/usr/bin/env node
// study/perceived.mjs — the perceived-axis analysis, and the guard that stops
// it printing a verdict it is not entitled to.
//
//   node study/perceived.mjs                 # refuses unless every floor is met
//   node study/perceived.mjs --force         # prints anyway, labelled invalid
//   node study/perceived.mjs --counts        # counts and design checks only
//
// Protocol and locked hypotheses: study/perceived/PREREGISTRATION.md, with
// Amendment 1 (2026-09-08, sentence-boundary excerpts), Amendment 2
// (2026-09-11, extended collection window, dated judgments, D1) and Amendment 3
// (2026-09-16, the upper-bound claim withdrawn, D2 added).
//
// WRITTEN BEFORE THE FIRST JUDGMENT WAS COLLECTED. That is not a courtesy note;
// it is the condition that makes the numbers below mean anything. The
// preregistration's build order puts this file last for exactly one reason: an
// analysis written after the data are visible is an analysis fitted to them.
// If you are reading this after collection has started, every hypothesis,
// floor, cue mapping and decision rule in this file was already fixed.
//
// Model for the guard: study/slop.mjs. Same bootstrap family, same refusal.
//
// Needs SUPABASE_SERVICE_ROLE_KEY in .env. Judgments and the arm key both live
// in Postgres; neither is in this repo, for the reason packet.json is not.

import { readFileSync, existsSync } from "node:fs";

const PROJECT = "mrkvxxmzekasxtpscawj";
// PERCEIVED_REST overrides the endpoint for offline testing of this file against
// a stub. It is never set in normal use; the default is the live project.
const REST = process.env.PERCEIVED_REST || `https://${PROJECT}.supabase.co/rest/v1`;

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const COUNTS_ONLY = argv.includes("--counts");

const BOOTSTRAP = 2000;
const STUDY_SEED = 20260907;      // the preregistration's date, as in packet.mjs

// ---------------------------------------------------------------------------
// The floors, copied from the preregistration rather than paraphrased.
// ---------------------------------------------------------------------------
const MIN_JUDGMENTS_PER_PASSAGE = 8;   // below this a passage does not enter analysis
const MIN_PASSAGES            = 120;
const MIN_PASSAGES_PER_ARM    = 60;
const MIN_PASSAGES_PER_HUMAN_STRATUM = 20;
const MIN_JUDGMENTS           = 400;
const MIN_SESSIONS            = 50;
const MAX_SESSION_SHARE       = 0.05;

// The reason chips on human-or-ai.html, and the cue split H2 is stated over.
// "gut" is neither a content cue nor a style cue and enters no H2 group; a high
// gut share is itself a result and is reported separately, as limitation 5 says.
const CONTENT_CUES = new Set(["mentioned"]);
const STYLE_CUES   = new Set(["word_choice", "rhythm", "structure"]);

// ---------------------------------------------------------------------------
function envKey(name) {
  if (process.env[name]) return process.env[name];
  if (!existsSync(".env")) return "";
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}
const KEY = envKey("SUPABASE_SERVICE_ROLE_KEY");
if (!KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set in .env or the environment.");
  console.error("Supabase dashboard -> Project Settings -> API -> service_role.");
  process.exit(1);
}

// PostgREST caps a response; page rather than trust a single request to be whole.
async function fetchAll(table, select, order) {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const url = `${REST}/${table}?select=${select}&order=${order}&limit=${PAGE}&offset=${from}`;
    const res = await fetch(url, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
    if (!res.ok) { console.error(`${table} read failed: ${res.status} ${await res.text()}`); process.exit(1); }
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

// ---------------------------------------------------------------------------
// Seeded bootstrap. mulberry32, the generator family used by study/slop.mjs and
// study/perceived/packet.mjs, so "seeded" means one thing across the project.
// ---------------------------------------------------------------------------
function seedFrom(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

// THE UNIT OF INDEPENDENCE IS THE DOCUMENT. Two judgments of the same passage
// are not two observations: they share a passage, and whatever that passage
// does to a reader it does to every reader who sees it. So the resample draws
// PASSAGES with replacement and takes each drawn passage's judgments whole.
// Resampling judgments instead would treat 8 looks at one passage as 8
// independent facts and shrink every interval below.
function clusterCI(passages, stat, tag) {
  const point = stat(passages);
  if (point === null) return null;
  const rand = mulberry32((seedFrom(tag) ^ STUDY_SEED) >>> 0);
  const draws = [];
  for (let i = 0; i < BOOTSTRAP; i++) {
    const sample = new Array(passages.length);
    for (let j = 0; j < passages.length; j++) sample[j] = passages[(rand() * passages.length) | 0];
    const v = stat(sample);
    if (v !== null) draws.push(v);
  }
  if (draws.length < BOOTSTRAP * 0.9) return { point, lo: null, hi: null, thin: true, kept: draws.length };
  draws.sort((a, b) => a - b);
  return { point, lo: draws[Math.floor(draws.length * 0.025)], hi: draws[Math.floor(draws.length * 0.975)], kept: draws.length };
}
// Difference of two independent groups of passages, each resampled at its own size.
function clusterDiffCI(a, b, stat, tag) {
  const pa = stat(a), pb = stat(b);
  if (pa === null || pb === null) return null;
  const rand = mulberry32((seedFrom(tag) ^ STUDY_SEED) >>> 0);
  const draws = [];
  for (let i = 0; i < BOOTSTRAP; i++) {
    const sa = new Array(a.length), sb = new Array(b.length);
    for (let j = 0; j < a.length; j++) sa[j] = a[(rand() * a.length) | 0];
    for (let j = 0; j < b.length; j++) sb[j] = b[(rand() * b.length) | 0];
    const va = stat(sa), vb = stat(sb);
    if (va !== null && vb !== null) draws.push(va - vb);
  }
  if (draws.length < BOOTSTRAP * 0.9) return { point: pa - pb, a: pa, b: pb, lo: null, hi: null, thin: true, kept: draws.length };
  draws.sort((x, y) => x - y);
  return { point: pa - pb, a: pa, b: pb, lo: draws[Math.floor(draws.length * 0.025)], hi: draws[Math.floor(draws.length * 0.975)], kept: draws.length };
}
const excludes = (r, v) => r && r.lo !== null && ((r.lo > v && r.hi > v) || (r.lo < v && r.hi < v));
const pct = (x) => (x === null || x === undefined ? "   -  " : (x * 100).toFixed(1).padStart(5) + "%");
const ci  = (r) => (!r || r.lo === null ? "[ too thin ]" : `[${(r.lo * 100).toFixed(1)}%, ${(r.hi * 100).toFixed(1)}%]`);

// ---------------------------------------------------------------------------
// Load.
// ---------------------------------------------------------------------------
const passageRows = await fetchAll("perceived_passages", "token,packet_id,arm,stratum,genre,words,active", "packet_id.asc");
// created_at ascending IS collection order, and D1 is defined over it.
const judgmentRows = await fetchAll("perceived_judgments", "token,judgment,reason,response_ms,session_id,ordinal,collected_on,created_at", "created_at.asc,id.asc");

const byToken = new Map();
for (const p of passageRows) if (p.active !== false) byToken.set(p.token, { ...p, judgments: [] });

const orphans = [];
let order = 0;
for (const j of judgmentRows) {
  const p = byToken.get(j.token);
  if (!p) { orphans.push(j.token); continue; }
  p.judgments.push({ ...j, order: order++ });
}

const all = [...byToken.values()];
const correct = (p, j) => (j.judgment === "ai") === (p.arm === "model");

// A passage enters analysis at 8 judgments. Everything below is computed on
// entered passages only; the rest are counted and reported, never quietly used.
const entered = all.filter((p) => p.judgments.length >= MIN_JUDGMENTS_PER_PASSAGE);
const enteredJudgments = entered.flatMap((p) => p.judgments.map((j) => ({ p, j })));
const humanP = entered.filter((p) => p.arm === "human");
const modelP = entered.filter((p) => p.arm === "model");

const sessionCounts = new Map();
for (const { j } of enteredJudgments) sessionCounts.set(j.session_id, (sessionCounts.get(j.session_id) || 0) + 1);
const biggestSession = [...sessionCounts.values()].reduce((a, b) => Math.max(a, b), 0);
const biggestShare = enteredJudgments.length ? biggestSession / enteredJudgments.length : 0;

const stratumCount = {};
for (const p of humanP) stratumCount[p.stratum] = (stratumCount[p.stratum] || 0) + 1;

// ---------------------------------------------------------------------------
// Counts, always printed, whatever the guard decides. The six-week checkpoint
// is a public report of exactly this.
// ---------------------------------------------------------------------------
console.log(`\n=== perceived axis — counts as of ${new Date().toISOString().slice(0, 10)} ===\n`);
console.log(`passages in the packet          ${all.length}`);
console.log(`passages at >=${MIN_JUDGMENTS_PER_PASSAGE} judgments        ${entered.length}   (floor ${MIN_PASSAGES})`);
console.log(`  human ${humanP.length} / model ${modelP.length}   (floor ${MIN_PASSAGES_PER_ARM} each)`);
for (const [k, v] of Object.entries(stratumCount)) console.log(`  human stratum ${k.padEnd(18)} ${v}   (floor ${MIN_PASSAGES_PER_HUMAN_STRATUM})`);
console.log(`judgments recorded              ${judgmentRows.length}`);
console.log(`judgments on entered passages   ${enteredJudgments.length}   (floor ${MIN_JUDGMENTS})`);
console.log(`distinct sessions               ${sessionCounts.size}   (floor ${MIN_SESSIONS})`);
console.log(`largest single session share    ${(biggestShare * 100).toFixed(1)}%   (ceiling ${MAX_SESSION_SHARE * 100}%)`);
if (orphans.length) console.log(`!! ${orphans.length} judgment(s) reference a token not in the passage table`);

// Judgments still needed, so the six-week checkpoint can state a distance
// rather than a feeling.
const shortfall = all
  .map((p) => Math.max(0, MIN_JUDGMENTS_PER_PASSAGE - p.judgments.length))
  .reduce((s, v) => s + v, 0);
console.log(`\njudgments still needed to seat every packet passage: ${shortfall}`);

// ---------------------------------------------------------------------------
// DESIGN CHECK — genre composition. Descriptive, and it needs no judgments.
//
// NOT PREREGISTERED. No hypothesis, floor or decision rule turns on it, and it
// is not a metric. It exists because genre, register and length have killed
// more findings in this project than anything else, and because a reader who
// can name the register can score above chance without hearing anything.
//
// The number that matters is the last column: if a register is not 50% model,
// then knowing the register tells a reader something about the arm.
// ---------------------------------------------------------------------------
// The `genre` column holds the model filename's genre segment, and on the
// substack side that segment is the YEAR — so a bare genre grouping compares
// "newsletter_2021" against "2021". Registers are collapsed here so the
// comparison is between the things a reader actually sees.
const register = (p) => (p.genre === "blog_2004" ? "blog_2004" : "newsletter_ish");
function genreTable(set, label) {
  const reg = {};
  for (const p of set) {
    const r = register(p);
    reg[r] = reg[r] || { human: 0, model: 0 };
    reg[r][p.arm === "model" ? "model" : "human"]++;
  }
  console.log(`\n--- design check: register composition (${label}) — descriptive, not preregistered ---`);
  console.log("register".padEnd(18) + "human".padStart(7) + "model".padStart(7) + "total".padStart(7) + "   P(model | register)");
  let ceiling = 0, n = 0;
  for (const [k, v] of Object.entries(reg)) {
    const t = v.human + v.model;
    console.log(k.padEnd(18) + String(v.human).padStart(7) + String(v.model).padStart(7) + String(t).padStart(7) +
      `        ${((v.model / t) * 100).toFixed(1)}%`);
    ceiling += Math.max(v.human, v.model); n += t;
  }
  if (n) {
    console.log(`\nbest score obtainable from register alone: ${((ceiling / n) * 100).toFixed(1)}%  (50.0% if balanced)`);
    console.log("A reader who can name the register and guesses the majority arm within it scores this");
    console.log("without reading for anything else. Where it sits above 50%, accuracy above chance is not");
    console.log("by itself evidence of the instinct under test, and H4 is the control that would catch it.");
  }
  return n ? ceiling / n : null;
}
genreTable(all, "whole packet");

// Length, the other confound this project checks before believing a separation.
const lens = (set) => set.map((p) => p.words).sort((a, b) => a - b);
const med = (v) => (v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null);
const hw = lens(all.filter((p) => p.arm === "human")), mw = lens(all.filter((p) => p.arm === "model"));
if (hw.length && mw.length) {
  console.log(`\nlength check (words): human median ${med(hw)} [${hw[0]}-${hw[hw.length - 1]}]   ` +
              `model median ${med(mw)} [${mw[0]}-${mw[mw.length - 1]}]`);
}

if (COUNTS_ONLY) { console.log("\n--counts: nothing further.\n"); process.exit(0); }

// ---------------------------------------------------------------------------
// THE GUARD. The preregistration says refusing is the point; this is where it
// happens. Every failure is listed, not just the first, so one run tells you
// the whole distance left.
// ---------------------------------------------------------------------------
const guard = [];
if (entered.length < MIN_PASSAGES) guard.push(`${entered.length} passages at >=${MIN_JUDGMENTS_PER_PASSAGE} judgments, floor is ${MIN_PASSAGES}`);
if (humanP.length < MIN_PASSAGES_PER_ARM) guard.push(`${humanP.length} human passages entered, floor is ${MIN_PASSAGES_PER_ARM}`);
if (modelP.length < MIN_PASSAGES_PER_ARM) guard.push(`${modelP.length} model passages entered, floor is ${MIN_PASSAGES_PER_ARM}`);
for (const s of ["blog_2004", "substack_2017_22"]) {
  const n = stratumCount[s] || 0;
  if (n < MIN_PASSAGES_PER_HUMAN_STRATUM) guard.push(`human stratum ${s} has ${n} entered passages, floor is ${MIN_PASSAGES_PER_HUMAN_STRATUM} (H4 is untestable below it)`);
}
if (enteredJudgments.length < MIN_JUDGMENTS) guard.push(`${enteredJudgments.length} judgments on entered passages, floor is ${MIN_JUDGMENTS}`);
if (sessionCounts.size < MIN_SESSIONS) guard.push(`${sessionCounts.size} distinct sessions, floor is ${MIN_SESSIONS}`);
if (biggestShare > MAX_SESSION_SHARE) guard.push(`one session contributes ${(biggestShare * 100).toFixed(1)}% of judgments, ceiling is ${MAX_SESSION_SHARE * 100}%`);
if (orphans.length) guard.push(`${orphans.length} judgment(s) have no matching passage row`);

if (guard.length) {
  console.log("\n!! FLOOR NOT MET — the preregistration says do not read a verdict off this:");
  for (const g of guard) console.log("   - " + g);
  if (!FORCE) {
    console.log("\n   Nothing below is printed. Publishing a result before the floor is met is");
    console.log("   forbidden by the preregistration; the six-week checkpoint publishes the counts");
    console.log("   above and the fact that it has not reached power, which is the counts already");
    console.log("   printed. Pass --force only to look at machinery, never to report.\n");
    process.exit(2);
  }
  console.log("\n   --force given. EVERYTHING BELOW IS NOT-PREREGISTERED-VALID and must be");
  console.log("   labelled that way anywhere it is quoted, including in conversation.\n");
}

// ---------------------------------------------------------------------------
// The estimators. Each takes a list of passages and returns a rate, or null
// when a resample contains none of the relevant judgments.
// ---------------------------------------------------------------------------
function rate(passages, pick, score) {
  let n = 0, hit = 0;
  for (const p of passages) for (const j of p.judgments) {
    if (!pick(p, j)) continue;
    n++; if (score(p, j)) hit++;
  }
  return n ? hit / n : null;
}
const accuracy   = (ps) => rate(ps, () => true, correct);
const contentAcc = (ps) => rate(ps, (p, j) => CONTENT_CUES.has(j.reason), correct);
const styleAcc   = (ps) => rate(ps, (p, j) => STYLE_CUES.has(j.reason), correct);
const calledAI   = (ps) => rate(ps, () => true, (p, j) => j.judgment === "ai");

console.log("\n=== H1 (primary) — accuracy on period-matched passages vs chance ===");
const h1 = clusterCI(entered, accuracy, "H1");
console.log(`accuracy ${pct(h1 && h1.point)}   95% CI ${ci(h1)}   ` +
  (excludes(h1, 0.5) ? (h1.point > 0.5 ? "EXCEEDS CHANCE" : "BELOW CHANCE") : "does not exclude 0.50"));
// Amendment 3 (2026-09-16) withdrew the upper-bound claim. What replaces it is not a
// softer version of the same sentence: it names what the number estimates and refuses a
// direction for the net bias. The wording below is the amendment's, verbatim in substance.
console.log("What this estimates: a PRIMED BUT UNMOTIVATED reader (Amendment 3, 2026-09-16).");
console.log("Visitors arrive from a site about AI tells, which pushes this number up. Nothing");
console.log("rides on their answer, which pushes it down. Neither is quantified, so this is NOT");
console.log("a bound in either direction — not on a general reader, and not on a reader making");
console.log("a real accusation. D2 below measures the half of that which can be measured.");

console.log("\n=== H2 (primary, the crux) — content cue vs style cue ===");
// Content-cue and style-cue judgments come from the SAME passages, so the
// difference is computed inside a single resample rather than across two
// independent ones — resampling the two cue groups separately would throw away
// the pairing and widen the interval for no reason.
const h2w = clusterCI(entered, (ps) => {
  const c = contentAcc(ps), s = styleAcc(ps);
  return c === null || s === null ? null : c - s;
}, "H2");
console.log(`content-cue accuracy ${pct(contentAcc(entered))}   style-cue accuracy ${pct(styleAcc(entered))}`);
console.log(`difference ${h2w && h2w.point !== null ? (h2w.point * 100).toFixed(1) + " pts" : "-"}   95% CI ${ci(h2w)}   ` +
  (excludes(h2w, 0) ? "SEPARATES" : "does not exclude zero"));
const cueN = {};
for (const { j } of enteredJudgments) cueN[j.reason] = (cueN[j.reason] || 0) + 1;
console.log("reason counts: " + Object.entries(cueN).map(([k, v]) => `${k} ${v}`).join(", "));
console.log("A high gut share is itself a result about the instinct, not a shortfall (limitation 5).");
console.log("Report this split alongside any accuracy number rather than leading with accuracy.");

console.log("\n=== H3 — false-positive rate: human passages called AI ===");
const h3 = clusterCI(humanP, calledAI, "H3");
console.log(`false positives ${pct(h3 && h3.point)}   95% CI ${ci(h3)}`);
console.log("No directional prediction. This is the number the accused-defence position stands on,");
console.log("and it is reported whatever it is.");

console.log("\n=== H4 (control, known negative) — human accuracy by stratum ===");
const sub = humanP.filter((p) => p.stratum === "substack_2017_22");
const old = humanP.filter((p) => p.stratum === "blog_2004");
const h4 = clusterDiffCI(sub, old, accuracy, "H4");
console.log(`substack_2017_22 ${pct(accuracy(sub))} (n=${sub.length})   blog_2004 ${pct(accuracy(old))} (n=${old.length})`);
console.log(`difference ${h4 ? (h4.point * 100).toFixed(1) + " pts" : "-"}   95% CI ${ci(h4)}   ` +
  (excludes(h4, 0) ? "!! SEPARATES — the dating leak survived the controls" : "does not separate (control holds)"));
if (excludes(h4, 0)) {
  console.log("\nDECISION RULE, set in advance: H4 has failed. Report H4 and the contamination.");
  console.log("NO ACCURACY HEADLINE SHIPS FROM THIS RUN. H1 above is contaminated and is not the finding.");
}

console.log("\n=== D1 (required diagnostic, Amendment 2) — did the answer hold still? ===");
const ordered = [...enteredJudgments].sort((a, b) => a.j.order - b.j.order);
const third = Math.floor(ordered.length / 3);
function sliceAcc(slice) {
  let n = 0, hit = 0;
  for (const { p, j } of slice) { n++; if (correct(p, j)) hit++; }
  return n ? hit / n : null;
}
const first3 = ordered.slice(0, third), last3 = ordered.slice(ordered.length - third);
console.log(`first third ${pct(sliceAcc(first3))} (n=${first3.length})   last third ${pct(sliceAcc(last3))} (n=${last3.length})`);
if (first3.length && last3.length) {
  const d = sliceAcc(last3) - sliceAcc(first3);
  console.log(`last minus first: ${(d * 100).toFixed(1)} pts`);
}
const dates = [...new Set(enteredJudgments.map(({ j }) => j.collected_on))].sort();
if (dates.length) console.log(`collected ${dates[0]} to ${dates[dates.length - 1]} (${dates.length} distinct days)`);
console.log("D1 is not a hypothesis and no publication decision turns on it. It is here so a reader");
console.log("can see whether the thing being measured moved while it was being measured — the cost");
console.log("Amendment 2 accepted in exchange for a collection window long enough to reach power.");

// ---------------------------------------------------------------------------
// D2 (required diagnostic, Amendment 3, 2026-09-16). Accuracy by time spent.
//
// WHY IT EXISTS. Amendment 3 withdrew this study's claim that its accuracy is
// an upper bound on a general reader's. Arriving from a site about AI tells
// pushes the number up; having nothing riding on the answer pushes it down;
// neither was measured, so no bound could be claimed in either direction. D2 is
// the half of that which CAN be measured from what is already collected. Flat
// accuracy across time spent makes the unmotivated-reader limitation weak.
// Accuracy that climbs with time means readers who work at it do better, and
// the gap between this instrument and a motivated reader is real and has a size.
//
// NO CONFIDENCE INTERVAL, deliberately. The bootstrap's unit of independence is
// the PASSAGE, and a time band cuts across passages: one passage's eight
// judgments scatter over several bands. A passage-clustered interval is not
// defined for this split, and an interval built by resampling judgments instead
// would commit the exact error clusterCI exists to avoid. Point estimates only,
// and no decision turns on them.
//
// THE SLOWEST BAND IS CENSORED. The edge function caps response_ms at 600000 ms
// before storage, so a reader who walked away is recorded at ten minutes rather
// than dropped. That keeps the judgment in the sample and makes the slowest
// band's median a floor on its true value, not an estimate of it.
// ---------------------------------------------------------------------------
console.log("\n=== D2 (required diagnostic, Amendment 3) — did time spent change the answer? ===");
const RESPONSE_CAP_MS = 600000;                       // mirrors the edge function
const timed = enteredJudgments
  .filter(({ j }) => Number.isFinite(j.response_ms))
  .sort((a, b) => a.j.response_ms - b.j.response_ms);
const dropped = enteredJudgments.length - timed.length;
if (dropped) console.log(`!! ${dropped} judgment(s) have no usable response_ms and are outside D2`);

if (!timed.length) {
  console.log("no judgments with a response time; D2 has nothing to report yet");
} else {
  const q = Math.floor(timed.length / 4);
  const bands = q
    ? [["fastest quarter", timed.slice(0, q)],
       ["second quarter",  timed.slice(q, 2 * q)],
       ["third quarter",   timed.slice(2 * q, 3 * q)],
       ["slowest quarter", timed.slice(3 * q)]]
    : [["all judgments", timed]];
  console.log("band".padEnd(17) + "n".padStart(7) + "median time".padStart(14) + "accuracy".padStart(11));
  for (const [label, band] of bands) {
    const secs = med(band.map(({ j }) => j.response_ms).sort((a, b) => a - b));
    const capped = band.filter(({ j }) => j.response_ms >= RESPONSE_CAP_MS).length;
    console.log(label.padEnd(17) + String(band.length).padStart(7) +
      ((secs / 1000).toFixed(1) + "s").padStart(14) + pct(sliceAcc(band)).padStart(11) +
      (capped ? `   (${capped} at the ${RESPONSE_CAP_MS / 1000}s cap)` : ""));
  }
  if (bands.length === 4) {
    const a1 = sliceAcc(bands[0][1]), a4 = sliceAcc(bands[3][1]);
    if (a1 !== null && a4 !== null) {
      const d = a4 - a1;
      console.log(`\nslowest minus fastest: ${(d * 100).toFixed(1)} pts`);
      console.log(Math.abs(d) < 0.05
        ? "Flat. Readers who took longer did not do better, so 'nobody was really trying' is a weak"
        : (d > 0
          ? "Accuracy rises with time spent. Readers who worked at it did better, so this instrument"
          : "Accuracy FALLS with time spent. Longer looks did worse, which is what second-guessing"));
      console.log(Math.abs(d) < 0.05
        ? "reading of this number. Report it that way."
        : (d > 0
          ? "understates what a motivated reader would score. Report the size, not a bound."
          : "looks like. Report it; do not explain it away."));
    }
  } else {
    console.log("\nfewer than four judgments; bands are not meaningful yet");
  }
}
console.log("D2 is not a hypothesis and no publication decision turns on it. It exists so the");
console.log("unmotivated-reader limitation is measured rather than asserted, which is the whole");
console.log("reason Amendment 3 refused to call this study's accuracy a bound in either direction.");

console.log("\n=== descriptive, NOT preregistered — accuracy by register ===");
for (const r of ["blog_2004", "newsletter_ish"]) {
  const set = entered.filter((p) => register(p) === r);
  if (!set.length) continue;
  console.log(`  ${r.padEnd(16)} accuracy ${pct(accuracy(set))}  (n=${set.length} passages, ` +
    `${set.filter((p) => p.arm === "model").length} model)`);
}
console.log("No decision turns on this. If accuracy tracks the register imbalance printed above");
console.log("rather than the arm, that is the confound and not the instinct.");

if (guard.length) console.log("\n!! REMINDER: --force was used. None of the above is preregistered-valid.\n");
else console.log("\nEvery floor met. The result above is the preregistered one, whatever it says.\n");
