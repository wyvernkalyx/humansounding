#!/usr/bin/env node
// study/perceived/fixture/gen.mjs — synthetic judgments with a KNOWN truth, so
// the guard, the bootstrap and D2 can be checked against an answer we set.
//
//   SKILL=0.55 SLOPE=0.0  node study/perceived/fixture/gen.mjs   # flat reader
//   SKILL=0.45 SLOPE=0.3  node study/perceived/fixture/gen.mjs   # effort helps
//   SKILL=0.65 SLOPE=-0.3 node study/perceived/fixture/gen.mjs   # effort hurts
//   PER=4 ...                                                    # under-floor
//
// SKILL is accuracy for the fastest reader; SLOPE is how much accuracy moves
// across the full log-time range. D2 recovers roughly 0.7 * SLOPE, because the
// quartile medians do not span the whole range — check the DIRECTION and that
// the magnitude is in the right neighbourhood, not an exact figure.
//
// Seeded, so two runs with the same knobs give the same fixture.
import { writeFileSync } from "node:fs";

const SKILL = Number(process.env.SKILL ?? 0.55);
const SLOPE = Number(process.env.SLOPE ?? 0.0);
const PER   = Number(process.env.PER ?? 8);        // judgments per passage
let s = 12345;
const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const passages = [], judgments = [];
for (let i = 0; i < 120; i++) {
  const arm = i % 2 ? "model" : "human";
  passages.push({
    token: `t${i}`, packet_id: i, arm,
    stratum: arm === "human" ? (i % 4 < 2 ? "blog_2004" : "substack_2017_22") : "model",
    genre: i % 3 === 0 ? "blog_2004" : "newsletter_2021",
    words: 150, active: true,
  });
}
let id = 0;
for (let k = 0; k < PER; k++) for (const p of passages) {
  const ms = Math.round(3000 * Math.pow(100, rnd()));          // 3s .. 300s, log-uniform
  const frac = Math.log(ms / 3000) / Math.log(100);            // 0 fastest .. 1 slowest
  const acc = Math.min(0.99, Math.max(0.01, SKILL + SLOPE * frac));
  const right = rnd() < acc;
  judgments.push({
    token: p.token,
    judgment: right ? (p.arm === "model" ? "ai" : "human") : (p.arm === "model" ? "human" : "ai"),
    reason: ["word_choice", "rhythm", "structure", "mentioned", "gut"][id % 5],
    response_ms: ms, session_id: `s${id % 200}`, ordinal: (k % 10) + 1,
    collected_on: `2026-10-${String((id % 28) + 1).padStart(2, "0")}`,
    created_at: new Date(Date.UTC(2026, 9, 1) + id * 1000).toISOString(), id,
  });
  id++;
}
const here = new URL(".", import.meta.url).pathname;
writeFileSync(here + "passages.json", JSON.stringify(passages));
writeFileSync(here + "judgments.json", JSON.stringify(judgments));
console.error(`fixture: ${passages.length} passages, ${judgments.length} judgments, SKILL=${SKILL} SLOPE=${SLOPE}`);
