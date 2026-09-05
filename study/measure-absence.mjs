#!/usr/bin/env node
// Absence measurement (task #57). Reports the share of first-person sentences
// carrying a sensory verb, with bootstrap CIs over documents.
//
//   node study/measure-absence.mjs study/corpus/exp-claude-2026-09-01
//
// The human arm is the on-topic subset of the 2004 blog corpus, fixed in
// study/corpus/human/ONTOPIC-2026-09-01.json on 2026-09-01, BEFORE any
// experience-mode documents existed. That ordering is the point: a subset
// chosen after seeing the machine arm is a subset chosen to produce a result.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const STUDY_SEED = 20260831;
function seedFrom(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h>>>0}
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296}}

const FP = /\b(?:I|me|my|mine|myself)\b/;
// Perception and physical action. Hand-picked, and that is a known weakness:
// this list needs the same false-positive audit the negation candidates got
// before any number from it is published.
const SENSORY = /\b(?:saw|see|seeing|heard|hear|hearing|smell(?:ed|ing)?|tast(?:ed|ing|e)|felt|feel(?:ing)?|watch(?:ed|ing)?|notic(?:ed|ing|e)|drove|driv(?:e|ing)|walk(?:ed|ing)?|ran|running|sat|sitting|stood|standing|ate|eat(?:ing)?|drank|drink(?:ing)?|open(?:ed|ing)?|slam(?:med|ming)?|star(?:ed|ing)|laugh(?:ed|ing)?|cried|cry(?:ing)?|shout(?:ed|ing)?|touch(?:ed|ing)?|carried|carry(?:ing)?|climb(?:ed|ing)?|grab(?:bed|bing)?)\b/i;

function docShare(text){
  const sents = text.split(/(?<=[.!?])\s+/).filter(s=>/\w/.test(s));
  const fp = sents.filter(s=>FP.test(s));
  if (!fp.length) return null;
  return { share: fp.filter(s=>SENSORY.test(s)).length / fp.length, n: fp.length };
}

function load(dir){
  const onTopic = join(dir, "ONTOPIC-2026-09-01.json");
  let files = readdirSync(dir).filter(f=>f.endsWith(".txt"));
  let note = "";
  if (existsSync(onTopic)) {
    const j = JSON.parse(readFileSync(onTopic,"utf8"));
    files = j.files;
    note = `  subset: ${j.criterion}\n  chosen: ${j.chosen}`;
  }
  const docs = [];
  for (const f of files) {
    const t = readFileSync(join(dir,f),"utf8");
    if ((t.match(/[A-Za-z]+/g)||[]).length < 100) continue;
    const d = docShare(t);
    if (d) docs.push(d);
  }
  return { docs, note };
}

function ci(vals, key){
  const rand = mulberry32((seedFrom(key) ^ STUDY_SEED)>>>0);
  const out = [];
  for (let b=0;b<2000;b++){
    let s=0; for (let i=0;i<vals.length;i++) s += vals[(rand()*vals.length)|0];
    out.push(s/vals.length);
  }
  out.sort((a,b)=>a-b);
  return [out[50], out[1949]];
}

const dirs = process.argv.slice(2);
if (!dirs.length) { console.error("usage: node study/measure-absence.mjs <dir> [<dir>...]"); process.exit(1); }
dirs.push("study/corpus/human");

const results = [];
for (const dir of dirs) {
  if (!existsSync(dir)) { console.error(`missing: ${dir}`); continue; }
  const { docs, note } = load(dir);
  if (!docs.length) { console.log(`${dir}: no documents with first-person sentences`); continue; }
  const shares = docs.map(d=>d.share);
  const mean = shares.reduce((a,b)=>a+b,0)/shares.length;
  const [lo,hi] = ci(shares, dir);
  results.push({ dir, n: docs.length, fp: docs.reduce((a,d)=>a+d.n,0), mean, lo, hi, note });
}

console.log("\nFirst-person sentences carrying a sensory verb. Document is the unit.");
console.log("Bootstrap 2,000 resamples over documents, seeded.\n");
console.log("arm".padEnd(38)+"docs".padStart(6)+"FP sents".padStart(10)+"share".padStart(9)+"   95% CI");
console.log("-".repeat(85));
for (const r of results) {
  console.log(r.dir.padEnd(38)+String(r.n).padStart(6)+String(r.fp).padStart(10)+
    (r.mean*100).toFixed(1).padStart(8)+"%"+`   [${(r.lo*100).toFixed(1)}, ${(r.hi*100).toFixed(1)}]`);
  if (r.note) console.log(r.note);
}
const human = results.find(r=>r.dir.includes("human"));
if (human) {
  console.log("");
  for (const r of results) {
    if (r === human) continue;
    const clears = r.hi < human.lo || r.lo > human.hi;
    console.log(`${r.dir} vs human: ${clears ? "CLEARS" : "does not clear"}` +
      `  (${(r.lo*100).toFixed(1)}-${(r.hi*100).toFixed(1)} against ${(human.lo*100).toFixed(1)}-${(human.hi*100).toFixed(1)})`);
  }
  console.log("\nA 12-document pilot is for estimating the effect, not for deciding it.");
  console.log("Read the point estimates and the gap, not the verdict line.");
}
