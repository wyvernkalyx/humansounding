#!/usr/bin/env node
// HumanSounding corpus generator: the AI arm.
//
// Writes one plain-text document per file into study/corpus/ai/, plus a
// MANIFEST.tsv recording the exact model, prompt and word count behind every
// file. Nothing about a document is inferred later; if it is not in the
// manifest it is not in the study.
//
//   node study/generate.mjs --n 5                          (Anthropic, newest Claude)
//   node study/generate.mjs --n 5 --vendor openai --model <id>
//   node study/generate.mjs --n 5 --vendor gemini --model <id>
//
// Keys come from .env: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY.
//
// Why more than one vendor: a corpus drawn from a single model answers "does
// THIS model still write like that", not "does AI writing still look like
// that". The August 2026 Claude-only run found the delve/meticulous vocabulary
// almost extinct, while the live site's own tell counts showed it firing on
// real visitor pastes more than any rule except em dashes. People do not paste
// one vendor. Run each vendor into its own --out directory and compare them.
//
// The one methodological rule this file exists to enforce: the prompts ask for
// writing the way a person actually asks for writing. They never say "sound
// natural", never say "sound like AI", never mention style at all. If the
// prompt shapes the prose, the study measures the prompt. What we want is the
// model's default register, because that is what lands in the inbox of the
// person pasting into humansounding.com.
//
// Safe to rerun. Existing files are skipped, so an interrupted run resumes.

import { writeFileSync, existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, ENV_PATH } from "../scripts/load-env.mjs";
import { VENDORS, Fatal, chat, listModels } from "./vendors.mjs";
import { GENRES, CHAT_GENRES } from "./prompts.mjs";
import { EXPERIENCE_GENRES } from "./prompts-experience.mjs";

loadEnv();

// fileURLToPath, not URL.pathname. See the note in scripts/load-env.mjs.
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? dflt : argv[i + 1];
};
// --out keeps each vendor in its own directory so they can be measured against
// the human sets separately. One blended AI set would average away exactly the
// between-vendor difference this is being run to find.
const OUT = arg("out")
  ? (arg("out").endsWith("/") || arg("out").endsWith("\\") ? arg("out") : arg("out") + "/")
  : fileURLToPath(new URL(argv.includes("--mode") && argv[argv.indexOf("--mode") + 1] === "chat" ? "./corpus/chat-ai/" : "./corpus/ai/", import.meta.url));
const MANIFEST = join(OUT, "MANIFEST.tsv");
// The vendor table, the retry rules and the token cap moved to
// study/vendors.mjs on 2026-09-01 so study/reedit.mjs could share them. The
// requests are the ones this script always sent, with one recorded exception on
// the Gemini body; the note in vendors.mjs has it.

// --mode chat swaps the document genres for conversational turns. The stance
// markers the checker cannot see ("the honest answer", "two things worth
// noting", "I'd push back") belong to the register where a model explains or
// advises a person, and the 2026-08-27 pilot found ritual pushback at 0.00
// across all 116,353 words of the document corpora. That was the instrument
// failing to reach the register, not a finding about pushback. This mode is
// the corpus that can answer the question.
const MODE = arg("mode", "docs");
if (!["docs", "chat", "experience"].includes(MODE)) { console.error(`--mode must be docs, chat or experience`); process.exit(1); }

const N_PER_GENRE = Number(arg("n", 5));

const SETS = MODE === "chat" ? CHAT_GENRES : MODE === "experience" ? EXPERIENCE_GENRES : GENRES;

// Length. This constant existed from the first run and was never appended to a
// prompt, so every corpus in study/corpus/ was generated with NO length
// instruction. Found 2026-08-27. The accident turned out to be informative:
// unprompted, Claude Opus 5 held between 507 and 627 words on all 40 documents
// while OpenAI's chat model ran a median of 195, so default verbosity differs
// about threefold between vendors and is itself a per-model fingerprint.
//
// It is now opt-in rather than silently on. Default off preserves the register
// a person actually writes in, since people usually do not name a word count.
// Pass --length to append it when you need documents comparable in bulk, and
// record which way the run went; a length-instructed corpus and an unprompted
// one must never be measured against each other.
const LENGTH = " Around 500 words.";
const USE_LENGTH = argv.includes("--length");
const withLength = (p) => (USE_LENGTH ? p + LENGTH : p);

const VENDOR = arg("vendor", "anthropic");
const V = VENDORS[VENDOR];
if (!V) { console.error(`unknown --vendor ${VENDOR}. Use one of: ${Object.keys(VENDORS).join(", ")}`); process.exit(1); }
const KEY = V.local ? "local" : process.env[V.env];

// An alias like "chat-latest" is the most representative thing to sample,
// because it is what ordinary users are served, and the least reproducible
// thing to publish, because it moves. Vendors report the id they actually ran,
// so capture it and say so rather than recording the alias as if it were a
// model.
let servedModel = null;

// One turn: the conversation is an array with a single user message in it.
// study/reedit.mjs sends the same array with three rounds of history on it.
async function generate(model, prompt) {
  const { text, served } = await chat(V, VENDOR, KEY, model, [{ role: "user", content: prompt }]);
  if (!servedModel) servedModel = served;
  return text;
}

if (!KEY) {
  console.error(`${V.env} is not set. This script calls the ${VENDOR} API; it cannot run without a key.`);
  console.error(`Looked for a .env file at: ${ENV_PATH}`);
  console.error(existsSync(ENV_PATH)
    ? "That file exists, so the line in it is missing, blank, or misspelled. It must read ANTHROPIC_API_KEY=sk-ant-..."
    : "That file does not exist. Copy .env.example to .env and put the key in it.");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
// The manifest is the only record of when a document was made and which model
// actually answered. Until 2026-09-01 it carried neither, so the corpus had no
// date on it at all once the file mtimes were lost to a clone, and the resolved
// model id was printed to the console and thrown away. Both are recorded now.
const MANIFEST_HEAD = "file\tmodel\tserved\tgenre\twords\tdate\tdate_src\tprompt";
const RUN_DATE = new Date().toISOString().slice(0, 10);
if (!existsSync(MANIFEST)) writeFileSync(MANIFEST, MANIFEST_HEAD + "\n");
const already = readFileSync(MANIFEST, "utf8");
{
  const head = already.split("\n", 1)[0].replace(/\r$/, "");
  if (head !== MANIFEST_HEAD) {
    console.error(`\n${MANIFEST} has an older column layout:\n  ${head}`);
    console.error(`Expected:\n  ${MANIFEST_HEAD}`);
    console.error("Migrate it before generating, or the rows will not line up.");
    process.exit(1);
  }
}

// An arm is one model measured once. Adding a second generation to the same
// directory silently averages two things the study exists to tell apart, and
// it has happened: chat-gemini and chat-gpt55 each held an alias run and a
// pinned run before the alias documents were withdrawn on 2026-09-01.
//
// This has to run AFTER the model id is resolved, which is why it is a function
// and not the inline block it started life as. Inline, it read `model` from the
// temporal dead zone of a `let` declared forty lines below and threw
// ReferenceError on every run into a non-empty arm. It shipped that way this
// morning and was never executed until the refactor smoke test hit it.
function warnIfArmMixing(model) {
  const prior = already.split("\n").slice(1).filter((r) => r.trim()).map((r) => r.split("\t"));
  const models = [...new Set(prior.map((c) => c[1]))];
  const dates = [...new Set(prior.map((c) => c[5]).filter(Boolean))];
  if (prior.length && (!models.includes(model) || !dates.includes(RUN_DATE))) {
    console.log(`\n! ${OUT} already holds ${prior.length} document${prior.length === 1 ? "" : "s"}`);
    console.log(`!   model${models.length === 1 ? "" : "s"}: ${models.join(", ")}   date${dates.length === 1 ? "" : "s"}: ${dates.join(", ") || "unrecorded"}`);
    console.log(`!   this run: ${model} on ${RUN_DATE}`);
    console.log("! Adding to an existing arm blends two generations into one measurement.");
    console.log(`! To track a change over time, write a new arm instead:  --out study/corpus/<name>-${RUN_DATE}/\n`);
  }
}

// Everything that is not a general text model. A vendor's model list is mostly
// speech, images, embeddings and coding variants, and burying the four ids that
// matter in a list of a hundred is not help.
const NOT_PROSE = /audio|image|realtime|transcribe|tts|whisper|embedding|moderation|sora|codex|search|dall|babbage|davinci|gpt-3\.5|^o[0-9]|-mini|-nano/i;

let model = arg("model");
if (!model) {
  const ids = await listModels(V, VENDOR, KEY);
  model = V.autoPick(ids);
  if (!model) {
    // Deliberately not guessing. Model names change faster than this file does,
    // and silently picking the wrong one would put a mislabelled corpus into
    // the study, which is worse than stopping.
    const prose = ids.filter((i) => !NOT_PROSE.test(i));
    console.error(`--model is required for ${VENDOR}.\n`);
    console.error(`General text models on your key${argv.includes("--all") ? "" : "  (add --all for every id)"}:\n`);
    console.error((argv.includes("--all") ? ids : prose).map((i) => "  " + i).join("\n"));
    console.error(`\nFor this study, prefer the model that ordinary people actually get:`);
    console.error(`a "-chat-latest" variant is the one behind the consumer chat app, while a`);
    console.error(`plain dated id is pinned and reproducible. Pick one and record it.`);
    // process.exitCode, not process.exit(). Exiting while a long write is still
    // draining trips a libuv assertion on Windows (UV_HANDLE_CLOSING) and can
    // truncate the very list you are trying to read.
    process.exitCode = 1;
  }
}
if (model) {
warnIfArmMixing(model);
console.log(`vendor: ${VENDOR}   model: ${model}`);
console.log(`writing up to ${N_PER_GENRE * SETS.length} documents to ${OUT}\n`);

let made = 0, skipped = 0, failed = 0, fatalStop = false;
const lengths = [];
for (const g of SETS) {
  if (fatalStop) break;
  for (let i = 0; i < Math.min(N_PER_GENRE, g.prompts.length); i++) {
    const name = `${model}__${g.id}__${String(i + 1).padStart(2, "0")}.txt`;
    const path = join(OUT, name);
    if (existsSync(path)) { skipped++; continue; }
    try {
      const sent = withLength(g.prompts[i]);
      const text = await generate(model, sent);
      writeFileSync(path, text.replace(/\r\n/g, "\n") + "\n");
      const words = (text.match(/\S+/g) || []).length;
      if (!already.includes(name)) appendFileSync(MANIFEST, `${name}\t${model}\t${servedModel || ""}\t${g.id}\t${words}\t${RUN_DATE}\trecorded\t${sent}\n`);
      made++;
      lengths.push(words);
      console.log(`  ${name}  ${words} words${words < 250 ? "  (short)" : ""}`);
    } catch (e) {
      if (e instanceof Fatal) {
        console.error(`\nStopping: ${e.message}`);
        console.error(`Nothing further will succeed until that is fixed. ${made} document${made === 1 ? "" : "s"} written before the stop.`);
        process.exitCode = 1;
        fatalStop = true;
        break;
      }
      failed++;
      console.error(`  FAILED ${name}: ${e.message}`);
    }
  }
}

if (servedModel && servedModel !== model) {
  console.log(`\nNote: "${model}" resolved to "${servedModel}".`);
  console.log(`Publish the resolved id, not the alias, and re-run with --model ${servedModel} to pin it.`);
}
// A model that ignores the length request produces a set that cannot be
// compared with one that honours it, and the per-1,000-word rate hides that.
// Say it here rather than leaving it to be noticed in the measurement.
if (lengths.length) {
  const sorted = [...lengths].sort((a, b) => a - b);
  // A real median: for an even count this is the mean of the two middle values.
  // sorted[n >> 1] takes the upper of the two, which reads high on every even
  // sample and put a wrong figure on the site for three weeks.
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const under = lengths.filter((w) => w < 250).length;
  const floor = lengths.filter((w) => w < 100).length;
  console.log(`\nlength: median ${median} words, range ${sorted[0]}-${sorted[sorted.length - 1]}` + (USE_LENGTH ? " (asked for ~500)" : " (no length instruction sent)"));
  if (under) console.log(`  ${under} of ${lengths.length} came back under 250 words`);
  if (floor) console.log(`  ${floor} are under the study's 100-word floor and will be excluded from measurement`);
  if (median < 350) console.log(`  This model is not honouring the length request. Comparing it against a model that does\n  measures the length difference as much as anything else. Try a non-chat model id.`);
}
console.log(`\n${made} written, ${skipped} already present, ${failed} failed.`);
if (made || skipped) console.log(`Next: node study/measure.mjs ${OUT} study/corpus/medium`);
} // end: a model was resolved
