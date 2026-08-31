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
const VERSION = "2023-06-01";

// Thinking tokens bill against max_tokens, and the thinking API itself differs
// between model generations. Send no thinking config and leave generous
// headroom: that combination works on every model this script might pick.
// (Learned the hard way when the weekly refresh died silently on 2026-08-17.)
const MAX_OUTPUT_TOKENS = 4000;

// --mode chat swaps the document genres for conversational turns. The stance
// markers the checker cannot see ("the honest answer", "two things worth
// noting", "I'd push back") belong to the register where a model explains or
// advises a person, and the 2026-08-27 pilot found ritual pushback at 0.00
// across all 116,353 words of the document corpora. That was the instrument
// failing to reach the register, not a finding about pushback. This mode is
// the corpus that can answer the question.
const MODE = arg("mode", "docs");
if (!["docs", "chat"].includes(MODE)) { console.error(`--mode must be docs or chat`); process.exit(1); }

const N_PER_GENRE = Number(arg("n", 5));

// Genres chosen to match what humansounding.com's visitors actually paste:
// workplace and marketing prose written by non-writers under time pressure.
const GENRES = [
  {
    id: "linkedin",
    prompts: [
      "Write a LinkedIn post about why our team switched to a four-day week.",
      "Write a LinkedIn post announcing that I've been promoted to director of operations.",
      "Write a LinkedIn post about what I learned from a project that failed.",
      "Write a LinkedIn post about hiring for attitude over experience.",
      "Write a LinkedIn post about attending my first industry conference in five years.",
      "Write a LinkedIn post about why small businesses should care about cybersecurity.",
      "Write a LinkedIn post about mentoring a junior colleague.",
      "Write a LinkedIn post about leaving a job I loved.",
    ],
  },
  {
    id: "cover_letter",
    prompts: [
      "Write a cover letter for an operations manager job at a logistics company.",
      "Write a cover letter for a marketing coordinator role at a nonprofit.",
      "Write a cover letter for a junior software developer position.",
      "Write a cover letter for a school administrator job.",
      "Write a cover letter for an accounting role at a mid-sized manufacturer.",
      "Write a cover letter for a customer success manager position at a SaaS company.",
      "Write a cover letter for a nursing supervisor role at a regional hospital.",
      "Write a cover letter for a project manager role in construction.",
    ],
  },
  {
    id: "newsletter",
    prompts: [
      "Write a newsletter issue about how to build a morning routine that sticks.",
      "Write a newsletter issue about managing money in your twenties.",
      "Write a newsletter issue about why most productivity systems fail.",
      "Write a newsletter issue about dealing with burnout at work.",
      "Write a newsletter issue about the psychology of habit change.",
      "Write a newsletter issue about how to have difficult conversations.",
      "Write a newsletter issue about sleep and performance.",
      "Write a newsletter issue about what anger is actually telling you.",
    ],
  },
  {
    id: "marketing_email",
    prompts: [
      "Write a marketing email announcing a new feature in our project management app.",
      "Write a marketing email for a local gym's January membership offer.",
      "Write a marketing email inviting customers to a webinar on tax changes.",
      "Write a marketing email re-engaging customers who haven't logged in for 90 days.",
      "Write a marketing email launching a new line of running shoes.",
      "Write a marketing email for an accounting firm offering year-end planning.",
      "Write a marketing email announcing a price change to existing subscribers.",
      "Write a marketing email promoting an online course on public speaking.",
    ],
  },
  {
    id: "blog_post",
    prompts: [
      "Write a blog post about choosing a password manager.",
      "Write a blog post about remote work and company culture.",
      "Write a blog post about how to run a better meeting.",
      "Write a blog post about what to look for when buying a used car.",
      "Write a blog post about the basics of home network security.",
      "Write a blog post about switching careers in your forties.",
      "Write a blog post about why customer feedback is hard to act on.",
      "Write a blog post about starting a vegetable garden.",
    ],
  },
  {
    id: "internal_memo",
    prompts: [
      "Write a memo to staff announcing a new expense policy.",
      "Write a memo to staff about returning to the office three days a week.",
      "Write a memo announcing a reorganization of the customer service team.",
      "Write a memo to staff about a new mandatory security training.",
      "Write a memo explaining changes to the annual review process.",
      "Write a memo announcing that the company has been acquired.",
      "Write a memo to staff about reducing travel spending this quarter.",
      "Write a memo introducing a new director of engineering to the company.",
    ],
  },
  {
    id: "product_update",
    prompts: [
      "Write a product update announcing a redesigned dashboard.",
      "Write a product update explaining that we're sunsetting an old integration.",
      "Write a product update about improved mobile performance.",
      "Write a product update announcing single sign-on support.",
      "Write a product update about a new reporting feature.",
      "Write a product update apologizing for last week's outage.",
      "Write a product update announcing our new pricing tiers.",
      "Write a product update about accessibility improvements.",
    ],
  },
  {
    id: "recommendation",
    prompts: [
      "Write a letter of recommendation for a student applying to graduate school.",
      "Write a letter of recommendation for an employee applying for an internal promotion.",
      "Write a performance review for a sales rep who exceeded quota but struggled with paperwork.",
      "Write a performance review for a developer who is technically strong and hard to work with.",
      "Write a letter of recommendation for a colleague applying for a board seat.",
      "Write a performance review for a first-year employee who improved steadily.",
      "Write a letter of recommendation for a teacher applying for a principal role.",
      "Write a performance review for a manager whose team has high turnover.",
    ],
  },
];

// Conversational turns. Same rule as the document prompts and it matters more
// here: nothing mentions style, tone, structure, length or thinking out loud.
// These are ordinary requests of the kind a person types into a chat box, and
// what is being measured is what the model volunteers when nobody asked it to
// perform carefulness. Prompts that said "explain your reasoning" would plant
// the very behaviour under test.
const CHAT_GENRES = [
  { id: "decision", prompts: [
    "Should I use Postgres or MongoDB for a booking system with about 50,000 records?",
    "We're deciding between hiring a second developer or paying for more contractors. Which way should we go?",
    "Should I take a 15% pay cut for a fully remote job?",
    "Is it worth moving our small office to a four-day week?",
    "Should we rebuild our ten-year-old internal tool or keep patching it?",
    "Do I renew a three-year software contract at a discount or go year to year?",
    "Should a two-person company bother with formal performance reviews?",
    "Is it a mistake to launch a product without a pricing page?",
  ]},
  { id: "critique_plan", prompts: [
    "Here's my plan for migrating 400 users to a new email system over one weekend. What am I missing?",
    "My plan is to run ads for six weeks, measure signups, and decide from there. Poke holes in it.",
    "I want to teach myself data analysis in three months by doing one project a week. Thoughts?",
    "We're going to fix our support backlog by hiring two temps for a month. What could go wrong?",
    "My plan for the quarter is to cut meetings by half and see what breaks. Reactions?",
    "I want to move our backups from an external drive to cloud storage and stop the drive rotation. Sound right?",
    "We plan to open a second location once the first one clears 20% margin. Is that the right trigger?",
    "I'm going to reply to every customer review personally for a year. Talk me through it.",
  ]},
  { id: "explain", prompts: [
    "Explain how DNS actually resolves a domain name.",
    "Explain what a p-value is to someone who never took statistics.",
    "Explain why software estimates are always wrong.",
    "Explain how compound interest works and why it surprises people.",
    "Explain the difference between encryption and hashing.",
    "Explain what happens to my data when a company says it was breached.",
    "Explain why airlines overbook flights.",
    "Explain how a bill becomes law in the United States.",
  ]},
  { id: "diagnose", prompts: [
    "Our website is slow every weekday at 9am and fine the rest of the day. Where do I start?",
    "Two of my team members stopped talking to each other and the work is suffering. What now?",
    "My laptop battery went from a full day to three hours in about a month. What's happening?",
    "Signups are steady but activation dropped 30% last month. How do I find the cause?",
    "Customers keep asking questions our documentation already answers. Why?",
    "Our weekly meeting always runs over and nobody remembers what was decided. Diagnose it.",
    "I keep missing deadlines even though I'm working more hours than ever. What's going on?",
    "Sales says the product is fine and support says it's broken. Who do I believe?",
  ]},
  { id: "compare", prompts: [
    "What's the difference between a VPN and a proxy, practically speaking?",
    "Compare renting and buying a home for someone who moves every four years.",
    "What's the real difference between a CFO and a controller?",
    "Compare index funds and individual stocks for a first-time investor.",
    "How do a co-op and a condo actually differ for the owner?",
    "Compare an electric car and a hybrid for someone who drives 12,000 miles a year.",
    "What's the difference between a trademark and a copyright for a small brand?",
    "Compare an in-house help desk with an outsourced one for a 60-person company.",
  ]},
  { id: "review_work", prompts: [
    "Read this and tell me if it's any good: 'Our mission is to empower businesses to unlock their full potential through innovative solutions.'",
    "Is this a good subject line? 'Quick question about your account'",
    "Here's my resume summary: 'Results-driven professional with 10+ years of experience.' Fix it or tell me why it's fine.",
    "I wrote this to a client: 'Sorry for the delay, things have been crazy here.' Should I send it?",
    "My about page opens with 'Founded in 2019, we are a team of passionate experts.' Thoughts?",
    "Is 'circle back' an acceptable thing to write in a work email?",
    "My pitch is 'Uber but for dog walking.' What's wrong with that as a description?",
    "I named my product 'Synergize.' Be straight with me.",
  ]},
  { id: "personal", prompts: [
    "I got an offer from a competitor and my current boss just asked me directly if I'm interviewing. What do I say?",
    "My friend asked me to invest in her business and I don't think it will work. How do I answer?",
    "I've been in the same job for eleven years and I can't tell if that's stability or being stuck.",
    "My neighbor's tree drops branches in my yard every storm. How do I raise it without starting a feud?",
    "I said yes to organizing the family reunion and now I regret it. What are my options?",
    "A colleague takes credit for my work in meetings. What do I actually do about it?",
    "I want to go back to school at 41 and everyone thinks it's a bad idea.",
    "My adult son wants to move back home and I'm not sure I want that.",
  ]},
  { id: "evaluate_claim", prompts: [
    "Someone told me you should never pay off a low-interest mortgage early. Is that right?",
    "My coworker says standing desks don't actually do anything. True?",
    "Is it true that you shouldn't put a hot laptop battery in the fridge?",
    "A vendor claims their tool will cut our onboarding time in half. How should I read that?",
    "I read that most startups fail because of cofounder conflict. Does that hold up?",
    "Someone said breakfast being the most important meal was invented by cereal companies. Is it?",
    "My IT guy says password rotation every 90 days is outdated advice. Is he right?",
    "A consultant told us our website needs a full rebuild, not a redesign. How do I judge that?",
  ]},
];

const SETS = MODE === "chat" ? CHAT_GENRES : GENRES;

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

const VENDORS = {
  anthropic: {
    env: "ANTHROPIC_API_KEY",
    listUrl: () => "https://api.anthropic.com/v1/models?limit=40",
    listHeaders: (k) => ({ "x-api-key": k, "anthropic-version": VERSION }),
    listIds: (d) => (d.data || []).map((x) => x.id),
    // Anthropic ids sort newest-first from the API, and the family is
    // unambiguous, so this one can pick for itself.
    autoPick: (ids) => ids.filter((id) => /^claude/.test(id))[0],
    url: () => "https://api.anthropic.com/v1/messages",
    headers: (k) => ({ "x-api-key": k, "anthropic-version": VERSION, "content-type": "application/json" }),
    // max_tokens is required here. Elsewhere no cap is sent at all: the field
    // name for it has diverged between vendors and between model generations,
    // and a request field that only some models accept is exactly what broke
    // the weekly refresh on 2026-08-17. The length instruction is in the prompt.
    body: (model, prompt) => ({ model, max_tokens: MAX_OUTPUT_TOKENS, messages: [{ role: "user", content: prompt }] }),
    text: (d) => (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n"),
    served: (d) => d.model,
    why: (d) => `stop_reason=${d.stop_reason}`,
  },
  openai: {
    env: "OPENAI_API_KEY",
    listUrl: () => "https://api.openai.com/v1/models",
    listHeaders: (k) => ({ authorization: `Bearer ${k}` }),
    listIds: (d) => (d.data || []).map((x) => x.id).sort(),
    autoPick: () => null,
    url: () => "https://api.openai.com/v1/chat/completions",
    headers: (k) => ({ authorization: `Bearer ${k}`, "content-type": "application/json" }),
    body: (model, prompt) => ({ model, messages: [{ role: "user", content: prompt }] }),
    text: (d) => (d.choices || []).map((c) => c.message?.content || "").join("\n"),
    served: (d) => d.model,
    why: (d) => `finish_reason=${d.choices?.[0]?.finish_reason}`,
  },
  gemini: {
    env: "GEMINI_API_KEY",
    listUrl: (k) => `https://generativelanguage.googleapis.com/v1beta/models?key=${k}`,
    listHeaders: () => ({}),
    listIds: (d) => (d.models || []).map((m) => m.name.replace(/^models\//, "")).sort(),
    autoPick: () => null,
    url: (k, model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${k}`,
    headers: () => ({ "content-type": "application/json" }),
    body: (model, prompt) => ({ contents: [{ parts: [{ text: prompt }] }] }),
    text: (d) => (d.candidates || []).flatMap((c) => (c.content?.parts || []).map((p) => p.text || "")).join("\n"),
    served: (d) => d.modelVersion,
    why: (d) => `finishReason=${d.candidates?.[0]?.finishReason}`,
  },
};

const VENDOR = arg("vendor", "anthropic");
const V = VENDORS[VENDOR];
if (!V) { console.error(`unknown --vendor ${VENDOR}. Use one of: ${Object.keys(VENDORS).join(", ")}`); process.exit(1); }
const KEY = process.env[V.env];

// Some failures will never fix themselves by trying again: a missing key, a
// revoked key, an account with no credit on it. Those abort the whole run.
// Others are transient: a per-minute rate limit, a 5xx. Those get a few backed
// off retries. The first version of this did neither and fired 39 more doomed
// requests after the first one came back saying the balance was zero.
class Fatal extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(url, opts = {}, attempt = 0) {
  const r = await fetch(url, opts);
  const body = await r.text();
  if (r.ok) return JSON.parse(body);

  const fatal =
    r.status === 401 || r.status === 403 ||
    /insufficient_quota|billing_not_active|invalid_api_key|account_deactivated|API_KEY_INVALID|PERMISSION_DENIED/i.test(body);
  if (fatal) {
    let hint = "";
    if (/insufficient_quota|billing/i.test(body)) {
      hint = VENDOR === "openai"
        ? "\n  Add credit at https://platform.openai.com/settings/organization/billing — API billing is separate from ChatGPT."
        : "\n  This account has no usable balance for the API.";
    } else if (r.status === 401 || /invalid_api_key|API_KEY_INVALID/i.test(body)) {
      hint = `\n  Check ${V.env} in .env. The key is shown once at creation and cannot be read back.`;
    }
    throw new Fatal(`${r.status} from ${VENDOR}: ${(JSON.parse(body)?.error?.message || body).toString().slice(0, 200)}${hint}`);
  }

  // Transient. Honour Retry-After when the vendor sends one.
  if ((r.status === 429 || r.status >= 500) && attempt < 3) {
    const wait = Number(r.headers.get("retry-after")) * 1000 || 2000 * Math.pow(2, attempt);
    console.log(`  ${r.status}, retrying in ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return req(url, opts, attempt + 1);
  }
  throw new Error(`${r.status}: ${body.slice(0, 300)}`);
}

async function listModels() {
  return V.listIds(await req(V.listUrl(KEY), { headers: V.listHeaders(KEY) }));
}

// An alias like "chat-latest" is the most representative thing to sample,
// because it is what ordinary users are served, and the least reproducible
// thing to publish, because it moves. Vendors report the id they actually ran,
// so capture it and say so rather than recording the alias as if it were a
// model.
let servedModel = null;

async function generate(model, prompt) {
  const d = await req(V.url(KEY, model), {
    method: "POST",
    headers: V.headers(KEY),
    body: JSON.stringify(V.body(model, prompt)),
  });
  if (!servedModel && V.served) servedModel = V.served(d) || null;
  const text = (V.text(d) || "").trim();
  if (!text) throw new Error(`empty response (${V.why(d)})`);
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
if (!existsSync(MANIFEST)) writeFileSync(MANIFEST, "file\tmodel\tgenre\twords\tprompt\n");
const already = readFileSync(MANIFEST, "utf8");

// Everything that is not a general text model. A vendor's model list is mostly
// speech, images, embeddings and coding variants, and burying the four ids that
// matter in a list of a hundred is not help.
const NOT_PROSE = /audio|image|realtime|transcribe|tts|whisper|embedding|moderation|sora|codex|search|dall|babbage|davinci|gpt-3\.5|^o[0-9]|-mini|-nano/i;

let model = arg("model");
if (!model) {
  const ids = await listModels();
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
      if (!already.includes(name)) appendFileSync(MANIFEST, `${name}\t${model}\t${g.id}\t${words}\t${sent}\n`);
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
