// study/perceived/packet.mjs — the passage packet builder for the perceived axis.
//
//   node study/perceived/packet.mjs --report
//   node study/perceived/packet.mjs --out study/perceived/packet.json
//
// --report prints the attrition table and writes nothing. Run that first.
//
// WHY THIS FILE EXISTS AND WHY IT IS AUTHORITATIVE
//
// Three implementations of the excerpt-plus-stoplist rule have existed. The
// 2026-09-08 scratch script produced the numbers in
// claude/period-arm-checks-2026-09-08.md and is GONE — study/perceived/ holds
// only PREREGISTRATION.md, so nothing in the repo can reproduce or audit them.
// A second throwaway written on 2026-09-11 disagreed with those numbers badly
// on newsletter_2021 (50% survival against a reported 20%).
//
// That disagreement is now unresolvable, because one side of it no longer
// exists. So this file does not try to reproduce either. It implements the
// preregistered rule as literally as the rule can be read, states every place
// the rule needed interpreting, and its output SUPERSEDES the 2026-09-08 table.
// Do not write a fourth version. Change this one.
//
// No judgment has been collected. Everything here is fixed before the first one.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const REPORT_ONLY = argv.includes("--report");
const SEED = Number(arg("seed", 20260907));   // the preregistration's date. Fixed.
const ROOT = arg("root", "study/corpus");

// ---------------------------------------------------------------------------
// The arms.
//
// stratum is what H4 compares. arm is human|model. genre is the register the
// passage was written in, and it is what pairs a model arm against the human
// stratum it will be judged beside.
// ---------------------------------------------------------------------------
const ARMS = [
  // genre is declared for the human arms rather than parsed. The Substack file
  // convention is author__YEAR__NN, so the filename regex below matched the YEAR
  // and recorded genre "2021" for all 34 Substack passages in the 2026-09-11
  // packet. It changed no published number — the register audit collapses on
  // "not blog_2004" — but it would hide a register imbalance from any check that
  // grouped on the exact string, which is the one thing that had to be caught.
  { id: "human-2004",      arm: "human", stratum: "blog_2004",       dir: "human",
    genre: "blog_2004",
    filter: (m) => m.source === "blogauthorship" },
  { id: "human-substack",  arm: "human", stratum: "substack_2017_22", dir: "substack",
    genre: "newsletter_2021",
    filter: (m) => Number(m.year) <= 2022 },
  { id: "model-claude",    arm: "model", stratum: "period_claude",   dir: "period-claude" },
  { id: "model-openai",    arm: "model", stratum: "period_openai",   dir: "period-openai" },
];
// period-openai-chat-latest-2026-09-08 is deliberately absent. Its manifest
// records served=chat-latest, so no resolved model id was ever captured and the
// arm cannot be regenerated. Exploratory only. See
// claude/period-openai-arm-and-model-choice-2026-09-11.md.

// ---------------------------------------------------------------------------
// INTERPRETATION 1 — the excerpt window.
//
// The rule, as amended 2026-09-08: "a fixed 120-200 words taken at a
// deterministic offset - the first SENTENCE boundary at or after word 50."
//
// "120-200 words" is a range, and a range is not yet deterministic. Cutting at
// exactly word 120 or exactly word 200 would end passages mid-sentence, which
// hands a rater a cue that has nothing to do with the writing. So:
//
//   take WHOLE SENTENCES from the offset, stopping at the first sentence end
//   where the running count reaches 120. If that total exceeds 200, the
//   document yields no passage.
//
// Deterministic, inside the preregistered range, never chosen by a person or a
// model, and applied identically to every arm. The cost is recorded: documents
// whose sentences are long enough to jump 120 -> past 200 in one step are
// dropped, and they are dropped for a property of the writing (sentence
// length), which is not era-related but is not nothing either. The count is
// reported per arm as `no_excerpt` so the bias is visible rather than assumed
// away.
// ---------------------------------------------------------------------------
const MIN_WORDS = 120, MAX_WORDS = 200, OFFSET_WORDS = 50;

// Sentence end: . ! ? possibly followed by a closing quote or bracket, then
// whitespace. Guarded against the common abbreviations that would otherwise
// split a sentence early; the list is short on purpose, because a long one
// starts encoding judgements about prose.
const ABBREV = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|Inc|Ltd|Co|Fig|No|Vol|pp|approx|Sept?|Oct|Nov|Dec|Jan|Feb|Mar|Apr|Jun|Jul|Aug)\.$/;

function sentences(text) {
  const out = [];
  let buf = "";
  // Split on whitespace and rebuild, so word counting and sentence detection
  // agree on what a word is. The whole file counts words as whitespace-runs.
  for (const tok of text.split(/(\s+)/)) {
    buf += tok;
    if (/[.!?]["')\]]?$/.test(tok) && !ABBREV.test(buf)) { out.push(buf); buf = ""; }
  }
  if (buf.trim()) out.push(buf);
  return out.filter((s) => s.trim());
}
const countWords = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function excerpt(text) {
  const sents = sentences(text);
  // Walk to the first sentence that ENDS at or after word 50. The passage
  // starts at the sentence after it.
  let run = 0, startIdx = -1;
  for (let i = 0; i < sents.length; i++) {
    run += countWords(sents[i]);
    if (run >= OFFSET_WORDS) { startIdx = i + 1; break; }
  }
  if (startIdx < 0 || startIdx >= sents.length) return null;

  let words = 0; const take = [];
  for (let i = startIdx; i < sents.length; i++) {
    take.push(sents[i]);
    words += countWords(sents[i]);
    if (words >= MIN_WORDS) break;
  }
  if (words < MIN_WORDS || words > MAX_WORDS) return null;
  return { text: take.join(" ").replace(/\s+/g, " ").trim(), words };
}

// ---------------------------------------------------------------------------
// INTERPRETATION 2 — control 2, the stoplist.
//
// The rule: drop for "a four-digit year token, a currency amount, or a named
// product from a fixed list, applied identically to both arms." The first two
// are mechanical. The third has never been fixed, and fixing it is the one real
// judgement call in this file.
//
// The prereg REFUSES heavy filtering, on the stated grounds that it biases the
// human set toward abstract prose and that genre "has killed more findings here
// than anything else." A long product list does exactly that: products are how
// a 2004 blog sounds like 2004, and stripping every passage that names one
// leaves a corpus of people thinking about nothing in particular.
//
// So the list is deliberately NARROW. It contains only names that did not exist
// during the earlier stratum and are famous enough that a reader would date them
// on sight. It does not contain ordinary period vocabulary, company names,
// publications, or anything a writer of either era could plausibly mention.
//
// GREGG: this list is the thing to veto if you want anything vetoed. It is
// implementation, not an amendment — the prereg delegated "a fixed list" — but
// it is fixed HERE, now, before any judgment exists, and changing it later is
// changing a screening rule mid-study.
// ---------------------------------------------------------------------------
const NAMED_PRODUCTS = [
  "chatgpt", "gpt-3", "gpt-4", "gpt-5", "openai", "claude", "anthropic",
  "gemini", "bard", "copilot", "midjourney", "dall-e", "stable diffusion",
  "llama", "iphone", "android", "tiktok", "instagram", "slack", "zoom",
  "spotify", "uber", "kindle", "youtube", "facebook", "twitter",
];
const RE_PRODUCT = new RegExp(`\\b(${NAMED_PRODUCTS.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
const RE_YEAR = /\b(1[6-9]\d{2}|20\d{2})\b/;
const RE_CURRENCY = /(?:[$£€]\s?\d|\b\d[\d,.]*\s?(?:dollars?|cents?|euros?|pounds?|usd|gbp|eur)\b)/i;

function screen(passage) {
  if (RE_YEAR.test(passage)) return "year";
  if (RE_CURRENCY.test(passage)) return "currency";
  if (RE_PRODUCT.test(passage)) return "product";
  return null;
}

// ---------------------------------------------------------------------------
// Seeded selection. mulberry32 — same generator family as study/slop.mjs, so
// "seeded" means the same thing across the project.
// ---------------------------------------------------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffled(items, r) {   // Fisher-Yates, seeded
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------------------------------------------------------------------------
function readManifest(dir) {
  const p = join(ROOT, dir, "MANIFEST.tsv");
  if (!existsSync(p)) return null;
  const lines = readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l.trim());
  const head = lines[0].split("\t");
  return lines.slice(1).map((l) => Object.fromEntries(l.split("\t").map((v, i) => [head[i], v])));
}

const results = [];
for (const A of ARMS) {
  const dir = join(ROOT, A.dir);
  if (!existsSync(dir)) { console.error(`missing arm directory: ${dir}`); process.exit(1); }
  let rows = readManifest(A.dir);
  if (!rows) rows = readdirSync(dir).filter((f) => f.endsWith(".txt")).map((f) => ({ file: f }));
  if (A.filter) rows = rows.filter(A.filter);

  const tally = { docs: 0, no_excerpt: 0, year: 0, currency: 0, product: 0, survive: 0 };
  const pool = [];
  for (const row of rows.sort((a, b) => a.file.localeCompare(b.file))) {
    const fp = join(dir, row.file);
    if (!existsSync(fp)) continue;
    tally.docs++;
    const ex = excerpt(readFileSync(fp, "utf8"));
    if (!ex) { tally.no_excerpt++; continue; }
    const drop = screen(ex.text);
    if (drop) { tally[drop]++; continue; }
    tally.survive++;
    // Genre comes from the model filename convention (model__genre__NN.txt) and
    // from the stratum itself on the human side.
    const g = A.genre ? null : /__([a-z0-9_]+)__/.exec(row.file);
    pool.push({
      id: `${A.id}/${row.file.replace(/\.txt$/, "")}`,
      arm: A.arm, stratum: A.stratum,
      genre: A.genre ?? (g ? g[1] : "unknown"),
      words: ex.words, text: ex.text,
    });
  }
  results.push({ ...A, tally, pool });
}

// ---------------------------------------------------------------------------
const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);
console.log(`\nseed ${SEED}   excerpt: whole sentences from the first sentence boundary at/after word ${OFFSET_WORDS}, stopping at >=${MIN_WORDS}, rejected above ${MAX_WORDS}\n`);
console.log(`${pad("arm", 18)}${num("docs", 6)}${num("no_exc", 8)}${num("year", 6)}${num("curr", 6)}${num("prod", 6)}${num("SURVIVE", 9)}`);
for (const r of results) {
  const t = r.tally;
  console.log(`${pad(r.id, 18)}${num(t.docs, 6)}${num(t.no_excerpt, 8)}${num(t.year, 6)}${num(t.currency, 6)}${num(t.product, 6)}${num(t.survive, 9)}`);
}
// ---------------------------------------------------------------------------
// REGISTER AUDIT — added 2026-09-14, reporting only. Nothing here selects,
// screens or drops anything; --report and the packet it writes are unchanged
// by it.
//
// It exists because the packet built on 2026-09-11 was checked against every
// preregistered floor, cleared all of them, and still carried a register
// imbalance nobody had looked at: 43 of 60 model passages were blog_2004
// against 26 of 60 human, and 17 model newsletters against 34 human Substack
// posts. The floors are stated per ARM and per STRATUM, so an imbalance that
// runs across genre passes every one of them.
//
// The last number is the one to read. A reader who can name the register and
// guesses the majority arm inside it scores that much without reading for
// anything else, so anything above 50% is accuracy the instinct did not earn.
// H4 is the control that would catch it — after the full collection run.
// Cheaper to see it here.
//
// The `genre` field is not comparable across arms on its own: it is parsed from
// the filename, and the human Substack convention is author__YEAR__NN, so those
// rows carry a year where the model rows carry a genre. Registers are collapsed
// below so the comparison is between the things a reader actually sees.
// ---------------------------------------------------------------------------
const registerOf = (p) => (p.genre === "blog_2004" ? "blog_2004" : "newsletter_ish");
function registerAudit(passages, label) {
  if (!passages.length) return;
  const reg = {};
  for (const p of passages) {
    const k = registerOf(p);
    reg[k] = reg[k] || { human: 0, model: 0 };
    reg[k][p.arm === "model" ? "model" : "human"]++;
  }
  console.log(`\n-- register audit (${label}) --`);
  console.log(pad("register", 18) + num("human", 7) + num("model", 7) + num("total", 7) + "   P(model | register)");
  let best = 0, n = 0;
  for (const [k, v] of Object.entries(reg)) {
    const t = v.human + v.model;
    console.log(pad(k, 18) + num(v.human, 7) + num(v.model, 7) + num(t, 7) + `        ${((v.model / t) * 100).toFixed(1)}%`);
    best += Math.max(v.human, v.model); n += t;
  }
  console.log(`best score obtainable from register alone: ${((best / n) * 100).toFixed(1)}%   (50.0% if balanced)`);
}
registerAudit(results.flatMap((r) => r.pool), "eligible POOLS — not the packet");
console.log("   ^ pool sizes, not the draw. The human substack pool dwarfs every other cell,");
console.log("     so the figure above is an artefact of what is AVAILABLE. The packet's own");
console.log("     balance is the table further down.");

const human = results.filter((r) => r.arm === "human").reduce((s, r) => s + r.tally.survive, 0);
const model = results.filter((r) => r.arm === "model").reduce((s, r) => s + r.tally.survive, 0);
console.log(`\nhuman ${human} (floor 60, and >=20 in EACH stratum)   model ${model} (floor 60)`);
for (const r of results) {
  if (r.arm === "human" && r.tally.survive < 20) console.log(`  FLOOR FAIL: ${r.id} has ${r.tally.survive}, needs 20`);
}
if (human < 60) console.log("  FLOOR FAIL: human side under 60");
if (model < 60) console.log("  FLOOR FAIL: model side under 60");


// ---------------------------------------------------------------------------
// SIZING — and the reason it is a floor, not a ceiling.
//
// The naive move is to take as many passages as the pools allow. That is
// backwards, and the preregistration's own floors say why when you read them
// together:
//
//   >= 120 distinct passages entering analysis
//   >= 8 judgments on a passage for that passage to enter analysis
//
// A passage under 8 judgments does not count toward the 120. So 120 passages
// entering analysis costs >= 960 judgments, and EVERY passage added past 120
// raises that bill by 8. The stated 400-judgment floor is not the binding one.
//
// So the packet is built at the floor: 120 passages, 60 human and 60 model, at
// least 20 in each human stratum, 50/50 base rate. --n scales it up for anyone
// who wants a buffer against passages that never reach 8 judgments, and it
// should be used sparingly and deliberately.
// ---------------------------------------------------------------------------
const N_TOTAL = Number(arg("n", 120));
const r = rng(SEED);
const halfN = Math.floor(N_TOTAL / 2);

// ---------------------------------------------------------------------------
// The packet is balanced by REGISTER, not by arm — changed 2026-09-14.
//
// Balancing by arm is what produced the 64.2% packet: 60 human and 60 model is
// a perfect base rate and says nothing about how the two are spread across the
// kinds of writing a reader can see at a glance. Every preregistered floor is
// stated per arm or per human stratum, and register runs across both, so the
// imbalance passed every check in the file.
//
// Balancing by register makes "guess the majority arm for this kind of writing"
// worth exactly 50%, which is what the stated base rate already promises the
// reader. Arm balance is preserved as a consequence: equal halves in each
// register sum to equal halves overall.
//
// What is NOT balanced, deliberately: the split between the two model vendors.
// After the newsletter shortfall is filled the model newsletters will lean
// openai, because claude newsletters survive screening at 25% against openai's
// 40%. That is a limitation about which model the newsletter register samples,
// to be recorded and published — not a confound, because it does not let a
// reader win without reading. Register imbalance did.
// ---------------------------------------------------------------------------
const cells = {};
for (const x of results) for (const p of x.pool) {
  const k = `${registerOf(p)}|${p.arm}`;
  (cells[k] = cells[k] ?? []).push(p);
}
const sz = (k) => (cells[k] ?? []).length;
const blogCap = Math.min(sz("blog_2004|human"), sz("blog_2004|model"));
const newsCap = Math.min(sz("newsletter_ish|human"), sz("newsletter_ish|model"));

// Take the scarcer register as far as it goes, then fill from the other.
let nBlog = Math.min(blogCap, halfN);
let nNews = halfN - nBlog;
if (nNews > newsCap) { nNews = newsCap; nBlog = halfN - nNews; }

let bad = false;
if (nBlog > blogCap) {
  console.log(`  CANNOT FILL: blog register needs ${nBlog} per side, cap is ${blogCap}`);
  bad = true;
}
if (nNews > newsCap) {
  const short = nNews - newsCap;
  const side = sz("newsletter_ish|model") <= sz("newsletter_ish|human") ? "model" : "human";
  console.log(`  CANNOT FILL: newsletter register needs ${nNews} per side, cap is ${newsCap}`);
  console.log(`  short by ${short} on the ${side} side. Generate more and rerun; nothing here can be balanced around it.`);
  bad = true;
}
// The preregistered per-stratum floor still applies, and the human side's two
// registers are its two strata.
if (nBlog < 20) { console.log(`  CANNOT FILL: blog_2004 stratum would contribute ${nBlog}, floor is 20`); bad = true; }
if (nNews < 20) { console.log(`  CANNOT FILL: substack stratum would contribute ${nNews}, floor is 20`); bad = true; }
if (bad) { console.log("\nnothing written.\n"); process.exit(2); }

const want = new Map([
  ["blog_2004|human", nBlog], ["blog_2004|model", nBlog],
  ["newsletter_ish|human", nNews], ["newsletter_ish|model", nNews],
]);
for (const [k, n] of want) {
  if (sz(k) === n) console.log(`\nNote: ${k} is taken whole (${n} of ${n}). No seeded sampling happens there and there is no replacement if a passage is later pulled.`);
}


// --report stops here, but only AFTER the draw has been planned. It used to stop
// before it, which meant the only register figure a --report run ever printed was
// the one for the raw POOLS — and that number is meaningless. The substack pool
// is 533 against 34 model newsletters, so "best score from register alone" on the
// pools reads about 91%, which looks like a catastrophe and is nothing at all:
// the packet draws 34 from each side, not 533. Printing the alarming number and
// withholding the real one is worse than printing neither.
if (REPORT_ONLY) {
  console.log("\n-- the packet this would draw --");
  console.log(`${pad("register", 18)}${num("human", 7)}${num("model", 7)}${num("total", 7)}   P(model | register)`);
  for (const reg of ["blog_2004", "newsletter_ish"]) {
    const n = want.get(`${reg}|human`);
    console.log(`${pad(reg, 18)}${num(n, 7)}${num(n, 7)}${num(n * 2, 7)}        50.0%`);
  }
  console.log(`${pad("TOTAL", 18)}${num(nBlog + nNews, 7)}${num(nBlog + nNews, 7)}${num((nBlog + nNews) * 2, 7)}        50.0%`);
  console.log(`\nbest score obtainable from register alone: 50.0%  — balanced`);
  console.log(`judgments needed at 8 per passage: ${(nBlog + nNews) * 2 * 8}`);
  console.log("\n--report: nothing written.\n");
  process.exit(0);
}

const packet = [];
for (const [k, n] of want) packet.push(...shuffled(cells[k] ?? [], r).slice(0, n));
console.log(`\njudgments needed at 8 per passage: ${packet.length * 8}`);
registerAudit(packet, "the packet as sampled");

// The packet carries 60 third-party human passages verbatim, so it falls under
// the same rule as study/corpus/*/*.txt and study/slop/label.html: it is
// gitignored and never reaches the public repo. What makes the result
// reproducible instead is the KEY — ids, arms, strata, word counts, no text —
// written beside it and tracked, exactly as the slop study's key is.
const out = arg("out", "study/perceived/packet.json");
const keyOut = out.replace(/\.json$/, "-key.tsv");
writeFileSync(out, JSON.stringify({
  seed: SEED, built: new Date().toISOString().slice(0, 10),
  rule: { offset_words: OFFSET_WORDS, min_words: MIN_WORDS, max_words: MAX_WORDS, whole_sentences: true },
  stoplist: { year: true, currency: true, named_products: NAMED_PRODUCTS },
  attrition: Object.fromEntries(results.map((x) => [x.id, x.tally])),
  counts: Object.fromEntries([...want]), balanced_on: "register", total: packet.length, judgments_needed: packet.length * 8,
  passages: shuffled(packet, r),
}, null, 2));
writeFileSync(keyOut, "id\tarm\tstratum\tgenre\twords\n" +
  shuffled(packet, rng(SEED)).map((x) => `${x.id}\t${x.arm}\t${x.stratum}\t${x.genre}\t${x.words}`).join("\n") + "\n");
console.log(`wrote ${keyOut}: the tracked, text-free record of what is in the packet`);
console.log(`wrote ${out}: ${packet.length} passages — ` + [...want].map(([k, v]) => `${k} ${v}`).join(", ") + "\n");
