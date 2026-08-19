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
//   csv      one document per row, from a "text" or "body" column
//   jsonl    one document per line, from a "text" or "body" field
//
// Everything it writes lands in study/corpus/human/ and gets a MANIFEST.tsv
// row. Nothing enters the study without a recorded source, date and reason it
// is known to be human.

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("./corpus/human/", import.meta.url));
const MANIFEST = join(OUT, "MANIFEST.tsv");
const MIN_WORDS = 100;
const MAX_WORDS = 2500;

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };

const IN = arg("in");
const FORMAT = arg("format", "text");
const LABEL = arg("label");
const DATE = arg("date");
const WHY = arg("why");
const N = Number(arg("n", 40));

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
      if (k) out.push(o[k]);
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

// --- collect ----------------------------------------------------------------

if (!existsSync(IN)) { console.error(IN + " does not exist"); process.exit(1); }
mkdirSync(OUT, { recursive: true });
if (!existsSync(MANIFEST)) writeFileSync(MANIFEST, "file\tsource\tdate\twhy_known_human\n");

const files = walk(IN);
console.log(`${files.length} files under ${IN}, format ${FORMAT}`);

const pool = [];
const seen = new Set();
for (const f of files) {
  let docs = [];
  try { docs = EXTRACT(f); } catch { continue; }
  for (const raw of docs) {
    const t = clean(raw);
    const w = words(t);
    if (w < MIN_WORDS || w > MAX_WORDS) continue;
    // One author should not dominate. At most two documents per source file,
    // except for csv/jsonl, where a single file legitimately holds the whole
    // corpus and a per-file cap would yield two documents in total.
    if (!MANY_PER_FILE) {
      const from = pool.filter((p) => p.file === f).length;
      if (from >= 2) break;
    }
    const key = t.slice(0, 300).toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({ file: f, text: t, words: w });
  }
}

console.log(`${pool.length} documents between ${MIN_WORDS} and ${MAX_WORDS} words`);
if (!pool.length) { console.error("Nothing usable. Check --format against what is actually in that folder."); process.exit(1); }

// Sample without replacement so the corpus is not just the alphabetical head
// of the archive, which in most corpora means one or two authors.
for (let i = pool.length - 1; i > 0; i--) {
  const j = (Math.random() * (i + 1)) | 0;
  [pool[i], pool[j]] = [pool[j], pool[i]];
}
const take = pool.slice(0, N);

let written = 0;
for (let i = 0; i < take.length; i++) {
  const name = `${LABEL}__${String(i + 1).padStart(3, "0")}.txt`;
  const path = join(OUT, name);
  if (existsSync(path)) continue;
  writeFileSync(path, take[i].text.replace(/\r\n/g, "\n") + "\n");
  appendFileSync(MANIFEST, `${name}\t${LABEL}\t${DATE}\t${WHY}\n`);
  written++;
}

const total = take.reduce((s, d) => s + d.words, 0);
console.log(`\n${written} documents written to ${OUT}`);
console.log(`${total.toLocaleString()} words, median ${take.map((d) => d.words).sort((a, b) => a - b)[take.length >> 1]} words`);
console.log(`\nSpot-check a few by eye before trusting any number. Extraction is`);
console.log(`the step where corpora quietly go wrong.`);
console.log(`\nNext: node study/measure.mjs study/corpus/ai study/corpus/human`);
