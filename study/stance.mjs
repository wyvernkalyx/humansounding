// HumanSounding stance-marker measurement.
//
// Tests a structural tell none of the checker's fifteen rules can see: prose
// that narrates the epistemic status of its own sentences. "The honest answer."
// "The uncomfortable part." "The key distinction." "Two things worth noting."
// Described by a Reddit commenter in August 2026 as the thing that makes Claude
// recognizable once you have seen enough of it.
//
// KNOWN CONFOUND, read before quoting any number from this script. The AI arms
// of this corpus are workplace and marketing documents: LinkedIn posts, cover
// letters, memos, product updates. Stance marking is a feature of the
// conversational register, where a model is explaining or advising a person.
// A generated cover letter has no reason to narrate its own reasoning. So a
// flat result here is weak evidence that the tell does not exist, and strong
// evidence only that it does not appear in this genre. Measuring it properly
// needs a corpus of assistant replies, which this study does not have.
//
// Usage:
//   node study/stance.mjs study/corpus/ai study/corpus/medium ...

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";

const BOOTSTRAP = 2000;
const MIN_DOCS = 20; // below this, rates print but no verdict is offered

const RULES = [
  { id: "epistemic_frame", label: "Epistemic self-narration",
    re: /\b(?:the honest (?:answer|truth|read|version)|to be honest|the (?:uncomfortable|awkward|hard|tricky|interesting|important|useful) (?:part|truth|bit|thing)|the (?:key|real) (?:distinction|question|point|insight|issue|problem)|what(?:'s| is) actually (?:happening|going on)|worth noting|here(?:'s| is) the thing|what matters here|the thing is)\b/gi },
  { id: "structural_metaphor", label: "Structural-importance metaphor",
    re: /\b(?:load[- ]bearing|smoking gun|the crux|heavy lifting|linchpin)\b/gi },
  { id: "discretized_count", label: "Discretized problem count",
    re: /\b(?:two|three|four|a few|several)\s+(?:things|reasons|caveats|problems|points|questions|issues|takeaways|observations)\b/gi },
  { id: "ritual_pushback", label: "Ritual pushback",
    re: /\b(?:I(?:'d| would) push back|where I(?:'d| would) push back|to be fair|that said,|the one thing I(?:'d| would)|I(?:'m| am) not convinced|fair enough)\b/gi },
];

function straighten(s) {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

function docsIn(dir) {
  const seen = new Set(); const out = []; let short = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".txt")).sort()) {
    const text = readFileSync(join(dir, f), "utf8");
    if ((text.match(/\S+/g) || []).length < 100) { short++; continue; }
    const key = createHash("sha1").update(text.replace(/\s+/g, " ").trim().toLowerCase()).digest("hex");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: basename(f, ".txt"), text });
  }
  if (short) console.log(`  ! ${short} file(s) under 100 words, excluded`);
  return out;
}

function measureDoc(raw) {
  const text = straighten(raw);
  const words = (text.match(/\S+/g) || []).length;
  const counts = {};
  for (const r of RULES) { r.re.lastIndex = 0; counts[r.id] = (text.match(r.re) || []).length; }
  counts.any = RULES.reduce((a, r) => a + counts[r.id], 0);
  return { words, counts, hits: RULES.flatMap((r) => (text.match(r.re) || []).map((m) => [r.id, m])) };
}

function rateWithCI(docs, id) {
  const per = docs.map((d) => ({ n: d.counts[id] || 0, w: d.words }));
  const point = (per.reduce((a, p) => a + p.n, 0) / per.reduce((a, p) => a + p.w, 0)) * 1000;
  const s = [];
  for (let b = 0; b < BOOTSTRAP; b++) {
    let n = 0, w = 0;
    for (let i = 0; i < per.length; i++) { const p = per[(Math.random() * per.length) | 0]; n += p.n; w += p.w; }
    s.push(w ? (n / w) * 1000 : 0);
  }
  s.sort((a, b) => a - b);
  return { rate: point, lo: s[Math.floor(BOOTSTRAP * 0.025)], hi: s[Math.floor(BOOTSTRAP * 0.975)] };
}

const dirs = process.argv.slice(2);
if (!dirs.length) { console.error("usage: node study/stance.mjs <corpus dir> [...]"); process.exit(1); }

const sets = [];
for (const d of dirs) {
  if (!existsSync(d)) { console.error(`missing: ${d}`); process.exit(1); }
  console.log(`Reading ${d}`);
  const docs = docsIn(d).map((x) => ({ ...x, ...measureDoc(x.text) }));
  sets.push({ name: basename(d), docs, words: docs.reduce((a, x) => a + x.words, 0) });
}

console.log("\nRate per 1,000 words. [95% bootstrap CI over documents]\n");
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("rule", 30) + sets.map((s) => pad(s.name, 22)).join(""));
for (const r of [...RULES, { id: "any", label: "ANY stance marker" }]) {
  let line = pad(r.label, 30);
  for (const s of sets) {
    const { rate, lo, hi } = rateWithCI(s.docs, r.id);
    line += pad(`${rate.toFixed(2)} [${lo.toFixed(2)}-${hi.toFixed(2)}]`, 22);
  }
  console.log(line);
}
console.log("\n" + pad("documents", 30) + sets.map((s) => pad(s.docs.length, 22)).join(""));
console.log(pad("words", 30) + sets.map((s) => pad(s.words.toLocaleString(), 22)).join(""));
for (const s of sets) if (s.docs.length < MIN_DOCS) console.log(`! ${s.name}: ${s.docs.length} docs, below the ${MIN_DOCS}-document floor; no verdict.`);

console.log("\nActual matches, so you can audit the regexes:");
for (const s of sets) {
  const all = s.docs.flatMap((d) => d.hits);
  console.log(`  ${s.name}: ${all.length} hit(s)` + (all.length ? " -> " + [...new Set(all.map((h) => h[1].toLowerCase()))].slice(0, 12).join(" | ") : ""));
}
console.log("\nRead the confound note at the top of this file before quoting any of it.");
