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

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
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
  let short = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".txt")).sort()) {
    const text = readFileSync(join(dir, f), "utf8");
    // Counted and reported, never silently dropped. The OpenAI run on
    // 2026-08-19 lost 5 of 40 documents to this floor and the only visible
    // trace was a document count that did not match the generator's.
    if ((text.match(/\S+/g) || []).length < 100) { short++; continue; }
    // Near-duplicates are the easiest way to accidentally manufacture a
    // confidence interval. One document, one observation.
    const key = createHash("sha1").update(text.replace(/\s+/g, " ").trim().toLowerCase()).digest("hex");
    if (seen.has(key)) { console.log(`  ! skipping duplicate ${f}`); continue; }
    seen.add(key);
    out.push({ name: basename(f, ".txt"), text });
  }
  if (short) console.log(`  ! ${short} file${short === 1 ? "" : "s"} under 100 words, excluded`);
  return out;
}

// Em dashes are counted the way the checker counts them: the character itself,
// or a double hyphen standing in for one. A run of three or more hyphens is a
// markdown horizontal rule, not punctuation, and must not count.
const EM_DASH = /—|(?<!-)--(?!-)/g;

// Mirrors straighten() in checker.html. Every rule is written with straight
// quotes, so a corpus full of curly ones would measure near zero on the rules
// that hinge on a contraction, and the study would report as a finding what is
// actually a typography mismatch.
const straighten = (t) => t.replace(/[\u2018\u2019\u201B]/g, "'").replace(/[\u201C\u201D\u201F]/g, '"');

// Per document: hits per rule, plus words. Em-dash density is counted the way
// the checker counts it (raw dashes), not the way it flags it.
function measureDoc(raw, rules) {
  const text = straighten(raw);
  const words = (text.match(/\S+/g) || []).length;
  const counts = {};
  for (const r of rules) {
    r.re.lastIndex = 0;
    counts[r.id] = (text.match(r.re) || []).length;
  }
  counts.em_dash = (text.match(EM_DASH) || []).length;
  const lens = text.split(/[.!?]+[\s"')\]]*/).map((s) => (s.match(/\S+/g) || []).length).filter((n) => n > 0);
  const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (lens.length || 1));
  return { words, counts, sentences: lens.length, meanSentence: mean, cadenceCV: mean ? sd / mean : 0 };
}

// Rate per 1000 words across a corpus, with a bootstrap CI over documents.
// Resampling documents rather than sentences keeps the unit of independence
// honest: one long AI article is one observation, not four hundred.
// The resampling is seeded, so a rerun against an unchanged corpus reproduces
// the published intervals exactly. With Math.random() it did not: a rerun on
// 2026-08-31 returned identical rates and identical verdicts but 27 intervals
// that had moved by a hundredth or two. Nothing depended on the difference, and
// that is beside the point. rules.json is the artifact this project invites
// people to check, and an artifact whose numbers change when you check it is
// not checkable.
//
// The seed is derived per arm and per rule rather than set once globally, so
// adding a rule or measuring a different set of corpora leaves every existing
// interval untouched. Changing STUDY_SEED reshuffles everything, so treat it as
// fixed and say so in the changelog if it ever moves.
const STUDY_SEED = 20260831;

function seedFrom(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// mulberry32: small, fast, and good enough for a percentile bootstrap.
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
  const point = (per.reduce((a, p) => a + p.n, 0) / per.reduce((a, p) => a + p.w, 0)) * 1000;
  const rand = mulberry32((seedFrom(`${arm}:${id}`) ^ STUDY_SEED) >>> 0);
  const samples = [];
  for (let b = 0; b < BOOTSTRAP; b++) {
    let n = 0, w = 0;
    for (let i = 0; i < per.length; i++) {
      const p = per[(rand() * per.length) | 0];
      n += p.n; w += p.w;
    }
    samples.push(w ? (n / w) * 1000 : 0);
  }
  samples.sort((a, b) => a - b);
  return { rate: point, lo: samples[Math.floor(BOOTSTRAP * 0.025)], hi: samples[Math.floor(BOOTSTRAP * 0.975)] };
}

// --baseline <file> writes per-document rule counts and word counts instead of
// the summary table, so the human comparisons this project publishes can be
// reproduced by anyone without us redistributing other people's prose. No text
// leaves this file, only counts.
const argv = process.argv.slice(2);
const bi = argv.indexOf("--baseline");
const BASELINE = bi === -1 ? null : argv[bi + 1];
const dirs = bi === -1 ? argv : argv.filter((_, i) => i !== bi && i !== bi + 1);
if (dirs.length < 1) { console.error("usage: node study/measure.mjs <dir> [dir2 ...] [--baseline out.json]"); process.exit(1); }

const rules = loadRules();
const ids = [...rules.map((r) => r.id), "em_dash"];
const labels = Object.fromEntries([...rules.map((r) => [r.id, r.label]), ["em_dash", "Em dashes (raw)"]]);

const arms = dirs.map((dir) => {
  if (!statSync(dir).isDirectory()) throw new Error(dir + " is not a directory");
  const docs = docsIn(dir).map((d) => ({ name: d.name, ...measureDoc(d.text, rules) }));
  return { arm: basename(dir), dir, docs };
});

if (BASELINE) {
  // Dates come from MANIFEST.tsv where one exists and is readable. The
  // newsletter manifest is deliberately not read: it lists who Gregg subscribes
  // to, which is his information and not part of any finding.
  //
  // The date column is resolved by HEADER NAME, not by position. It used to be
  // read from column 2 for every arm, which is the date column in the human and
  // medium manifests and something else entirely in the other three: "served"
  // in the generated arms, and the post URL in substack. Nothing had noticed,
  // because the value was written into human-baseline.json without ever being
  // parsed as a date. A manifest that records a URL under the heading "date" is
  // worse than one that records nothing, and provenance is the entire argument
  // in a human arm.
  const DATE_COLUMNS = ["date", "year"];
  // Memoised per directory. dateFor is called once per document, and without
  // this the ragged-row warning printed 853 times for one bad manifest.
  const dateCache = new Map();
  const dateFor = (dir) => {
    if (dateCache.has(dir)) return dateCache.get(dir);
    const v = readDates(dir);
    dateCache.set(dir, v);
    return v;
  };
  const readDates = (dir) => {
    if (basename(dir) === "newsletter") return {};
    try {
      const lines = readFileSync(join(dir, "MANIFEST.tsv"), "utf8").trim().split("\n");
      const header = lines[0].split("\t").map((h) => h.trim().toLowerCase());
      const di = DATE_COLUMNS.map((n) => header.indexOf(n)).find((i) => i !== -1);
      if (di === undefined) {
        console.log(`  ! ${basename(dir)}/MANIFEST.tsv has no date or year column. Dates omitted from the baseline.`);
        return {};
      }
      // A row whose field count does not match the header is not parseable by
      // position, and guessing which column slipped is how a wrong date gets
      // published with a manifest behind it. Skipped and counted out loud.
      let ragged = 0;
      const out = {};
      for (const r of lines.slice(1)) {
        const c = r.split("\t");
        if (c.length !== header.length) { ragged++; continue; }
        out[basename(c[0] || "", ".txt")] = c[di] || null;
      }
      if (ragged) console.log(`  ! ${basename(dir)}/MANIFEST.tsv: ${ragged} row(s) do not match the ${header.length}-column header. Dates omitted for those documents.`);
      return out;
    } catch { return {}; }
  };
  const payload = {
    generated: new Date().toISOString(),
    what: "Per-document rule counts and word counts for the HumanSounding corpora. Counts only, no text.",
    why: "Every human rate this project publishes can be recomputed from this file. The documents themselves are other people's copyrighted prose and are not redistributable, so the counts are published instead.",
    how: `Counts are produced by study/measure.mjs against the RULES array parsed out of checker.html at runtime, so this file and the live checker cannot drift. em_dash counts raw dashes, including the double hyphen the checker treats as one. cadenceCV is the coefficient of variation of sentence length within the document.`,
    rules: ids,
    corpora: arms.map((a) => ({
      key: a.arm,
      documents: a.docs.length,
      words: a.docs.reduce((s, d) => s + d.words, 0),
      rows: a.docs.map((d) => ({
        id: d.name,
        date: dateFor(a.dir)[d.name] || null,
        words: d.words,
        sentences: d.sentences,
        meanSentence: +d.meanSentence.toFixed(2),
        cadenceCV: +d.cadenceCV.toFixed(4),
        counts: Object.fromEntries(Object.entries(d.counts).filter(([, n]) => n > 0)),
      })),
    })),
  };
  writeFileSync(BASELINE, JSON.stringify(payload, null, 2) + "\n");
  const rows = payload.corpora.reduce((s, c) => s + c.rows.length, 0);
  console.log(`\nbaseline written: ${BASELINE} (${rows} documents, counts only, no text)`);
}

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
const out = { generated: new Date().toISOString(), checker: CHECKER, seed: STUDY_SEED, bootstrap: BOOTSTRAP, arms: {}, rules: ids };
for (const a of arms) out.arms[a.arm] = { documents: a.docs.length, words: a.docs.reduce((s, d) => s + d.words, 0), rates: {} };
for (const id of ids) {
  let row = (labels[id] || id).slice(0, 23).padEnd(24);
  for (const a of arms) {
    const r = rateWithCI(a.docs, id, a.arm);
    out.arms[a.arm].rates[id] = r;
    row += `${r.rate.toFixed(2)} [${r.lo.toFixed(2)}-${r.hi.toFixed(2)}]`.padStart(26);
  }
  console.log(row);
}
const cad = (a) => a.docs.reduce((s, d) => s + d.cadenceCV, 0) / (a.docs.length || 1);
console.log("\n" + "sentence-length CV".padEnd(24) + arms.map((a) => cad(a).toFixed(3).padStart(26)).join(""));

// Non-overlapping intervals are the only claim this design supports, and for
// as long as this script has existed it has reported that claim as a bare
// yes/no. On 2026-09-03 the placeholder check found ai-openai-55 against human
// on contrastive negation flipping from "not separated" to "separated" when
// two per cent of the words were removed. The intervals had been overlapping
// by 0.021 and nothing in the output said so, so that verdict was
// indistinguishable from one where the intervals miss by a mile.
//
// Two changes. The margin is printed for every rule, so a reader can see how
// close the call was. And a verdict that a single document could overturn is
// labelled fragile instead of being reported as a finding.
//
// Fragility is measured by leave-one-out over documents -- the same unit of
// independence the bootstrap resamples. Drop one document from either arm,
// recompute both intervals, and see whether the verdict changes. A separation
// that survives every single-document deletion is a property of the corpus. One
// that does not is a property of which documents happened to be collected, and
// the difference matters more than the decimal place the rate is printed to.
//
// The margin is defined once, so "separated" and "how close" cannot disagree:
//   gap = max(lo) - min(hi)
// Positive means the intervals clear each other by that much. Negative means
// they overlap by that much. Zero is a tie and is not a separation.
const gapOf = (p, q) => Math.max(p.lo, q.lo) - Math.min(p.hi, q.hi);

if (arms.length === 2 && arms.every((a) => a.docs.length >= MIN_FOR_CLAIMS)) {
  const [A, B] = arms;
  const dropOne = (docs, i) => docs.filter((_, k) => k !== i);

  // How many single-document deletions change the verdict, and from which arm.
  function fragility(id, separated) {
    const flips = { [A.arm]: 0, [B.arm]: 0 };
    for (let i = 0; i < A.docs.length; i++) {
      const g = gapOf(rateWithCI(dropOne(A.docs, i), id, A.arm), out.arms[B.arm].rates[id]);
      if (g > 0 !== separated) flips[A.arm]++;
    }
    for (let i = 0; i < B.docs.length; i++) {
      const g = gapOf(out.arms[A.arm].rates[id], rateWithCI(dropOne(B.docs, i), id, B.arm));
      if (g > 0 !== separated) flips[B.arm]++;
    }
    return flips;
  }

  console.log("\nSeparation of 95% intervals, with margin");
  console.log("gap > 0 means the intervals clear each other. Rules flat at zero in both arms are omitted.\n");
  const head2 = "  " + "tell".padEnd(24) + A.arm.slice(0, 11).padStart(12) + B.arm.slice(0, 11).padStart(12) + "gap".padStart(9) + "   verdict";
  console.log(head2);
  console.log("  " + "-".repeat(head2.length - 2));

  const fragile = [], solid = [];
  for (const id of ids) {
    const p = out.arms[A.arm].rates[id], q = out.arms[B.arm].rates[id];
    if (p.rate === 0 && q.rate === 0) continue;
    const gap = gapOf(p, q);
    const separated = gap > 0;
    let verdict;
    if (separated) {
      const flips = fragility(id, separated);
      const n = flips[A.arm] + flips[B.arm];
      if (n) {
        verdict = `FRAGILE -- overturned by dropping ${n} single document${n === 1 ? "" : "s"}`;
        fragile.push(id);
      } else {
        verdict = "separated";
        solid.push(id);
      }
      out.arms[A.arm].rates[id].fragileFlips = flips[A.arm];
      out.arms[B.arm].rates[id].fragileFlips = flips[B.arm];
    } else {
      verdict = gap === 0 ? "tie, not a separation" : "overlap";
    }
    out.arms[A.arm].rates[id].gapVs = { arm: B.arm, gap: +gap.toFixed(4), separated };
    console.log("  " + (labels[id] || id).slice(0, 23).padEnd(24) +
      p.rate.toFixed(2).padStart(12) + q.rate.toFixed(2).padStart(12) +
      ((gap >= 0 ? "+" : "") + gap.toFixed(3)).padStart(9) + "   " + verdict);
  }

  console.log("");
  if (!solid.length && !fragile.length) {
    console.log("  No tell separates the two arms on this corpus.");
  } else {
    if (solid.length) console.log(`  Survives leave-one-out: ${solid.map((id) => labels[id] || id).join(", ")}`);
    if (fragile.length) {
      console.log(`  Does NOT survive leave-one-out: ${fragile.map((id) => labels[id] || id).join(", ")}`);
      console.log("  A fragile separation is not a finding. Report it as too close to call, or collect more documents.");
    }
  }
} else if (arms.length === 2) {
  console.log(`\nSeparation verdict suppressed: needs ${MIN_FOR_CLAIMS}+ documents in each arm.`);
}
console.log("\nJSON:");
console.log(JSON.stringify(out));
