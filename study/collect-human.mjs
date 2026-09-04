#!/usr/bin/env node
// HumanSounding corpus collector: the human arm.
//
// Turns a downloaded research corpus into study documents. It does not fetch
// anything. You download the corpus yourself, point this at the folder, and it
// extracts, filters, samples and records provenance.
//
//   node study/collect-human.mjs --in "C:\corpora\blogs" --format blogger \
//     --label blogauthorship --date 2004 --why "Blog Authorship Corpus, collected 2004, pre-ChatGPT by 18 years" --n 40
//
// Formats:
//   text     one document per file (.txt/.md), used as-is
//   blogger  Blog Authorship Corpus XML, one file per blogger, <post> blocks
//   maildir  Enron-style mail files, headers and quoted replies stripped
//   csv      one document per row, from a "text" or "body" column (streamed,
//            so a 1 GB file is fine)
//   jsonl    one document per line, from a "text" or "body" field
//
// --before <YYYY-MM-DD> drops any document dated on or after that day, using a
// date column in the corpus. Rows with no parseable date are dropped too. That
// is deliberate: a corpus that runs past November 2022 needs a hard cutoff, and
// a document whose date cannot be read has no provenance, which is the one
// thing this arm exists to guarantee.
//
// Everything it writes lands in study/corpus/human/ and gets a MANIFEST.tsv
// row. Nothing enters the study without a recorded source, date and reason it
// is known to be human.

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync, statSync, createReadStream } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const MIN_WORDS = 100;
const MAX_WORDS = 2500;

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };

// --out lets a second source live in its own directory, so it can be compared
// against the AI set on its own rather than averaged in with the first source.
// Two human sets that disagree is a finding; one blended set hides it.
const OUT = arg("out")
  ? (arg("out").endsWith("/") || arg("out").endsWith("\\") ? arg("out") : arg("out") + "/")
  : fileURLToPath(new URL("./corpus/human/", import.meta.url));
const MANIFEST = join(OUT, "MANIFEST.tsv");

const IN = arg("in");
const FORMAT = arg("format", "text");
const LABEL = arg("label");
const DATE = arg("date");
const WHY = arg("why");
const N = Number(arg("n", 40));
const BEFORE = arg("before") ? Date.parse(arg("before") + "T00:00:00Z") : null;
// The bootstrap in measure.mjs has been seeded since 2026-08-31 so that published
// intervals reproduce. The SAMPLING was not, which left the human arm -- the one
// arm whose provenance is the entire argument -- impossible for anyone, us
// included, to rebuild. Same reasoning, same default seed.
const SEED = Number(arg("seed", 20260831));
if (arg("before") && Number.isNaN(BEFORE)) { console.error("--before must be YYYY-MM-DD"); process.exit(1); }

if (!IN || !LABEL || !DATE || !WHY) {
  console.error("usage: node study/collect-human.mjs --in <dir> --format text|blogger|maildir|csv|jsonl \\");
  console.error("         --label <short-name> --date <year or ISO date> --why <why this is known human> [--n 40]");
  console.error("");
  console.error("--why is not optional and not decoration. It is the column that makes");
  console.error("this a study instead of a pile of text.");
  process.exit(1);
}

// Try UTF-8 strictly; fall back to latin1 only if the bytes are genuinely not
// UTF-8. Reading UTF-8 as latin1 does not fail, it silently mangles: a curly
// apostrophe becomes three characters, and an em dash stops being an em dash
// and stops being counted. That is a measurement error dressed as a result.
function readText(path) {
  const buf = readFileSync(path);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return buf.toString("latin1"); }
}

function walk(dir, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

// --- extractors: each returns an array of raw document strings ---------------

function fromText(path) {
  if (![".txt", ".md"].includes(extname(path).toLowerCase())) return [];
  return [readText(path)];
}

// Blog Authorship Corpus: <Blog><post>text</post><post>...</post></Blog>,
// with <date> elements between posts. Latin-1 in places, so read loosely.
function fromBlogger(path) {
  if (extname(path).toLowerCase() !== ".xml") return [];
  const src = readText(path);
  return [...src.matchAll(/<post>([\s\S]*?)<\/post>/g)].map((m) => m[1]);
}

// Enron-style RFC822: drop headers, drop quoted replies and forwarded blocks,
// because a reply chain is several authors wearing one filename.
function fromMaildir(path) {
  const src = readText(path);
  const blank = src.indexOf("\n\n");
  if (blank === -1) return [];
  let body = src.slice(blank + 2);
  body = body.split(/^-+\s*Original Message\s*-+$/mi)[0];
  body = body.split(/^-+\s*Forwarded by/mi)[0];
  body = body.split(/^\s*To:\s.*\n\s*cc:/mi)[0];
  body = body.replace(/^\s*>.*$/gm, "");
  return [body];
}

// Minimal RFC4180: quoted fields, doubled quotes inside them, newlines inside
// them. Not a general CSV library, but the Kaggle export of the blog corpus
// has 600k rows of prose with embedded commas and newlines, and a naive
// split(",") silently shreds it into fragments that still look like text.
function parseCSV(src) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const TEXT_COLUMNS = ["text", "body", "content", "post", "article"];
const DATE_COLUMNS = ["timestamp", "date", "published", "published_at", "created_at", "pubdate"];

function fromCSV(path) {
  if (extname(path).toLowerCase() !== ".csv") return [];
  const rows = parseCSV(readText(path));
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = head.findIndex((h) => TEXT_COLUMNS.includes(h));
  if (col === -1) {
    console.error(`  ${path}: no text column. Saw: ${head.join(", ")}`);
    return [];
  }
  return rows.slice(1).map((r) => r[col] || "");
}

function fromJSONL(path) {
  if (![".jsonl", ".ndjson"].includes(extname(path).toLowerCase())) return [];
  const out = [];
  for (const line of readText(path).split(/\n/)) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      const k = TEXT_COLUMNS.find((k) => typeof o[k] === "string");
      const dk = DATE_COLUMNS.find((k) => typeof o[k] === "string");
      if (k) out.push({ text: o[k], date: dk ? o[dk] : "" });
    } catch { /* a malformed line is one lost document, not a lost run */ }
  }
  return out;
}

const MANY_PER_FILE = ["csv", "jsonl"].includes(FORMAT);
const EXTRACT = { text: fromText, blogger: fromBlogger, maildir: fromMaildir, csv: fromCSV, jsonl: fromJSONL }[FORMAT];
if (!EXTRACT) { console.error("unknown --format " + FORMAT); process.exit(1); }

// --- cleaning ---------------------------------------------------------------

// urlLink is a Blog Authorship Corpus placeholder for stripped hyperlinks.
// Signature blocks and disclaimers are boilerplate somebody's lawyer wrote,
// not prose the author chose, so they leave.
// Text that arrived already double-encoded (someone else read UTF-8 as latin1
// before we ever saw it) is repaired here rather than measured as-is.
function demojibake(t) {
  if (!/\u00c3[\u0080-\u00bf]|\u00e2\u0080/.test(t)) return t;
  try {
    const fixed = new TextDecoder("utf-8", { fatal: true })
      .decode(Uint8Array.from([...t].map((c) => c.charCodeAt(0) & 0xff)));
    return fixed;
  } catch { return t; }
}

function clean(raw) {
  return demojibake(raw)
    .replace(/&(nbsp|amp|lt|gt|quot|#\d+);/g, " ")
    .replace(/\burlLink\b/g, "")
    .replace(/^\s*(?:\*{3,}|={3,}|_{3,}).*$/gm, "")
    .replace(/This (?:e-?mail|message)[\s\S]{0,400}?(?:confidential|privileged)[\s\S]{0,400}$/i, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const words = (t) => (t.match(/\S+/g) || []).length;

// --- sampling ---------------------------------------------------------------

// mulberry32, the generator measure.mjs and substance.mjs already use. Copied
// rather than imported because this script deliberately has no dependency on
// the measurement side: it must be runnable against a raw corpus download
// before any of the study exists.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Seeded per label as well as per seed, so collecting a second source does not
// reshuffle the first one's sample.
const rand = mulberry32((SEED ^ [...LABEL].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)) >>> 0);


// Reservoir sampling. Keeps exactly N documents in memory no matter how large
// the corpus is, and every candidate has an equal chance of being one of them.
// The previous approach held every candidate and shuffled at the end, which is
// fine for 36,000 blog posts and fatal for a 1 GB CSV. Stopping early instead
// would bias the sample toward whatever the file happens to be sorted by.
const reservoir = [];
const seen = new Set();
let considered = 0, skippedDate = 0, skippedLength = 0, skippedDupe = 0;

function consider(raw, date, file) {
  const t = clean(raw);
  const w = words(t);
  if (w < MIN_WORDS || w > MAX_WORDS) { skippedLength++; return; }
  if (BEFORE !== null) {
    const d = date ? Date.parse(date) : NaN;
    // No readable date means no provenance, so it does not enter the study.
    if (Number.isNaN(d) || d >= BEFORE) { skippedDate++; return; }
  }
  const key = t.slice(0, 300).toLowerCase().replace(/\s+/g, " ");
  if (seen.has(key)) { skippedDupe++; return; }
  seen.add(key);
  considered++;
  const doc = { file, text: t, words: w, date };
  if (reservoir.length < N) { reservoir.push(doc); return; }
  const j = (rand() * considered) | 0;
  if (j < N) reservoir[j] = doc;
}

// --- streaming CSV ----------------------------------------------------------

// Same grammar as parseCSV, fed a chunk at a time so a 1 GB file never becomes
// a 1 GB string. Emits each completed row to a callback.
function streamCSV(path, onRow) {
  return new Promise((resolve, reject) => {
    let row = [], field = "", q = false, carry = "";
    const push = () => { row.push(field); field = ""; };
    const stream = createReadStream(path, { encoding: "utf8" });
    stream.on("data", (chunk) => {
      const src = carry + chunk;
      carry = "";
      for (let i = 0; i < src.length; i++) {
        const c = src[i];
        // A quote at the very end of a chunk is ambiguous until we see the next
        // character, so hold it over rather than guess.
        if (q && c === '"' && i === src.length - 1) { carry = c; break; }
        if (q) {
          if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
          else if (c === '"') q = false;
          else field += c;
        } else if (c === '"') q = true;
        else if (c === ",") push();
        else if (c === "\n") { push(); onRow(row); row = []; }
        else if (c !== "\r") field += c;
      }
    });
    stream.on("end", () => { if (field || row.length) { push(); onRow(row); } resolve(); });
    stream.on("error", reject);
  });
}

// --- collect ----------------------------------------------------------------

if (!existsSync(IN)) { console.error(IN + " does not exist"); process.exit(1); }
mkdirSync(OUT, { recursive: true });
// One schema, and check it. The substack manifest spent a day carrying 853 rows
// of ten fields under a five-field header because the writer and the header
// drifted apart, and a manifest that lies about its own columns makes the
// provenance argument unauditable. Adding the seed column is exactly the kind of
// change that caused that, so the header is declared once and an existing file
// that disagrees with it stops the run instead of being appended to.
const MANIFEST_COLUMNS = ["file", "source", "date", "seed", "why_known_human"];
const MANIFEST_HEADER = MANIFEST_COLUMNS.join("\t") + "\n";
if (!existsSync(MANIFEST)) {
  writeFileSync(MANIFEST, MANIFEST_HEADER);
} else {
  const found = readText(MANIFEST).split("\n")[0].trim();
  if (found !== MANIFEST_COLUMNS.join("\t")) {
    console.error(`\n${MANIFEST} has a different schema than this script writes.`);
    console.error(`  file has: ${found}`);
    console.error(`  expected: ${MANIFEST_COLUMNS.join("\t")}`);
    console.error("\nAppending would produce rows that do not match the header. Regenerate the");
    console.error("arm into a fresh --out directory, or migrate the existing manifest first.");
    process.exit(1);
  }
}

const files = walk(IN);
console.log(`${files.length} files under ${IN}, format ${FORMAT}`);
if (BEFORE !== null) console.log(`cutoff: documents must be dated before ${arg("before")}`);

if (FORMAT === "csv") {
  for (const f of files.filter((f) => extname(f).toLowerCase() === ".csv")) {
    let textCol = -1, dateCol = -1, header = null, perFile = 0;
    await streamCSV(f, (row) => {
      if (!header) {
        header = row.map((h) => h.trim().toLowerCase());
        textCol = header.findIndex((h) => TEXT_COLUMNS.includes(h));
        dateCol = header.findIndex((h) => DATE_COLUMNS.includes(h));
        if (textCol === -1) console.error(`  ${f}: no text column. Saw: ${header.join(", ")}`);
        if (BEFORE !== null && dateCol === -1) console.error(`  ${f}: --before was given but no date column. Saw: ${header.join(", ")}`);
        return;
      }
      if (textCol === -1) return;
      perFile++;
      consider(row[textCol] || "", dateCol === -1 ? "" : row[dateCol], f);
    });
    console.log(`  ${f}: ${perFile.toLocaleString()} rows`);
  }
} else {
  for (const f of files) {
    let docs = [];
    try { docs = EXTRACT(f); } catch { continue; }
    let perFile = 0;
    for (const d of docs) {
      const raw = typeof d === "string" ? d : d.text;
      const date = typeof d === "string" ? "" : d.date;
      // One author should not dominate. At most two documents per source file,
      // except for csv/jsonl, where one file legitimately holds a whole corpus.
      if (!MANY_PER_FILE && perFile >= 2) break;
      const before = reservoir.length + considered;
      consider(raw, date, f);
      if (reservoir.length + considered > before) perFile++;
    }
  }
}

console.log(`${considered.toLocaleString()} documents between ${MIN_WORDS} and ${MAX_WORDS} words`);
if (skippedDate) console.log(`  ${skippedDate.toLocaleString()} dropped: dated on or after the cutoff, or undated`);
if (skippedDupe) console.log(`  ${skippedDupe.toLocaleString()} dropped: duplicate of a document already taken`);
if (!reservoir.length) { console.error("Nothing usable. Check --format, and --before, against what is actually in that folder."); process.exit(1); }

const take = reservoir;

let written = 0;
for (let i = 0; i < take.length; i++) {
  const name = `${LABEL}__${String(i + 1).padStart(3, "0")}.txt`;
  const path = join(OUT, name);
  if (existsSync(path)) continue;
  writeFileSync(path, take[i].text.replace(/\r\n/g, "\n") + "\n");
  const rowDate = take[i].date ? String(take[i].date).slice(0, 10) : DATE;
  appendFileSync(MANIFEST, `${name}\t${LABEL}\t${rowDate}\t${SEED}\t${WHY}\n`);
  written++;
}

const total = take.reduce((s, d) => s + d.words, 0);
console.log(`\n${written} documents written to ${OUT}`);
console.log(`${total.toLocaleString()} words, median ${take.map((d) => d.words).sort((a, b) => a - b)[take.length >> 1]} words`);
console.log(`\nSpot-check a few by eye before trusting any number. Extraction is`);
console.log(`the step where corpora quietly go wrong.`);
console.log(`\nNext: node study/measure.mjs study/corpus/ai study/corpus/human`);
