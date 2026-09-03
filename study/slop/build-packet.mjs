#!/usr/bin/env node
// Builds the blind labelling packet for the slop experiment. 2026-09-02.
// Same protocol as study/reedit/2026-09-01: passages inline, seeded shuffle,
// no filenames in front of the labeller, key withheld until labels are locked.
//
//   node study/slop/build-packet.mjs
//
// Re-running with the same seed reproduces the same packet exactly.

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const CORPUS = join(here, "..", "corpus");
const SEED = 20260902;
const MINW = 500, MAXW = 1300;   // upper bound tightened from the prereg's 2000
const PER = {                     // arm -> how many, and what authorship it means
  human:          { n: 6,  authorship: "human" },
  newsletter:     { n: 5,  authorship: "human" },
  medium:         { n: 4,  authorship: "human" },
  ai:             { n: 3,  authorship: "ai" },
  "ai-gemini":    { n: 3,  authorship: "ai" },
  "ai-openai":    { n: 3,  authorship: "ai" },
  "ai-openai-55": { n: 3,  authorship: "ai" },
  "ai-2026-09-01":{ n: 3,  authorship: "ai" },
};

function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const rand = mulberry32(SEED);
const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=(rand()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];} return a; };
const words = (t) => (t.match(/\S+/g) || []).length;

const picked = [];
for (const [arm, spec] of Object.entries(PER)) {
  const dir = join(CORPUS, arm);
  if (!existsSync(dir)) { console.error(`! missing arm ${arm}`); continue; }
  const cands = readdirSync(dir).filter((f) => f.endsWith(".txt"))
    .map((f) => ({ arm, file: f, text: readFileSync(join(dir, f), "utf8"), authorship: spec.authorship }))
    .filter((d) => { const w = words(d.text); return w >= MINW && w <= MAXW; });
  const take = shuffle(cands).slice(0, spec.n);
  if (take.length < spec.n) console.error(`! ${arm}: only ${take.length} of ${spec.n} available in the ${MINW}-${MAXW} band`);
  picked.push(...take);
}

const order = shuffle(picked);
const N = order.length;

const rubric = `Label each passage SLOP or GOOD. Your judgement of the writing, not a
guess at who or what wrote it.

There is no rubric for this on purpose. "Slop" is the thing you already
recognise: prose that occupies space without carrying anything. If you find
yourself wanting a definition, the working one is -- would you have been
better off not reading it.

A few notes that matter for the experiment:

  * Judge the WRITING, not the SUBJECT. A dull topic handled competently is
    GOOD. An interesting topic handled emptily is SLOP.

  * Do not try to guess authorship. Some of these are AI-written and some are
    human-written and the mix is deliberately not what you would expect. If
    you catch yourself labelling something slop BECAUSE it feels like AI,
    that is the bias this design exists to defeat -- label the prose.

  * Low confidence is a real answer. Use it. A forced call on a passage you
    are unsure about is worse data than an honest "low".

  * In the notes column, flag any passage you are calling SLOP that is
    nonetheless COMPETENTLY WRITTEN -- fluent, clean, and still empty. Write
    the word "competent" in the notes. Those are the hard cases and they
    decide whether any of this generalises past the obvious ones.

  * Some passages are short, casual, or fragmentary. That is the corpus, not
    a trick. Judge them as they are.

Fill in SLOP-LABELS.tsv, matched by passage number. Do not open SLOP-KEY.tsv
until every row is filled -- the key names the source, and the source names
the authorship.

${N} passages, ${order.reduce((s,d)=>s+words(d.text),0).toLocaleString()} words total.
`;

let out = rubric;
order.forEach((d, i) => {
  out += `\n${"=".repeat(70)}\nPASSAGE ${i + 1} of ${N}   (${words(d.text)} words)\n${"=".repeat(70)}\n\n${d.text.trim()}\n`;
});

writeFileSync(join(here, "SLOP-READ-THIS.txt"), out);
writeFileSync(join(here, "SLOP-LABELS.tsv"),
  "n\tlabel\tconfidence\tnotes\n" + order.map((_, i) => `${i + 1}\t\t\t`).join("\n") + "\n");
writeFileSync(join(here, "SLOP-KEY.tsv"),
  "n\tfile\tarm\tauthorship\twords\n" + order.map((d, i) => `${i + 1}\t${d.file}\t${d.arm}\t${d.authorship}\t${words(d.text)}`).join("\n") + "\n");

const h = order.filter((d) => d.authorship === "human").length;
console.log(`packet built: ${N} passages, ${h} human-authored, ${N - h} ai-authored`);
console.log(`words: ${order.reduce((s,d)=>s+words(d.text),0).toLocaleString()}  |  seed ${SEED}`);
console.log(`  SLOP-READ-THIS.txt   <- read this`);
console.log(`  SLOP-LABELS.tsv      <- fill this in`);
console.log(`  SLOP-KEY.tsv         <- do not open until labels are locked`);
