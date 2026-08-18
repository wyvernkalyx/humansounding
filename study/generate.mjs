#!/usr/bin/env node
// HumanSounding corpus generator: the AI arm.
//
// Writes one plain-text document per file into study/corpus/ai/, plus a
// MANIFEST.tsv recording the exact model, prompt and word count behind every
// file. Nothing about a document is inferred later; if it is not in the
// manifest it is not in the study.
//
//   ANTHROPIC_API_KEY=... node study/generate.mjs --n 6
//   ANTHROPIC_API_KEY=... node study/generate.mjs --n 6 --model claude-sonnet-5
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
import { loadEnv } from "../scripts/load-env.mjs";

loadEnv();

const OUT = new URL("./corpus/ai/", import.meta.url).pathname;
const MANIFEST = join(OUT, "MANIFEST.tsv");
const KEY = process.env.ANTHROPIC_API_KEY;
const VERSION = "2023-06-01";

// Thinking tokens bill against max_tokens, and the thinking API itself differs
// between model generations. Send no thinking config and leave generous
// headroom: that combination works on every model this script might pick.
// (Learned the hard way when the weekly refresh died silently on 2026-08-17.)
const MAX_OUTPUT_TOKENS = 4000;

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? dflt : argv[i + 1];
};
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

// Length is specified because unprompted length varies wildly and would make
// the per-1,000-word rate noisier than the effect being measured. Length is a
// format instruction, not a style instruction.
const LENGTH = " Around 500 words.";

async function api(path, opts = {}) {
  const r = await fetch("https://api.anthropic.com" + path, {
    ...opts,
    headers: { "x-api-key": KEY, "anthropic-version": VERSION, "content-type": "application/json", ...(opts.headers || {}) },
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${body.slice(0, 400)}`);
  return JSON.parse(body);
}

async function newestModel() {
  const d = await api("/v1/models?limit=20");
  const m = (d.data || []).filter((x) => /claude/.test(x.id))[0];
  if (!m) throw new Error("no models returned");
  return m.id;
}

async function generate(model, prompt) {
  const d = await api("/v1/messages", {
    method: "POST",
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: prompt + LENGTH }],
    }),
  });
  const text = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  if (!text) throw new Error(`empty response (stop_reason=${d.stop_reason})`);
  return text;
}

if (!KEY) {
  console.error("ANTHROPIC_API_KEY is not set. This script calls the API; it cannot run without one.");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
if (!existsSync(MANIFEST)) writeFileSync(MANIFEST, "file\tmodel\tgenre\twords\tprompt\n");
const already = readFileSync(MANIFEST, "utf8");

const model = arg("model") || (await newestModel());
console.log(`model: ${model}`);
console.log(`writing up to ${N_PER_GENRE * GENRES.length} documents to ${OUT}\n`);

let made = 0, skipped = 0, failed = 0;
for (const g of GENRES) {
  for (let i = 0; i < Math.min(N_PER_GENRE, g.prompts.length); i++) {
    const name = `${model}__${g.id}__${String(i + 1).padStart(2, "0")}.txt`;
    const path = join(OUT, name);
    if (existsSync(path)) { skipped++; continue; }
    try {
      const text = await generate(model, g.prompts[i]);
      writeFileSync(path, text.replace(/\r\n/g, "\n") + "\n");
      const words = (text.match(/\S+/g) || []).length;
      if (!already.includes(name)) appendFileSync(MANIFEST, `${name}\t${model}\t${g.id}\t${words}\t${g.prompts[i]}\n`);
      made++;
      console.log(`  ${name}  ${words} words`);
    } catch (e) {
      failed++;
      console.error(`  FAILED ${name}: ${e.message}`);
    }
  }
}

console.log(`\n${made} written, ${skipped} already present, ${failed} failed.`);
if (made || skipped) console.log(`Next: node study/measure.mjs study/corpus/ai study/corpus/human`);
