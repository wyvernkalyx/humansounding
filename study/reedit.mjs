#!/usr/bin/env node
// HumanSounding re-edit experiment (task #32).
//
// The published claim is that self-narration - a model narrating its own
// process, "you're right, I overstated that", "let me reconsider" - lives in a
// specific habitat. The 2026-08-28 habitat study measured 0.00-0.14 per 1,000
// words in single-turn replies and 14.3-19.9 after a correction, roughly a
// hundredfold difference. What that study could not answer is whether the
// behaviour ACCUMULATES: does a model corrected three times narrate three times
// as much, or does it saturate after the first correction?
//
// This script produces the corpus that can answer it. It does not score it.
//
//   node study/reedit.mjs --n 30                 (30 seeds, Anthropic, newest Claude)
//   node study/reedit.mjs --n 4 --dry-run        (print the plan, spend nothing)
//   node study/reedit.mjs --n 30 --vendor gemini --model <id>
//
// ---------------------------------------------------------------------------
// THE DESIGN, AND WHY IT HAS THREE ARMS
//
// The obvious experiment - correct a model repeatedly and watch the rate climb
// - produces a number that cannot be interpreted. A rise would be consistent
// with "correction provokes self-narration" and equally consistent with "any
// second turn provokes self-narration". Those are different claims and only the
// first one is on the site.
//
//   arm C  the seed reply. One turn, nothing else. The round-0 reference.
//   arm A  correction.        The user attributes a fault, then asks for a change.
//   arm B  neutral revision.  The user asks for the SAME change, attributing no fault.
//
// A minus B isolates being corrected. A minus C only tells you that multi-turn
// differs from single-turn, which nobody doubts.
//
// A and B branch from the SAME seed reply rather than from two separate
// generations. Paired: every difference between the arms is the follow-up,
// because everything before the follow-up is the identical text. It also costs
// a third fewer calls than three independent arms would.
//
// The follow-up pairs are built as (fault clause + instruction) against
// (neutral clause + THE SAME instruction), with the two clauses matched for
// length. What differs between arm A and arm B at every round is the
// attribution of error and, as nearly as English allows, nothing else.
//
// ---------------------------------------------------------------------------
// WHAT MUST BE TRUE OF THE MEASUREMENT AFTERWARDS, recorded here because it is
// easier to design for it now than to discover it later:
//
// 1. Measure the WHOLE REPLY, not the revised document. Self-narration lives in
//    the framing around the document - "You're right, I overstated that" - and a
//    document-only measurement throws away exactly the text under test.
//
// 2. Score it with a model, blind to the arm. Not the checker. Our regexes found
//    0 of 37 instances that a human reader found in the habitat study; they are
//    not an instrument for this and using them would return a null result that
//    means nothing.
//
// 3. Control for conversation length. Round 3 carries more context than round 1,
//    so accumulation is confounded with context length unless ctx_words enters
//    the model. That column is in the manifest for that reason.
//
// 4. The prediction is pre-registered in PREREGISTRATION.md, written before the
//    first run. Saturation at round 1 is a live possible outcome and calling it
//    in advance is the difference between a result and a story.

import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, ENV_PATH } from "../scripts/load-env.mjs";
import { VENDORS, Fatal, chat, listModels } from "./vendors.mjs";
import { GENRES } from "./prompts.mjs";

loadEnv();

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? dflt : argv[i + 1];
};
const DRY = argv.includes("--dry-run");
const RUN_DATE = new Date().toISOString().slice(0, 10);
const N_SEEDS = Number(arg("n", 30));
const ROUNDS = Number(arg("rounds", 3));

const OUT = arg("out")
  ? (arg("out").endsWith("/") || arg("out").endsWith("\\") ? arg("out") : arg("out") + "/")
  : fileURLToPath(new URL(`./reedit/${RUN_DATE}/`, import.meta.url));

// The follow-up pairs. Read them as a table: one row per round, the same
// instruction in both arms, and clauses of comparable length in front of it.
//
// They are deliberately content-independent, because they have to work on a
// cover letter, a memo and a product update alike, and because a follow-up
// tailored per document would introduce a second author into the experiment.
//
// Nothing here mentions style, tone, hedging, confidence or thinking out loud.
// A follow-up that said "explain your reasoning" would plant the behaviour
// under test, and the resulting number would measure the instruction.
const FOLLOWUPS = [
  {
    instruction: "Rewrite it for a reader who already knows the background.",
    fault:   "You've written this for someone with no context, which isn't what I asked for.",
    neutral: "I want to see this written for a different reader than the first version.",
  },
  {
    instruction: "Cut it to about half the length and lead with the main point.",
    fault:   "This runs much longer than it needed to and buries the point.",
    neutral: "I need a shorter version of this for a different placement.",
  },
  {
    instruction: "Take out the claim about results and leave everything else as it is.",
    fault:   "You put in a claim about results that I never gave you, and I can't publish that.",
    neutral: "We can't include a claim about results in this one, for reasons on our end.",
  },
];
if (ROUNDS > FOLLOWUPS.length) {
  console.error(`--rounds ${ROUNDS} but only ${FOLLOWUPS.length} follow-up pairs are written.`);
  console.error("Add matched pairs to FOLLOWUPS rather than reusing one, or the later rounds");
  console.error("measure repetition of a prompt as well as accumulation.");
  process.exit(1);
}

const words = (t) => (t.match(/\S+/g) || []).length;
const turnFor = (arm, round) => {
  const f = FOLLOWUPS[round - 1];
  return `${arm === "A" ? f.fault : f.neutral} ${f.instruction}`;
};

// Seeds are drawn round-robin across genres rather than by walking one genre to
// exhaustion, so that a run stopped early - or a smaller --n - is still balanced
// across genres instead of being eight cover letters.
const seeds = [];
for (let i = 0; seeds.length < N_SEEDS; i++) {
  let added = false;
  for (const g of GENRES) {
    if (i >= g.prompts.length) continue;
    seeds.push({ id: `${g.id}__${String(i + 1).padStart(2, "0")}`, genre: g.id, prompt: g.prompts[i] });
    added = true;
    if (seeds.length === N_SEEDS) break;
  }
  if (!added) break;
}
if (seeds.length < N_SEEDS) {
  console.log(`! only ${seeds.length} distinct prompts exist; running ${seeds.length} seeds, not ${N_SEEDS}.`);
}

const VENDOR = arg("vendor", "anthropic");
const V = VENDORS[VENDOR];
if (!V) { console.error(`unknown --vendor ${VENDOR}. Use one of: ${Object.keys(VENDORS).join(", ")}`); process.exit(1); }
const KEY = V.local ? "local" : process.env[V.env];
if (!KEY && !DRY) {
  console.error(`${V.env} is not set. This script calls the ${VENDOR} API; it cannot run without a key.`);
  console.error(`Looked for a .env file at: ${ENV_PATH}`);
  console.error(existsSync(ENV_PATH)
    ? "That file exists, so the line in it is missing, blank, or misspelled."
    : "That file does not exist. Copy .env.example to .env and put the key in it.");
  process.exit(1);
}

let model = arg("model");
if (!model && !DRY) {
  model = V.autoPick(await listModels(V, VENDOR, KEY));
  if (!model) {
    console.error(`--model is required for ${VENDOR}. Run study/generate.mjs to list the ids on your key.`);
    process.exitCode = 1;
  }
}
if (!model && DRY) model = "(unresolved: --dry-run makes no API call)";

const TEXT = join(OUT, "text");
const CONV = join(OUT, "conversations");
const MANIFEST = join(OUT, "MANIFEST.tsv");
const MANIFEST_HEAD = "file\tarm\tseed\tround\tmodel\tserved\tgenre\twords\tctx_words\tdate\tdate_src\tprompt";

const calls = seeds.length * (1 + 2 * ROUNDS);
console.log(`vendor: ${VENDOR}   model: ${model}`);
console.log(`${seeds.length} seeds x (1 baseline + 2 arms x ${ROUNDS} rounds) = ${calls} API calls`);
console.log(`writing to ${OUT}\n`);

if (DRY) {
  console.log("--- arm C (round 0), identical for both arms ---");
  console.log(`  user: ${seeds[0].prompt}`);
  for (let r = 1; r <= ROUNDS; r++) {
    console.log(`\n--- round ${r} ---`);
    const a = turnFor("A", r), b = turnFor("B", r);
    console.log(`  A (correction, ${words(a)} words): ${a}`);
    console.log(`  B (neutral,    ${words(b)} words): ${b}`);
  }
  console.log(`\nSeeds, balanced across ${new Set(seeds.map((s) => s.genre)).size} genres:`);
  for (const g of [...new Set(seeds.map((s) => s.genre))]) {
    console.log(`  ${g}: ${seeds.filter((s) => s.genre === g).length}`);
  }
  console.log("\nNothing was sent. Drop --dry-run to run it.");
  process.exit(0);
}

if (!model) process.exit(1);

mkdirSync(TEXT, { recursive: true });
mkdirSync(CONV, { recursive: true });
{
  const head = existsSync(MANIFEST) ? readFileSync(MANIFEST, "utf8").split("\n", 1)[0].replace(/\r$/, "") : MANIFEST_HEAD;
  if (head !== MANIFEST_HEAD) {
    console.error(`\n${MANIFEST} has an older column layout:\n  ${head}\nExpected:\n  ${MANIFEST_HEAD}`);
    process.exit(1);
  }
}

// The manifest is held in memory keyed by filename and rewritten whole after
// every turn, rather than appended to. A resumed run that regenerates a turn -
// because its conversation file was lost - overwrites the text file, and an
// append would have left the superseded row sitting next to the new one with a
// stale word count. Two rows for one file is not a bookkeeping annoyance here;
// it double-counts that document in the rates.
const rows = new Map();
if (existsSync(MANIFEST)) {
  for (const line of readFileSync(MANIFEST, "utf8").split("\n").slice(1)) {
    if (line.trim()) rows.set(line.split("\t")[0], line.replace(/\r$/, ""));
  }
}
const flushManifest = () =>
  writeFileSync(MANIFEST, MANIFEST_HEAD + "\n" + [...rows.values()].join("\n") + "\n");

let servedModel = null;
let made = 0, resumed = 0, failed = 0, fatalStop = false;

// The conversation file is the resume state, not the text files. A run
// interrupted at round 2 has to continue the SAME conversation, and a history
// rebuilt by concatenating text files off disk would silently drop any turn
// whose write failed. Save after every turn; reload and continue on restart.
const convPath = (seed, arm) => join(CONV, `${seed}__${arm}.json`);
const loadConv = (seed, arm) => (existsSync(convPath(seed, arm)) ? JSON.parse(readFileSync(convPath(seed, arm), "utf8")) : null);

async function turn(messages, meta) {
  const name = `${meta.seed}__${meta.arm}__r${meta.round}.txt`;
  const { text, served } = await chat(V, VENDOR, KEY, model, messages);
  if (!servedModel) servedModel = served;
  writeFileSync(join(TEXT, name), text.replace(/\r\n/g, "\n") + "\n");
  // ctx_words counts every word sent to the model on this call, the covariate
  // that keeps "more context" from being read as "more correction".
  const ctx = messages.reduce((n, m) => n + words(m.content), 0);
  const sent = messages[messages.length - 1].content;
  rows.set(name, `${name}\t${meta.arm}\t${meta.seed}\t${meta.round}\t${model}\t${servedModel || ""}\t${meta.genre}\t${words(text)}\t${ctx}\t${RUN_DATE}\trecorded\t${sent.replace(/\t/g, " ")}`);
  flushManifest();
  console.log(`  ${name}  ${words(text)} words  (ctx ${ctx})`);
  made++;
  return text;
}

for (const s of seeds) {
  if (fatalStop) break;
  try {
    // Round 0. Generated once and shared, which is what makes the two arms
    // paired rather than merely parallel.
    let base = loadConv(s.id, "C");
    if (base) { resumed++; }
    else {
      const messages = [{ role: "user", content: s.prompt }];
      const text = await turn(messages, { seed: s.id, arm: "C", round: 0, genre: s.genre });
      base = [...messages, { role: "assistant", content: text }];
      writeFileSync(convPath(s.id, "C"), JSON.stringify(base, null, 2));
    }

    for (const arm of ["A", "B"]) {
      // Fork from the shared baseline. structuredClone, not a shared reference:
      // arm A pushing its turn onto an array arm B also holds would put A's
      // correction into B's history and quietly destroy the control.
      let messages = loadConv(s.id, arm) || structuredClone(base);
      for (let r = 1; r <= ROUNDS; r++) {
        // Each assistant reply adds one message, each user turn one more, so a
        // completed round r leaves 2r messages past the baseline's two.
        if (messages.length >= 2 + 2 * r) { resumed++; continue; }
        messages.push({ role: "user", content: turnFor(arm, r) });
        const text = await turn(messages, { seed: s.id, arm, round: r, genre: s.genre });
        messages.push({ role: "assistant", content: text });
        writeFileSync(convPath(s.id, arm), JSON.stringify(messages, null, 2));
      }
    }
  } catch (e) {
    if (e instanceof Fatal) {
      console.error(`\nStopping: ${e.message}`);
      console.error(`Nothing further will succeed until that is fixed. ${made} turn${made === 1 ? "" : "s"} written before the stop.`);
      console.error("Rerun the same command afterwards; finished conversations are skipped.");
      process.exitCode = 1;
      fatalStop = true;
      break;
    }
    // One seed failing should not take the run down. The seed is left
    // incomplete and a rerun picks it up from its last saved turn.
    failed++;
    console.error(`  FAILED seed ${s.id}: ${e.message}`);
  }
}

if (servedModel && servedModel !== model) {
  console.log(`\nNote: "${model}" resolved to "${servedModel}". Publish the resolved id, not the alias.`);
}
console.log(`\n${made} turns written, ${resumed} already present, ${failed} seeds failed.`);
console.log(`Next: score ${TEXT} blind to the arm. Do NOT use the checker regexes; see the note at the top of this file.`);
