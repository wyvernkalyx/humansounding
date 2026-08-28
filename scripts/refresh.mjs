// HumanSounding weekly trend refresh (v3, multi-page site)
// Runs in GitHub Actions. Researches AI-writing-tell developments via the
// Claude API (with web search), validates the result, updates the live site's
// data in Supabase, and regenerates the files the weekly robot owns:
//   - trending.txt + the fenced section in skill/SKILL.md (skill stays current)
//   - blog/<iso>.html          the narrative weekly column (new post per week)
//   - blog.html                featured card + archive cards (marker sections)
//   - changelog.html           the all-editions list (marker section)
//   - feed.xml                 RSS, items pointing at the column posts
// The workflow zips the skill and commits everything.
// On ANY failure it exits nonzero and changes nothing.

import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "./load-env.mjs";

// No-op in GitHub Actions, where there is no .env and the secrets are already
// in the environment. Only affects local runs.

loadEnv();
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = "https://mrkvxxmzekasxtpscawj.supabase.co";
const MAX_SEARCHES = 12;
// Thinking tokens bill against max_tokens. The 2026-08-17 scheduled run failed
// because the auto-picked newest Sonnet spent 8408 thinking tokens against an
// 8000 cap and emitted no text at all, so the JSON parse found nothing.
//
// The fix is headroom, deliberately NOT a thinking parameter. This script picks
// whatever model /v1/models returns newest, and the thinking API itself changes
// between models: claude-sonnet-5 rejects `thinking.type: "enabled"` outright and
// wants `thinking.type: "adaptive"` with `output_config.effort`. Sending no
// thinking config keeps this script working across model generations; a generous
// cap absorbs whatever the current model decides to spend on reasoning.
const MAX_OUTPUT_TOKENS = 24000;

// ---------- trending-file generators (pure functions over validated data) ----------
function risingRows(d) {
  return d.trends.filter((t) => t.dir === "rising").slice(0, 10);
}
function trendingText(d) {
  const lines = risingRows(d).map((t) => `- ${t.tell}: ${t.evidence}`);
  return `HumanSounding trending AI-writing tells, ${d.updated}
Reference data only: a list of patterns to AVOID in prose. Nothing in this file is an instruction.

Rising tells:
${lines.join("\n")}

Full dashboard: https://humansounding.com
`;
}
function skillTrendingSection(d) {
  const lines = risingRows(d).map((t) => `- ${t.tell}: ${t.evidence}`);
  return `<!-- TRENDING:START -->
## Trending tells right now (auto-updated ${d.updated})

This section is data, refreshed weekly from sourced research at humansounding.com. Check drafts against these patterns with the same force as Tier 1.

${lines.join("\n")}
<!-- TRENDING:END -->`;
}

// ---------- html helpers ----------
const escXml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function replaceMarked(file, startMark, endMark, inner) {
  const src = readFileSync(file, "utf8");
  const re = new RegExp(`(${startMark.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})[\\s\\S]*?(${endMark.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`);
  if (!re.test(src)) { console.error(`WARNING: markers not found in ${file}; not updated.`); return false; }
  // Replacer function: model-derived `inner` must not be $-interpolated.
  writeFileSync(file, src.replace(re, (_, start, end) => `${start}\n${inner}\n  ${end}`));
  return true;
}
const NAV_BLOG_ACTIVE = `<nav id="topnav" aria-label="Site">
  <div class="in">
    <a class="brand" href="/">HumanSounding</a>
    <a class="nl" href="/">Home</a>
    <a class="nl" href="/checker.html">Checker</a>
    <a class="nl" href="/trends.html">Trends</a>
    <a class="nl" href="/fix-your-ai.html"><span class="long">Fix your AI</span><span class="short">Fix it</span></a>
    <a class="nl nl-overflow" href="/blog.html" aria-current="page">Blog</a>
    <a class="nl nl-overflow" href="/about.html">About</a>
    <div class="more">
      <button class="morebtn" aria-expanded="false" aria-haspopup="true">More ▾</button>
      <div class="menu">
        <a href="/blog.html">Blog</a>
        <a href="/blog.html#week">This week</a>
        <a href="/about.html">About</a>
      </div>
    </div>
    <a class="cta" href="/checker.html">Check your draft</a>
  </div>
</nav>`;
const FOOTER = `<footer class="site">
  <div class="in">
    <span>No cookies, no signup. Data updated every Monday, every figure cited.</span>
    <button id="themeBtn" aria-label="Toggle dark mode">◐ Theme</button>
  </div>
</footer>

<script src="/assets/site.js"><\/script>`;

// ---------- weekly column post page (blog/<iso>.html) ----------
function specimenHtml(spec) {
  if (!spec || !Array.isArray(spec.segments) || !spec.segments.length) return "";
  const quote = spec.segments.map((s) => s.m ? `<mark>${escHtml(s.m)}</mark>` : escHtml(s.t || "")).join("");
  const cap = spec.caption ? `\n  <p class="cap">${escHtml(spec.caption)}</p>` : "";
  return `<div class="band specimen">
  <p class="specimen">"${quote}…"</p>${cap}
</div>`;
}
function postDateHuman(entry) { return entry.week; } // e.g. "August 17, 2026"
function writeBlogPost(entry, prevEntry, spec) {
  const url = `https://humansounding.com/blog/${entry.slug}.html`;
  const paragraphs = entry.paragraphs.map((p) => `    <p class="body">${p}</p>`).join("\n");
  const prev = prevEntry && prevEntry.slug
    ? `<a href="/blog/${prevEntry.slug}.html">‹ ${escHtml(prevEntry.title || postDateHuman(prevEntry))}</a>`
    : "<span></span>";
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(entry.title)} | This week in AI writing | HumanSounding</title>
<meta name="description" content="${escXml(entry.deck)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9C%8D%EF%B8%8F%3C/text%3E%3C/svg%3E">
<meta property="og:type" content="article">
<meta property="og:site_name" content="HumanSounding">
<meta property="og:title" content="${escXml(entry.title)} | This week in AI writing">
<meta property="og:description" content="${escXml(entry.deck)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://humansounding.com/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="application/rss+xml" title="HumanSounding weekly" href="https://humansounding.com/feed.xml">
<script type="application/ld+json">
${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: entry.title, description: entry.deck, datePublished: entry.iso, dateModified: entry.iso, author: { "@type": "Organization", name: "HumanSounding", url: "https://humansounding.com/" }, mainEntityOfPage: url })}
</script>
<script>
(function () {
  var t; try { t = localStorage.getItem("hs_theme"); } catch (e) { /* storage blocked */ }
  document.documentElement.dataset.theme = t || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
})();
</script>
<link rel="stylesheet" href="/assets/site.css">
<style>
  .band { background: var(--band); border-bottom: 1px solid var(--border); padding: 44px 24px 36px; text-align: center; }
  .band .specimen { font-size: 26px; line-height: 1.6; font-weight: 600; max-width: 860px; margin: 0 auto; color: var(--ink-1); }
  .band .cap { color: var(--ink-muted); font-size: 12px; margin: 14px 0 0; }
  article { padding-top: 40px; }
  .kicker { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--hl-border); margin-bottom: 10px; }
  article h1 { font-size: 30px; margin: 0 0 18px; letter-spacing: -0.5px; line-height: 1.25; }
  article p.body { color: var(--ink-1); font-size: 16.5px; line-height: 1.75; margin: 0 0 16px; }
  :root[data-theme="dark"] article p.body { color: #e8e6e0; }
  .alsostrip { display: flex; gap: 14px; align-items: center; padding: 12px 18px; margin-top: 26px; flex-wrap: wrap; }
  .alsostrip .n { font-size: 13px; color: var(--ink-2); }
  .pn { display: flex; justify-content: space-between; align-items: center; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border); gap: 12px; flex-wrap: wrap; }
  .pn a { font-size: 13.5px; }
</style>
</head>
<body>
${NAV_BLOG_ACTIVE}

${specimenHtml(spec)}

<main class="wrap-post">
  <article>
    <div class="kicker">This week in AI writing · ${escHtml(postDateHuman(entry))}</div>
    <h1>${escHtml(entry.title)}</h1>
${paragraphs}

    <div class="card alsostrip">
      <span class="label-caps">Also on the site</span>
      <span class="n">${escHtml(entry.site_note)}</span>
    </div>

    <div class="pn">
      ${prev}
      <a href="/blog.html#week">All editions ›</a>
    </div>
  </article>
</main>

${FOOTER}
</body>
</html>
`;
  writeFileSync(`blog/${entry.slug}.html`, page);
}

// ---------- blog index + changelog + feed (from the full log) ----------
function shortDate(entry) {
  const d = new Date(entry.iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
function updateBlogIndex(log) {
  const newest = log[0];
  const featured = `  <a class="featured" data-kind="week" href="/blog/${newest.slug}.html">
    <span class="kicker">This week · ${escHtml(shortDate(newest))}</span>
    <h3>${escHtml(newest.title)}</h3>
    <p>${escHtml(newest.deck)}</p>
  </a>`;
  replaceMarked("blog.html", "<!-- FEATURED:START (regenerated weekly by the research pipeline) -->", "<!-- FEATURED:END -->", featured);
  const archive = log.slice(1).filter((w) => w.slug && w.title).map((w) => `    <a class="card post old" data-kind="week" href="/blog/${w.slug}.html">
      <span class="kicker">This week · ${escHtml(shortDate(w))}</span>
      <h3>${escHtml(w.title)}</h3>
      <p>${escHtml(w.deck || "")}</p>
    </a>`).join("\n");
  replaceMarked("blog.html", "<!-- ARCHIVE:START (older weekly editions accumulate here, newest first) -->", "<!-- ARCHIVE:END -->", archive);
}
function updateChangelog(log) {
  const cards = log.map((w, i) => {
    const href = w.slug ? `/blog/${w.slug}.html` : `#w${w.iso}`;
    const title = w.title ? `\n    <h3>${escHtml(w.title)}</h3>` : "";
    const deck = w.deck ? `\n    <p>${escHtml(w.deck)}</p>` : (Array.isArray(w.items) && w.items.length ? `\n    <p>${escHtml(w.items[0])}</p>` : "");
    return `  <a class="card edition" id="w${w.iso}" href="${href}">
    <span class="d">Week of ${escHtml(w.week)}</span>${i === 0 ? ' <span class="latest">latest</span>' : ""}${title}${deck}
  </a>`;
  }).join("\n");
  replaceMarked("changelog.html", "<!-- EDITIONS:START (regenerated weekly by the research pipeline, newest first) -->", "<!-- EDITIONS:END -->", cards);
}
function writeFeed(log) {
  const items = log.map((w) => `
  <item>
    <title>${escXml(w.title || "This week in AI writing: " + w.week)}</title>
    <link>https://humansounding.com/${w.slug ? `blog/${w.slug}.html` : `changelog.html#w${w.iso}`}</link>
    <guid isPermaLink="true">https://humansounding.com/changelog.html#w${w.iso}</guid>
    <pubDate>${new Date(w.iso + "T12:00:00Z").toUTCString()}</pubDate>
    <description>${escXml(w.deck || (Array.isArray(w.items) ? w.items.join(" • ") : ""))}</description>
  </item>`).join("");
  writeFileSync("feed.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>HumanSounding: this week in AI writing</title>
  <link>https://humansounding.com/blog.html</link>
  <description>The weekly column on AI's accent: what's rising, what's fading, and what changed in the machine vernacular.</description>
  <language>en-us</language>${items}
</channel></rss>
`);
}

function writeAllFiles(d) {
  writeFileSync("trending.txt", trendingText(d));
  const skillPath = "skill/SKILL.md";
  const skill = readFileSync(skillPath, "utf8");
  const re = /<!-- TRENDING:START -->[\s\S]*?<!-- TRENDING:END -->/;
  if (!re.test(skill)) {
    console.error("WARNING: trending markers not found in skill/SKILL.md; skill not updated.");
  } else {
    // Replacer function: model-derived content must not be $-interpolated.
    writeFileSync(skillPath, skill.replace(re, () => skillTrendingSection(d)));
  }
  const log = Array.isArray(d.log) ? d.log : [];
  if (log.length && log[0].slug && log[0].title && Array.isArray(log[0].paragraphs)) {
    writeBlogPost(log[0], log[1], d.specimen);
    updateBlogIndex(log);
    updateChangelog(log);
    writeFeed(log);
    console.log("Wrote trending.txt, skill trending section, blog post, blog index, changelog.html, feed.xml.");
  } else {
    console.error("WARNING: newest log entry lacks column fields; blog files not regenerated.");
  }
}

// ---------- local test mode: regenerate files from a JSON snapshot, no API ----------
if (process.env.LOCAL_TEST === "1") {
  const d = JSON.parse(readFileSync("data.json", "utf8"));
  writeAllFiles(d);
  process.exit(0);
}

if (!ANTHROPIC_KEY || !SUPABASE_KEY) {
  console.error("Missing ANTHROPIC_API_KEY or SUPABASE_SERVICE_ROLE_KEY secret.");
  process.exit(1);
}

const sb = (path, opts = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(opts.headers || {}),
    },
  });

// ---------- 1. read current data ----------
const cur = await sb("site_data?id=eq.1&select=data");
if (!cur.ok) { console.error("Supabase read failed:", cur.status, await cur.text()); process.exit(1); }
const [row] = await cur.json();
if (!row?.data) { console.error("No site_data row found."); process.exit(1); }
const current = row.data;
console.log("Loaded current data, updated:", current.updated);

// ---------- 2. pick newest Sonnet model ----------
const anthropicHeaders = {
  "x-api-key": ANTHROPIC_KEY,
  "anthropic-version": "2023-06-01",
  "content-type": "application/json",
};
let model = "claude-sonnet-4-5"; // fallback
try {
  const mr = await fetch("https://api.anthropic.com/v1/models?limit=50", { headers: anthropicHeaders });
  if (mr.ok) {
    const models = (await mr.json()).data || [];
    const sonnet = models.find((m) => m.id.includes("sonnet"));
    if (sonnet) model = sonnet.id;
  }
} catch { /* fallback stands */ }
console.log("Using model:", model);

// ---------- 3. research ----------
const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const prompt = `You maintain the data behind HumanSounding (humansounding.com), a public dashboard of AI-writing tells with a weekly column for non-technical writers. Below is the current data JSON. Research developments from roughly the last two weeks and return the updated JSON.

Research (use web search, be efficient): GPTZero's AI vocabulary page, new arXiv papers on LLM stylometry/excess vocabulary, Wikipedia:Signs of AI writing changes, EQ-Bench slop score, and tech press on model writing-style changes (new model releases, em-dash/markdown tuning, newly memed tell phrases).

Rules — these are hard constraints:
- Return ONLY the complete updated JSON object, no commentary, no code fences.
- Preserve the exact structure and keys: updated, note, phrases, phraseSrc, dashes, dashSrc, trends (each row: tell, evidence, dir, dirLabel, model), column, specimen. (Do not return "log" or "history"; the pipeline maintains those.)
- Set "updated" to "${today}".
- Only change a figure, evidence string, dir, or dirLabel if you found a sourced basis this run; otherwise leave it as is. NEVER invent statistics.
- Name the source inside any evidence string you change (e.g. "(GPTZero, Aug 2026)").
- "note": one plain sentence if something genuinely newsworthy happened for a general reader, else "". No hype.
- trends: keep 8-16 rows; dir must be "rising", "falling", or "stable". You may add a row for a genuinely new, sourced tell or remove an obsolete one.
- Each trend row also carries "model": which model the tell actually belongs to, under 40 chars. Fill it ONLY from per-model evidence you can cite this run, or from the site's own corpus measurements. If nobody has measured the tell per model, return an empty string. An empty string is the correct and expected answer for most rows; guessing a model name is worse than leaving it blank. Never infer a model from the vendor that happens to be in the news.
- "column": the weekly column, written as a short narrative for casual readers, NOT a changelog. An object:
  - "title": a short, specific headline under 80 characters. Never clickbait.
  - "deck": one sentence under 180 characters summarizing the week.
  - "paragraphs": 3 or 4 paragraphs of plain narrative prose, each 40-120 words. Explain what changed and why a normal writer should care. Cite sources inline as HTML links (<a href="URL">source name</a>) using only URLs you actually found this run. You may link site pages: /checker.html, /trends.html, /fix-your-ai.html. Plain text otherwise; no other HTML tags, no markdown.
  - "site_note": one sentence under 180 characters on what changed on the site itself this week (data updates count). If nothing did: "No site changes this week."
  - Quiet-week fallback, used honestly and without padding: if nothing material changed, title the column plainly (e.g. "Quiet week; nothing material changed"), say so in one short paragraph, and spend the remaining 2-3 paragraphs on one existing sourced figure worth understanding. Never manufacture news.
- "specimen": a short display example for the home page and column header, showing this week's most notable tell in action. An object:
  - "segments": 2-6 pieces of one invented example sentence (an obviously corporate/marketing register is fine; it is bait and is supposed to be guilty). Each piece is {"t": "plain text"} or {"m": "marked text"} where marked pieces are the tell. Total under 140 characters.
  - "count": e.g. "2 tells in 14 words". Count the words in your own sentence accurately and undercount tells rather than inflating.
  - "reader": a short reader-truth line under 50 characters, e.g. "your reader noticed both".
  - "caption": one line under 80 characters naming the week's tell, e.g. "zero commas in 18 words: this week's tell".
- "changes": an array of 2 to 5 short plain-language strings describing what genuinely changed or was found THIS run. Each under 200 characters, naming its source where one applies. If nothing material changed, return exactly ["No material changes this week; figures re-verified against their sources."].
- Keep every string concise: tell < 120 chars, evidence < 300, dirLabel < 80, note < 200.
- Style, enforced sitewide because the site tracks these habits: use the serial comma, so a list of three or more takes a comma before the final "and" or "or" ("ChatGPT, Claude, Gemini, and Grok"); never use em dashes in ANY string you write (use commas, colons, or semicolons); no "not just X, but Y" constructions; no rule-of-three padding; none of the vocabulary on the site's own banned list (seamless, robust, leverage, delve, and so on). Quoted evidence and the specimen keep their tells deliberately; your own prose does not.

Current JSON:
${JSON.stringify(current)}`;

const resp = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: anthropicHeaders,
  body: JSON.stringify({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
    messages: [{ role: "user", content: prompt }],
  }),
});
if (!resp.ok) { console.error("Anthropic API error:", resp.status, await resp.text()); process.exit(1); }
const result = await resp.json();
console.log("Usage:", JSON.stringify(result.usage || {}));
console.log("Stop reason:", result.stop_reason, "| block types:", (result.content || []).map((b) => b.type).join(","));

const text = (result.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  // Print enough to diagnose without another run: an empty text block plus
  // stop_reason "max_tokens" means the budget was exhausted, not that the
  // model refused. That distinction cost a week the first time it happened.
  console.error("No JSON found in model output.");
  console.error("  stop_reason:", result.stop_reason);
  console.error("  text length:", text.length);
  console.error("  output began:", JSON.stringify(text.slice(0, 300)));
  process.exit(1);
}

let updated;
try { updated = JSON.parse(jsonMatch[0]); }
catch (e) { console.error("JSON parse failed:", e.message); process.exit(1); }

// ---------- 4. validate hard ----------
const fail = (msg) => { console.error("VALIDATION FAILED:", msg); process.exit(1); };
const isStr = (s, max) => typeof s === "string" && s.length <= max;
const isNum = (n, max) => typeof n === "number" && isFinite(n) && n >= 0 && n <= max;

if (!isStr(updated.updated, 40) || updated.updated.length < 8) fail("bad 'updated'");
if (!isStr(updated.note ?? "", 200)) fail("bad 'note'");
if (!isStr(updated.phraseSrc, 160) || !isStr(updated.dashSrc, 160)) fail("bad chart source strings");
if (!Array.isArray(updated.phrases) || updated.phrases.length < 3 || updated.phrases.length > 12) fail("phrases length");
for (const p of updated.phrases) if (!isStr(p.label, 120) || !isNum(p.v, 10000)) fail("phrase row");
if (!Array.isArray(updated.dashes) || updated.dashes.length < 3 || updated.dashes.length > 12) fail("dashes length");
for (const d of updated.dashes) if (!isStr(d.label, 60) || !isNum(d.v, 100)) fail("dash row");
if (!Array.isArray(updated.trends) || updated.trends.length < 6 || updated.trends.length > 20) fail("trends length");
for (const t of updated.trends) {
  if (!isStr(t.tell, 120) || !isStr(t.evidence, 300) || !isStr(t.dirLabel ?? "", 80)) fail("trend row strings");
  if (!isStr(t.model ?? "", 40)) fail("trend model");
  if (!["rising", "falling", "stable"].includes(t.dir)) fail("trend dir");
}
// validate the changelog entries
let changes = Array.isArray(updated.changes) ? updated.changes.filter((c) => isStr(c, 220) && c.length > 10).slice(0, 5) : [];
if (!changes.length) changes = ["No material changes this week; figures re-verified against their sources."];

// validate the narrative column; fall back to an honest quiet-week column, never a broken page
// Paragraphs may carry <a> links only — and the <a> tags that survive are
// rebuilt from scratch: the only attribute allowed through is a scheme-
// allowlisted, attribute-escaped href (plus a hardcoded rel="noopener").
// Everything else (on* handlers, style, javascript:/data: hrefs, entity-
// encoded scheme tricks) is discarded; a bad href degrades to a bare <a>.
const SAFE_HREF = /^(https?:\/\/|mailto:|\/|#)/i;
const escAttr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const stripDanger = (s) =>
  String(s)
    .replace(/<(?!\/?a(\s|>))[^>]*>/g, "") // drop every non-<a> tag
    .replace(/<a(\s[^>]*)?>/gi, (tag) => { // rebuild surviving <a> tags
      const m = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
      const href = ((m && (m[1] ?? m[2] ?? m[3])) || "").trim();
      return SAFE_HREF.test(href) ? `<a href="${escAttr(href)}" rel="noopener">` : "<a>";
    });
let column = updated.column;
const columnOk = column && isStr(column.title, 90) && column.title.length > 4
  && isStr(column.deck, 200) && column.deck.length > 10
  && Array.isArray(column.paragraphs) && column.paragraphs.length >= 2 && column.paragraphs.length <= 5
  && column.paragraphs.every((p) => isStr(p, 1200) && p.length > 30)
  && isStr(column.site_note ?? "", 200);
if (!columnOk) {
  console.error("WARNING: column invalid; using quiet-week fallback built from 'changes'.");
  column = {
    title: "Quiet week; nothing material changed",
    deck: changes[0].slice(0, 190),
    paragraphs: changes.map((c) => escHtml(c)),
    site_note: "No site changes this week.",
  };
} else {
  column = {
    title: column.title,
    deck: column.deck,
    paragraphs: column.paragraphs.map(stripDanger),
    site_note: column.site_note || "No site changes this week.",
  };
}
// validate the specimen; on failure keep last week's (embedded page fallbacks cover the rest)
let specimen = updated.specimen;
const segOk = (s) => (s && typeof s === "object") && ((isStr(s.t ?? "", 140) && !("m" in s)) || (isStr(s.m ?? "", 140) && !("t" in s)));
const specimenOk = specimen && Array.isArray(specimen.segments) && specimen.segments.length >= 2 && specimen.segments.length <= 6
  && specimen.segments.every(segOk)
  && isStr(specimen.count ?? "", 60) && isStr(specimen.reader ?? "", 60) && isStr(specimen.caption ?? "", 90);
if (!specimenOk) {
  console.error("WARNING: specimen invalid; keeping the previous one.");
  specimen = current.specimen || null;
}

// ---------- 5. assemble: log (with column), history (direction trail), clean shape ----------
const isoWeek = new Date().toISOString().slice(0, 10);
const slug = isoWeek;
const prevLog = (Array.isArray(current.log) ? current.log : []).filter((w) => w.iso !== isoWeek);
const newEntry = {
  week: updated.updated, iso: isoWeek, slug,
  title: column.title, deck: column.deck, paragraphs: column.paragraphs, site_note: column.site_note,
  items: changes,
};
// history: append this week's direction call per tell, keep 12, drop tells no longer tracked
const history = {};
const prevHist = (current.history && typeof current.history === "object") ? current.history : {};
for (const t of updated.trends) {
  const prev = Array.isArray(prevHist[t.tell]) ? prevHist[t.tell] : [];
  history[t.tell] = [...prev.filter((x) => ["rising", "falling", "stable"].includes(x)), t.dir].slice(-12);
}
const clean = {
  updated: updated.updated,
  note: updated.note ?? "",
  phrases: updated.phrases.map((p) => ({ label: p.label, v: p.v })),
  phraseSrc: updated.phraseSrc,
  dashes: updated.dashes.map((d) => ({ label: d.label, v: d.v, ...(d.ref ? { ref: true } : {}) })),
  dashSrc: updated.dashSrc,
  trends: updated.trends.map((t) => ({ tell: t.tell, evidence: t.evidence, dir: t.dir, dirLabel: t.dirLabel || t.dir, model: t.model || "" })),
  ...(specimen ? { specimen } : {}),
  history,
  log: [newEntry, ...prevLog].slice(0, 12),
};

// ---------- 6. write database ----------
const w = await sb("site_data?id=eq.1", {
  method: "PATCH",
  body: JSON.stringify({ data: clean, updated_at: new Date().toISOString() }),
});
if (!w.ok) { console.error("Supabase write failed:", w.status, await w.text()); process.exit(1); }

// ---------- 7. regenerate committed files (skill, column post, indexes, feed) ----------
writeAllFiles(clean);

console.log("Refresh complete. updated:", clean.updated, "| column:", column.title);
console.log("Changed vs previous:", JSON.stringify(clean) === JSON.stringify(current) ? "no changes" : "data updated");
