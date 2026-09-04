#!/usr/bin/env node
// Blind scorer for the re-edit experiment (task #32).
//
//   node study/score-reedit.mjs --sheet 20      write a hand-labeling sheet for Gregg
//   node study/score-reedit.mjs                 score all 210 replies with a model
//   node study/score-reedit.mjs --agreement     compare the model to the hand labels
//   node study/score-reedit.mjs --report        the pre-registered analysis
//
// WHY A MODEL AND NOT THE CHECKER. The habitat study of 2026-08-28 ran regexes
// built from the spec's own examples across 456 model and 80 human documents and
// found 0.00 for five of the six forms. A human reading the same working
// sessions found 37 instances. The regexes are not a weak instrument for this,
// they are not an instrument at all. The pre-registration fixes model scoring in
// advance for that reason.
//
// WHAT BLIND MEANS HERE. The scorer receives one reply and nothing else: no
// filename, no arm, no round, no seed, no conversation history. Files are
// presented in a seeded shuffle so ordering carries no signal either. The arm
// labels are rejoined afterwards from the manifest.
//
// It does NOT mean the treatment is invisible. A corrected model may open with
// "You're right, I overstated that", and that sentence is the outcome being
// measured. Blinding prevents the scorer from being told the label; it cannot
// prevent the label from being inferable from the very behavior under test, and
// no design can.
//
// VALIDATE BEFORE TRUSTING. Run --sheet first, label it by hand, then
// --agreement. A scorer that cannot match a human reader on known cases has no
// business labeling 210 unknown ones. There is a live failure mode here: a model
// scoring for a habit that models have may under-report it the way a native
// speaker misses their own accent.

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, ENV_PATH } from "../scripts/load-env.mjs";
import { VENDORS, Fatal, chat, listModels } from "./vendors.mjs";

loadEnv();
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };

const RUN = arg("run", "study/reedit/2026-09-01");
const MANIFEST = join(RUN, "MANIFEST.tsv");
const SCORES = join(RUN, "SCORES.tsv");
const SHEET = join(RUN, "HAND-LABELS.tsv");
const KEY_FILE = join(RUN, "HAND-LABELS-KEY.tsv");
const SCORES_HEAD = "file\tinstances\tforms\tquotes";

const STUDY_SEED = 20260831;
function seedFrom(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h>>>0}
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296}}

const rows = readFileSync(MANIFEST, "utf8").split("\n").slice(1).filter(r => r.trim())
  .map(r => { const c = r.split("\t"); return { file: c[0], arm: c[1], seed: c[2], round: +c[3], words: +c[7], ctx: +c[8] }; });

// Seeded shuffle so the scorer never sees arms in blocks.
function shuffled(list, key) {
  const rand = mulberry32((seedFrom(key) ^ STUDY_SEED) >>> 0);
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// The rubric is the published rule verbatim from skill/SKILL.md Tier 2 rule 13.
// If it drifts from the skill, the experiment stops measuring the thing the site
// claims and starts measuring whatever this file happens to say.
const RUBRIC = `You are labeling one passage of prose for a linguistics study. Count instances of SELF-NARRATION: writing about the writing, or about the writer's own reliability, instead of about the subject.

The operational test: cut the sentence. If the reader loses no fact about the subject, it was self-narration.

The six forms:
1. Rating your own claim ("medium-high confidence that...", "I'm fairly sure").
2. Announcing your integrity ("let me be transparent", "here's the honest answer", "to be fair", "I'll be straight with you").
3. Apologizing for an earlier draft or acknowledging your own error ("that's on me", "you're right, I overstated that", "I said 25 before").
4. The text describing its own body ("as noted above", "three paragraphs back", "that's the list", word or section counts).
5. Telling the reader how much something matters ("which is the whole point", "and that changes everything").
6. Reviewing your own source's prose ("to their credit", "stated plainly").

Count every instance, including repeats. A single sentence containing two distinct forms counts twice.

Reply with JSON only, no other text:
{"instances":[{"form":<1-6>,"quote":"<the exact words, 12 words maximum>"}]}
An empty list is a valid and expected answer.`;

// ---------------------------------------------------------------- sheet
if (argv.includes("--sheet")) {
  const n = Number(arg("sheet", 20));
  const pick = shuffled(rows, "handlabels").slice(0, n);
  // The sheet carries NO filenames. A filename here reads
  // "cover_letter__04__A__r3", which hands the labeler the arm and the round and
  // destroys the blinding this whole check exists to provide. The mapping lives
  // in a separate key file that --agreement reads and the labeler does not.
  let out = "n\tyour_count\tnotes\n";
  let key = "n\tfile\n";
  let read = "";
  pick.forEach((r, i) => {
    out += `${i + 1}\t\t\n`;
    key += `${i + 1}\t${r.file}\n`;
    read += `\n${"=".repeat(70)}\nPASSAGE ${i + 1} of ${n}   (${r.words} words)\n${"=".repeat(70)}\n\n` +
            readFileSync(join(RUN, "text", r.file), "utf8").trim() + "\n";
  });
  writeFileSync(SHEET, out);
  writeFileSync(KEY_FILE, key);
  writeFileSync(join(RUN, "HAND-LABELS-READ-THIS.txt"),
    `Count self-narration instances in each passage. The rubric:\n\n${RUBRIC}\n\nPut your count in the your_count column of HAND-LABELS.tsv, matched by passage number.\nThe passages are in a seeded shuffle and carry no filenames, because a filename\nnames the arm. Do not open HAND-LABELS-KEY.tsv or SCORES.tsv until you are done.\n${read}`);
  console.log(`Wrote ${SHEET} (${n} rows), the key, and HAND-LABELS-READ-THIS.txt`);
  console.log("Do not open HAND-LABELS-KEY.tsv or SCORES.tsv before labeling.");
  console.log("Label it, then run:  node study/score-reedit.mjs --agreement");
  process.exit(0);
}

// ---------------------------------------------------------------- report
function bootstrapBySeed(sel, valueFn, key) {
  // Resample whole conversations, not turns. Turns inside one conversation are
  // not independent and treating them as such narrows every interval.
  const bySeed = {};
  for (const r of sel) (bySeed[r.seed] ||= []).push(r);
  const seeds = Object.keys(bySeed);
  const rand = mulberry32((seedFrom(key) ^ STUDY_SEED) >>> 0);
  const out = [];
  for (let b = 0; b < 2000; b++) {
    const acc = [];
    for (let i = 0; i < seeds.length; i++) acc.push(...bySeed[seeds[(rand() * seeds.length) | 0]]);
    out.push(valueFn(acc));
  }
  out.sort((a, b) => a - b);
  return [out[50], out[1949]];
}

if (argv.includes("--report")) {
  if (!existsSync(SCORES)) { console.error(`No ${SCORES}. Run the scorer first.`); process.exit(1); }
  const sc = {};
  for (const line of readFileSync(SCORES, "utf8").split("\n").slice(1)) {
    if (!line.trim()) continue; const c = line.split("\t"); sc[c[0]] = +c[1];
  }
  const missing = rows.filter(r => !(r.file in sc));
  if (missing.length) console.log(`! ${missing.length} of ${rows.length} replies unscored; report covers the rest\n`);
  const scored = rows.filter(r => r.file in sc).map(r => ({ ...r, n: sc[r.file] }));

  const per1k = a => a.reduce((s, r) => s + r.n, 0) / a.reduce((s, r) => s + r.words, 0) * 1000;
  const perReply = a => a.reduce((s, r) => s + r.n, 0) / a.length;

  console.log("Self-narration, blind model scoring. Conversations resampled, not turns.\n");
  for (const [name, fn] of [["instances per 1,000 words", per1k], ["instances per reply", perReply]]) {
    console.log(name.toUpperCase());
    console.log("        " + [0, 1, 2, 3].map(r => `round ${r}`.padStart(20)).join(""));
    for (const arm of ["C", "A", "B"]) {
      const cells = [0, 1, 2, 3].map(rd => {
        const sel = scored.filter(r => r.arm === arm && r.round === rd);
        if (!sel.length) return "-".padStart(20);
        const [lo, hi] = bootstrapBySeed(sel, fn, `${arm}:${rd}:${name}`);
        return `${fn(sel).toFixed(2)} [${lo.toFixed(2)},${hi.toFixed(2)}]`.padStart(20);
      });
      console.log(`arm ${arm}   ` + cells.join(""));
    }
    console.log("");
  }
  console.log("Read both tables together. The pre-registration amendment of 2026-09-01");
  console.log("requires arm A to exceed arm B on BOTH before prediction 2 counts as met,");
  console.log("because corrected replies run about 40% shorter and a shrinking denominator");
  console.log("can manufacture a rise in the per-1,000 measure on its own.");
  process.exit(0);
}

// ---------------------------------------------------------------- agreement
if (argv.includes("--agreement")) {
  if (!existsSync(SHEET) || !existsSync(SCORES) || !existsSync(KEY_FILE)) { console.error("Need HAND-LABELS.tsv, HAND-LABELS-KEY.tsv and SCORES.tsv."); process.exit(1); }
  const keyMap = {};
  for (const l of readFileSync(KEY_FILE, "utf8").split("\n").slice(1)) { if (!l.trim()) continue; const c = l.split("\t"); keyMap[c[0]] = c[1]; }
  const sc = {};
  for (const l of readFileSync(SCORES, "utf8").split("\n").slice(1)) { if (!l.trim()) continue; const c = l.split("\t"); sc[c[0]] = +c[1]; }
  const pairs = [];
  for (const l of readFileSync(SHEET, "utf8").split("\n").slice(1)) {
    if (!l.trim()) continue;
    const c = l.split("\t");
    const file = keyMap[c[0]];
    if (c[1] === undefined || c[1].trim() === "" || !file || !(file in sc)) continue;
    pairs.push({ file, human: +c[1], model: sc[file] });
  }
  if (!pairs.length) { console.error("No labeled rows found in HAND-LABELS.tsv (column 3 is empty)."); process.exit(1); }
  const exact = pairs.filter(p => p.human === p.model).length;
  const within1 = pairs.filter(p => Math.abs(p.human - p.model) <= 1).length;
  const mh = pairs.reduce((s, p) => s + p.human, 0) / pairs.length;
  const mm = pairs.reduce((s, p) => s + p.model, 0) / pairs.length;
  const mx = pairs.reduce((s, p) => s + p.human * p.model, 0) / pairs.length;
  const sd = a => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length - (a.reduce((s, x) => s + x, 0) / a.length) ** 2);
  const r = (mx - mh * mm) / (sd(pairs.map(p => p.human)) * sd(pairs.map(p => p.model)) || 1);
  console.log(`${pairs.length} labeled passages`);
  console.log(`  exact agreement   ${exact}/${pairs.length}  (${(exact / pairs.length * 100).toFixed(0)}%)`);
  console.log(`  within one        ${within1}/${pairs.length}  (${(within1 / pairs.length * 100).toFixed(0)}%)`);
  console.log(`  mean: you ${mh.toFixed(2)}, model ${mm.toFixed(2)}${mm < mh ? "   MODEL UNDER-REPORTS" : mm > mh ? "   model over-reports" : ""}`);
  console.log(`  correlation       ${r.toFixed(2)}`);
  console.log("\nDisagreements:");
  for (const p of pairs.filter(p => p.human !== p.model)) console.log(`  ${p.file.padEnd(34)} you ${p.human}, model ${p.model}`);
  console.log("\nA systematic under-report is the failure this check exists to catch, and it");
  console.log("does not invalidate the experiment: a constant offset affects both arms and");
  console.log("the comparison survives it. A correlation near zero does invalidate it.");
  process.exit(0);
}

// ---------------------------------------------------------------- score
const VENDOR = arg("vendor", "anthropic");
const V = VENDORS[VENDOR];
if (!V) { console.error(`unknown --vendor ${VENDOR}`); process.exit(1); }
const KEY = V.local ? "local" : process.env[V.env];
if (!KEY) { console.error(`${V.env} is not set. Looked in ${ENV_PATH}`); process.exit(1); }

let model = arg("model");
if (!model) { model = V.autoPick(await listModels(V, VENDOR, KEY)); }
if (!model) { console.error(`--model is required for ${VENDOR}`); process.exit(1); }

if (!existsSync(SCORES)) writeFileSync(SCORES, SCORES_HEAD + "\n");
const done = new Set(readFileSync(SCORES, "utf8").split("\n").slice(1).filter(l => l.trim()).map(l => l.split("\t")[0]));

const queue = shuffled(rows, "scoring").filter(r => !done.has(r.file));
// No temperature is sent. Claude Opus 5 rejects the field outright
// ("`temperature` is deprecated for this model", 400), which is the same class
// of failure as the request field that killed the weekly refresh on 2026-08-17
// and which vendors.mjs carries a comment warning about. Scores are therefore
// not bit-reproducible across reruns. SCORES.tsv is the record; keep it rather
// than regenerating it, and say so if the numbers are ever published.
console.log(`vendor: ${VENDOR}   model: ${model}`);
console.log(`${queue.length} to score, ${done.size} already done\n`);

let n = 0, failed = 0;
for (const r of queue) {
  const text = readFileSync(join(RUN, "text", r.file), "utf8").trim();
  try {
    const { text: raw } = await chat(V, VENDOR, KEY, model,
      [{ role: "user", content: `${RUBRIC}\n\n---- PASSAGE ----\n${text}` }]);
    const m = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`no JSON in reply: ${raw.slice(0, 80)}`);
    const parsed = JSON.parse(m[0]);
    const inst = Array.isArray(parsed.instances) ? parsed.instances : [];
    appendFileSync(SCORES, `${r.file}\t${inst.length}\t${inst.map(i => i.form).join(",")}\t` +
      `${inst.map(i => String(i.quote || "").replace(/[\t\n]/g, " ").slice(0, 60)).join(" | ")}\n`);
    n++;
    if (n % 20 === 0) console.log(`  ${n} scored`);
  } catch (e) {
    if (e instanceof Fatal) { console.error(`\nStopping: ${e.message}`); process.exitCode = 1; break; }
    failed++;
    console.error(`  FAILED ${r.file}: ${e.message}`);
  }
}
console.log(`\n${n} scored, ${failed} failed. Rerun to pick up failures.`);
console.log(`Next: node study/score-reedit.mjs --report`);
