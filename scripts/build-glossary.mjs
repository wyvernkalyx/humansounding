#!/usr/bin/env node
// Builds the tells glossary, the public rules.json, and the measured snapshot
// the staleness check reads. Everything here is generated. Nothing about a rule
// is typed twice: the definitions come out of checker.html and the numbers come
// out of the same measurement the study publishes, so the page cannot drift
// away from the tool it describes.
//
//   node scripts/build-glossary.mjs
//
// Writes:  ai-writing-tells.html   the page
//          rules.json              machine-readable rules, for anyone to cite
//          study/rates.json        measured rates, also read by check-staleness

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKER = join(ROOT, "checker.html");
const CORPUS = join(ROOT, "study", "corpus");

// arm directory -> how it is named to a reader, and whether it is a human set.
//
// Every model label carries the month it was sampled, because a rate without a
// date is a claim about a moving target. Corrected 2026-09-01: the Gemini arm
// was labelled "Gemini 3.7 Flash" and its manifest records only the floating
// alias gemini-flash-latest, so the version was never evidenced. The label now
// says what the record supports. See study/corpus/*/MANIFEST.tsv for the model
// id, the generation date, and (from 2026-09-01) the id that actually served.
const ARMS = [
  ["ai",            "Claude Opus 5, Aug 2026",  false],
  ["ai-openai-55",  "GPT-5.5, Aug 2026",        false],
  ["ai-openai",     "ChatGPT, Aug 2026",        false],
  ["ai-gemini",     "Gemini Flash, Aug 2026",   false],
  ["medium",        "Human, Medium articles",   true ],
  ["newsletter",    "Human, newsletters",       true ],
];

function loadRules() {
  const src = readFileSync(CHECKER, "utf8");
  const m = src.match(/const RULES = \[[\s\S]*?\n\];/);
  if (!m) throw new Error("Could not find RULES in checker.html");
  const rules = eval(m[0].replace(/^const RULES = /, ""));
  // The em-dash rule is built separately in the checker because its threshold
  // depends on document length. The study measures raw density, so it is added
  // here by hand with the same id the measurement uses.
  const emFix = (src.match(/fix: `\$\{dashes\.length\}[^`]*`/) || [""])[0]
    // Strip the runtime sentence, not "up to the first period": the first period
    // in this template is inside ${dashes.length}, which shipped a rules.json
    // guidance string beginning "length} em dash${dashes.length === 1...".
    .replace(/^fix: `.*?\$\{words\} words\.\s*/s, "").replace(/`$/, "");
  return [
    ...rules.map((r) => ({ id: r.id, label: r.label, sev: r.sev, fix: r.fix, source: String(r.re) })),
    { id: "em_dash", label: "Em-dash density", sev: 2, fix: emFix, source: "/—|(?<!-)--(?!-)/g" },
  ];
}

function measure(dirs, extra = []) {
  const r = spawnSync("node", [join(ROOT, "study", "measure.mjs"), ...dirs, ...extra],
                      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) { console.error(r.stderr || r.stdout); throw new Error("measure.mjs failed"); }
  const last = r.stdout.trim().split("\n").pop();
  return JSON.parse(last);
}

// A verdict has to be computed, never written, or it becomes another number
// nobody re-checks. Two guards matter more than the thresholds. A rule needs a
// real absolute rate before it gets called a habit, because one hit in twenty
// thousand words is noise wearing a decimal point. And a claim of separation
// has to clear the confidence intervals, not the point estimates.
function verdict(rates, cis, arms) {
  const models = arms.filter((a) => !a.human);
  const humans = arms.filter((a) => a.human);
  const at = (a) => rates[a.key] ?? 0;
  const lo = (a) => (cis[a.key] || [0, 0])[0];
  const hi = (a) => (cis[a.key] || [0, 0])[1];
  const maxModel = Math.max(...models.map(at), 0);
  const maxHuman = Math.max(...humans.map(at), 0);
  const hits = (a) => Math.round(at(a) * (a.words || 0) / 1000);
  const totalHits = arms.reduce((n, a) => n + hits(a), 0);
  const totalWords = arms.reduce((n, a) => n + (a.words || 0), 0);

  if (totalHits === 0)
    return { kind: "silent", text: `Fired zero times across ${totalWords.toLocaleString()} words. Widely cited, not measurable here.` };

  if (maxModel < 0.20)
    return { kind: "rare", text: `Too rare to characterize: ${totalHits} hit${totalHits === 1 ? "" : "s"} in ${totalWords.toLocaleString()} words across every corpus.` };

  const ranked = models.slice().sort((a, b) => at(b) - at(a));
  const top = ranked[0], rest = ranked.slice(1);
  const clearsModels = rest.every((m) => lo(top) > hi(m));
  const clearsHumans = humans.every((h) => lo(top) > hi(h));
  if (clearsModels && clearsHumans)
    return { kind: "model", text: `A ${top.name} habit. ${at(top).toFixed(2)} per 1,000 words, and its interval clears every other model and both human sets.` };

  if (maxHuman >= maxModel)
    return { kind: "weak", text: "Runs at or below the human rate in every model tested." };

  // Clearing the human sets but not the other models is its own answer: the
  // habit is real and shared, which is different from belonging to one model.
  const above = models.filter((m) => humans.every((h) => lo(m) > hi(h)));
  if (above.length > 1)
    return { kind: "shared", text: `Elevated in ${above.map((m) => `${m.name} (${at(m).toFixed(2)})`).join(" and ")}, against ${maxHuman.toFixed(2)} at most in human writing. Shared by more than one model, so it is not a fingerprint.` };

  if (!clearsHumans && at(top) > maxHuman)
    return { kind: "overlap", text: `Highest in ${top.name} at ${at(top).toFixed(2)}, but the interval overlaps human writing. Not separation.` };

  return { kind: "mixed", text: "No single model separates from the others by a clear margin." };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const anchor = (id) => id.replace(/_/g, "-");

// ---------------------------------------------------------------------------

const rules = loadRules();
const present = ARMS.filter(([d]) => existsSync(join(CORPUS, d)) &&
  readdirSync(join(CORPUS, d)).some((f) => f.endsWith(".txt")));
if (!present.length) throw new Error("No corpora found under study/corpus");

// The human corpora are third-party text and are deliberately not committed, so
// a CI checkout has the model arms and none of the human ones. Regenerating from
// what is on disk there would quietly publish a glossary with no human baseline,
// and every verdict on the page is a comparison against that baseline. So: if
// the last published snapshot used arms this machine does not have, change
// nothing and say why. Better a stale page than a confidently wrong one.
const RATES = join(ROOT, "study", "rates.json");
if (existsSync(RATES)) {
  const prior = JSON.parse(readFileSync(RATES, "utf8")).arms.map((a) => a.key);
  const here = present.map(([d]) => d);
  const absent = prior.filter((k) => !here.includes(k));
  if (absent.length) {
    console.log(`Not rebuilding. ${absent.join(", ")} ${absent.length === 1 ? "is" : "are"} missing from study/corpus on this machine,`);
    console.log(`and study/rates.json was built with ${prior.join(", ")}.`);
    console.log("The human corpora are not committed on purpose. Run this where they live.");
    process.exit(0);
  }
}

const raw = measure(present.map(([d]) => join(CORPUS, d)));

// The reproducibility file. Every human rate this project publishes is
// recomputable from it, and it carries counts rather than text, so it can be
// published where the documents themselves cannot. It rides on the glossary
// build so it cannot fall out of step with the rates, and it covers all three
// human corpora, including the 2004 blogs, which are measured here but are not
// one of the arms the verdicts compare.
const HUMAN_DIRS = ["medium", "newsletter", "human"]
  .map((d) => join(CORPUS, d))
  .filter((d) => existsSync(d) && readdirSync(d).some((f) => f.endsWith(".txt")));
if (HUMAN_DIRS.length) {
  measure(HUMAN_DIRS, ["--baseline", join(ROOT, "human-baseline.json")]);
} else {
  console.log("No human corpora present, so human-baseline.json was left alone.");
}
const arms = present.map(([d, name, human]) => ({ key: d, name, human,
  documents: raw.arms[d]?.documents ?? 0, words: raw.arms[d]?.words ?? 0 }));

const measured = new Date().toISOString().slice(0, 10);

const entries = rules.map((r) => {
  const rates = {}, cis = {};
  for (const a of arms) {
    const cell = raw.arms[a.key]?.rates?.[r.id];
    rates[a.key] = cell ? +cell.rate.toFixed(2) : null;
    cis[a.key] = cell ? [+cell.lo.toFixed(2), +cell.hi.toFixed(2)] : null;
  }
  return { ...r, rates, cis, verdict: verdict(rates, cis, arms) };
});

writeFileSync(join(ROOT, "study", "rates.json"), JSON.stringify({
  measured, seed: raw.seed ?? null, bootstrap: raw.bootstrap ?? null, arms,
  rates: Object.fromEntries(entries.map((e) => [e.id, e.rates])),
  intervals: Object.fromEntries(entries.map((e) => [e.id, e.cis])),
}, null, 2) + "\n");

writeFileSync(join(ROOT, "rules.json"), JSON.stringify({
  version: measured,
  note: "Rules as the humansounding.com checker runs them, with measured rates per 1,000 words. Generated from checker.html; do not edit by hand.",
  method: raw.seed == null ? undefined : `Rates per 1,000 words. Intervals are 95% percentile bootstrap over ${raw.bootstrap} resamples of whole documents, seeded (${raw.seed}) so a rerun reproduces these numbers exactly.`,
  corpora: arms,
  rules: entries.map((e) => ({ id: e.id, label: e.label, severity: e.sev,
    guidance: e.fix, pattern: e.source, rates: e.rates, intervals: e.cis,
    verdict: e.verdict.text })),
}, null, 2) + "\n");

console.log(`rules.json and study/rates.json written: ${entries.length} rules, ${arms.length} corpora`);
export { entries, arms, measured, esc, anchor };

// ---------------------------------------------------------------------------
// The page. Definitions live in glossary-definitions.json because a definition
// is prose and cannot be derived from a regex. The build fails when a rule has
// no entry there, so a new rule cannot ship without a plain-English meaning.

const DEFS = JSON.parse(readFileSync(join(ROOT, "glossary-definitions.json"), "utf8")).terms;
const missing = entries.filter((e) => !DEFS[e.id]).map((e) => e.id);
if (missing.length) throw new Error("No definition for: " + missing.join(", ") + ". Add them to glossary-definitions.json.");

const SEVNAME = { 1: "Loudest", 2: "Structural", 3: "Legacy" };
const fmt = (v) => (v === null || v === undefined ? "&mdash;" : v.toFixed(2));

// Self-narration is defined here but has no checker rule, so it carries no row
// of rates. Listing it anyway is the point: the glossary is the vocabulary,
// not an index of what the tool happens to match.
// Alphabetical by the term a reader would look up, not by how well the rule
// performed. A reference is something you scan for a word you half-remember;
// ordering it by verdict would turn it into a ranking of our own tool.
const ordered = entries.slice().sort((a, b) =>
  DEFS[a.id].term.localeCompare(DEFS[b.id].term));

const extras = Object.entries(DEFS).filter(([id, d]) => d.unmeasured && !entries.some((e) => e.id === id))
  .map(([id, d]) => ({ id, label: d.term, sev: null, verdict: { kind: "unmeasured",
    text: "Named and defined, deliberately not in the checker. Its forms are unbounded, so no pattern can match them." }, rates: null }));

function section(e) {
  const d = DEFS[e.id];
  const rows = e.rates ? arms.map((a) =>
    `<tr><th scope="row">${esc(a.name)}</th><td>${fmt(e.rates[a.key])}</td><td class="ci">${e.cis[a.key] ? `${e.cis[a.key][0].toFixed(2)}&ndash;${e.cis[a.key][1].toFixed(2)}` : "&mdash;"}</td></tr>`).join("\n            ") : "";
  const table = e.rates ? `
        <table class="rates">
          <caption>Hits per 1,000 words, with a 95% interval over documents. Measured ${measured}.</caption>
          <thead><tr><th scope="col">Corpus</th><th scope="col">Rate</th><th scope="col">Interval</th></tr></thead>
          <tbody>
            ${rows}
          </tbody>
        </table>` : "";
  return `      <section class="term" id="${anchor(e.id)}">
        <h2>${esc(DEFS[e.id].term)}${e.sev ? ` <span class="sev sev${e.sev}">${SEVNAME[e.sev]}</span>` : ` <span class="sev sev0">Instruction file only</span>`}</h2>
        <p class="plain">${esc(d.plain)}</p>
        <p class="eg"><span class="lbl">Example</span> ${esc(d.example)}</p>
        <p class="eg"><span class="lbl">Instead</span> ${esc(d.instead)}</p>
        <p class="vd vd-${e.verdict.kind}">${esc(e.verdict.text)}</p>${table}
      </section>`;
}

const TERMS = [...ordered, ...extras].sort((a, b) =>
  DEFS[a.id].term.localeCompare(DEFS[b.id].term));
const schema = {
  "@context": "https://schema.org", "@type": "DefinedTermSet",
  name: "AI writing tells", url: "https://humansounding.com/ai-writing-tells.html",
  hasDefinedTerm: TERMS.map((e) => ({ "@type": "DefinedTerm", name: DEFS[e.id].term,
    description: DEFS[e.id].plain, url: `https://humansounding.com/ai-writing-tells.html#${anchor(e.id)}` })),
};

const totalWords = arms.reduce((n, a) => n + a.words, 0);
const counts = TERMS.reduce((c, e) => (c[e.verdict.kind] = (c[e.verdict.kind] || 0) + 1, c), {});

writeFileSync(join(ROOT, "ai-writing-tells.html"), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI writing tells: what each one means | HumanSounding</title>
<meta name="description" content="Plain definitions for the patterns people call AI writing, with an example of each, and what happens when you count them across ${totalWords.toLocaleString()} words of machine and human prose.">
<link rel="canonical" href="https://humansounding.com/ai-writing-tells.html">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9C%8D%EF%B8%8F%3C/text%3E%3C/svg%3E">
<meta property="og:type" content="article">
<meta property="og:site_name" content="HumanSounding">
<meta property="og:title" content="AI writing tells: what each one means">
<meta property="og:description" content="Every named pattern, defined in plain English, with an example and the measured rate in four models and two sets of human writing.">
<meta property="og:url" content="https://humansounding.com/ai-writing-tells.html">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
${JSON.stringify(schema)}
</script>
<script>
(function () {
  var t; try { t = localStorage.getItem("hs_theme"); } catch (e) {}
  document.documentElement.dataset.theme = t || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
})();
</script>
<link rel="stylesheet" href="/assets/site.css">
<style>
  main.wrap-post { padding-bottom: 40px; }
  .lede { font-size: 16.5px; line-height: 1.75; color: var(--ink-1); margin: 0 0 16px; }
  :root[data-theme="dark"] .lede { color: #e8e6e0; }
  .toc { display: flex; flex-wrap: wrap; gap: 8px; margin: 22px 0 34px; padding: 0; list-style: none; }
  .toc a { font-size: 13px; text-decoration: none; border: 1px solid var(--border); border-radius: 999px; padding: 5px 11px; color: var(--ink-2); display: inline-block; }
  .toc a:hover { color: var(--ink-1); }
  section.term { border-top: 1px solid var(--border); padding: 26px 0 6px; }
  section.term h2 { font-size: 21px; margin: 0 0 10px; letter-spacing: -0.3px; }
  .sev { font-size: 11.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; border-radius: 4px; padding: 3px 7px; vertical-align: 3px; margin-left: 6px; background: var(--border); color: var(--ink-2); }
  .plain { font-size: 16.5px; line-height: 1.7; color: var(--ink-1); margin: 0 0 12px; }
  :root[data-theme="dark"] .plain { color: #e8e6e0; }
  .eg { font-size: 15px; line-height: 1.6; color: var(--ink-2); margin: 0 0 6px; }
  .eg .lbl { font-size: 11.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-muted); margin-right: 8px; }
  .vd { font-size: 14.5px; line-height: 1.6; margin: 14px 0 4px; padding-left: 12px; border-left: 3px solid var(--border); color: var(--ink-2); }
  .vd-model, .vd-shared { border-left-color: #2f7d5d; color: var(--ink-1); }
  :root[data-theme="dark"] .vd-model, :root[data-theme="dark"] .vd-shared { color: #e8e6e0; }
  table.rates { border-collapse: collapse; margin: 14px 0 8px; font-size: 14px; width: 100%; max-width: 460px; }
  table.rates caption { text-align: left; font-size: 12.5px; color: var(--ink-muted); padding-bottom: 8px; }
  table.rates th, table.rates td { text-align: right; padding: 4px 10px 4px 0; border-bottom: 1px solid var(--border); }
  table.rates th[scope="row"] { text-align: left; font-weight: 400; color: var(--ink-2); }
  table.rates thead th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-muted); }
  table.rates .ci { color: var(--ink-muted); }
  .method { font-size: 13.5px; color: var(--ink-2); border-top: 1px solid var(--border); margin-top: 34px; padding-top: 18px; }
</style>
</head>
<body>
<nav id="topnav" aria-label="Site">
  <div class="in">
    <a class="brand" href="/">HumanSounding</a>
    <a class="nl" href="/">Home</a>
    <a class="nl" href="/checker.html">Checker</a>
    <a class="nl" href="/trends.html">Trends</a>\n    <a class="nl" href="/ai-writing-tells.html" aria-current="page">Tells</a>
    <a class="nl" href="/fix-your-ai.html"><span class="long">Fix your AI</span><span class="short">Fix it</span></a>
    <a class="nl nl-overflow" href="/blog.html">Blog</a>
    <a class="nl nl-overflow" href="/about.html">About</a>
    <div class="more">
      <button class="morebtn" aria-expanded="false" aria-haspopup="true">More &#9662;</button>
      <div class="menu">
        <a href="/blog.html">Blog</a>
        <a href="/blog.html#week">This week</a>
        <a href="/about.html">About</a>
      </div>
    </div>
    <a class="cta" href="/checker.html">Check your draft</a>
  </div>
</nav>

<main class="wrap-post">
  <article>
    <div class="kicker">Reference &middot; measured ${measured}</div>
    <h1>AI writing tells, and what each one means</h1>

    <p class="lede">People arguing about AI writing mostly cannot name what they are looking at. These are the names, with an example of each, so the argument has words in it.</p>

    <p class="lede">Under every definition is what happened when the pattern was counted across ${totalWords.toLocaleString()} words: ${arms.filter((a) => !a.human).length} models and ${arms.filter((a) => a.human).length} sets of human writing from before ChatGPT existed. Most of these patterns are cited far more often than they occur. That is worth knowing before you accuse anybody of anything.</p>

    <p class="lede">The machine-readable version is <a href="/rules.json">rules.json</a>, generated from the same source as the <a href="/checker.html">checker</a>, so this page cannot drift away from the tool.</p>

    <ul class="toc">
${TERMS.map((e) => `      <li><a href="#${anchor(e.id)}">${esc(DEFS[e.id].term)}</a></li>`).join("\n")}
    </ul>

${TERMS.map(section).join("\n\n")}

    <p class="method"><b>How this was measured.</b> Rates are hits per 1,000 words, with a 95% confidence interval bootstrapped over whole documents rather than sentences. A pattern is called one model's habit only when its interval clears every other model and both human sets. Anything under 0.20 per 1,000 words is reported as too rare to characterize, because a single hit in twenty thousand words is noise. Corpora, generator, and measurement scripts are in <a href="https://github.com/wyvernkalyx/humansounding/tree/main/study">study/</a>. This page is generated; the definitions live in <a href="https://github.com/wyvernkalyx/humansounding/blob/main/glossary-definitions.json">glossary-definitions.json</a>.</p>
  </article>
</main>

<footer class="site">
  <div class="in">
    <span>No cookies, no signup. Data updated every Monday, every figure cited.</span>
    <button id="themeBtn" aria-label="Toggle dark mode">&#9680; Theme</button>
  </div>
</footer>

<script src="/assets/site.js"></script>
</body>
</html>
`);

console.log(`ai-writing-tells.html written: ${TERMS.length} terms, ${totalWords.toLocaleString()} words measured`);
console.log("  " + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join("  "));
