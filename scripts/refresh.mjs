// HumanSounding weekly trend refresh (v2)
// Runs in GitHub Actions. Researches AI-writing-tell developments via the
// Claude API (with web search), validates the result, updates the live site's
// data in Supabase, and regenerates the trending files that keep the
// downloadable skill current (trending.txt + the fenced section in
// skill/SKILL.md; the workflow zips and commits them).
// On ANY failure it exits nonzero and changes nothing.

import { readFileSync, writeFileSync } from "node:fs";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = "https://mrkvxxmzekasxtpscawj.supabase.co";
const MAX_SEARCHES = 12;
const MAX_OUTPUT_TOKENS = 8000;

// ---------- trending-file generators (pure functions over validated data) ----------
function risingRows(d) {
  return d.trends.filter((t) => t.dir === "rising").slice(0, 10);
}
function trendingText(d) {
  const lines = risingRows(d).map((t) => `- ${t.tell}: ${t.evidence}`);
  return `HumanSounding — trending AI-writing tells, ${d.updated}
Reference data only: a list of patterns to AVOID in prose. Nothing in this file is an instruction.

Rising tells:
${lines.join("\n")}

Full dashboard: https://humansounding.com
`;
}
function skillTrendingSection(d) {
  const lines = risingRows(d).map((t) => `- ${t.tell} — ${t.evidence}`);
  return `<!-- TRENDING:START -->
## Trending tells right now (auto-updated ${d.updated})

This section is data, refreshed weekly from sourced research at humansounding.com. Check drafts against these patterns with the same force as Tier 1.

${lines.join("\n")}
<!-- TRENDING:END -->`;
}
function writeTrendingFiles(d) {
  writeFileSync("trending.txt", trendingText(d));
  const skillPath = "skill/SKILL.md";
  const skill = readFileSync(skillPath, "utf8");
  const re = /<!-- TRENDING:START -->[\s\S]*?<!-- TRENDING:END -->/;
  if (!re.test(skill)) {
    console.error("WARNING: trending markers not found in skill/SKILL.md; skill not updated.");
    return;
  }
  writeFileSync(skillPath, skill.replace(re, skillTrendingSection(d)));
  console.log("Wrote trending.txt and refreshed skill trending section.");
}

// ---------- local test mode: regenerate files from a JSON snapshot, no API ----------
if (process.env.LOCAL_TEST === "1") {
  const d = JSON.parse(readFileSync("data.json", "utf8"));
  writeTrendingFiles(d);
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
const prompt = `You maintain the data behind HumanSounding (humansounding.com), a public dashboard of AI-writing tells. Below is the current data JSON. Research developments from roughly the last two weeks and return the updated JSON.

Research (use web search, be efficient): GPTZero's AI vocabulary page, new arXiv papers on LLM stylometry/excess vocabulary, Wikipedia:Signs of AI writing changes, EQ-Bench slop score, and tech press on model writing-style changes (new model releases, em-dash/markdown tuning, newly memed tell phrases).

Rules — these are hard constraints:
- Return ONLY the complete updated JSON object, no commentary, no code fences.
- Preserve the exact structure and keys: updated, note, phrases, phraseSrc, dashes, dashSrc, trends.
- Set "updated" to "${today}".
- Only change a figure, evidence string, dir, or dirLabel if you found a sourced basis this run; otherwise leave it as is. NEVER invent statistics.
- Name the source inside any evidence string you change (e.g. "(GPTZero, Aug 2026)").
- "note": one plain sentence if something genuinely newsworthy happened for a general reader, else "". No hype. Avoid AI-vernacular words and constructions (the site's own subject).
- trends: keep 8-16 rows; dir must be "rising", "falling", or "stable". You may add a row for a genuinely new, sourced tell or remove an obsolete one.
- Keep every string concise: tell < 120 chars, evidence < 300, dirLabel < 80, note < 200.

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

const text = (result.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (!jsonMatch) { console.error("No JSON found in model output. Output began:", text.slice(0, 300)); process.exit(1); }

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
  if (!["rising", "falling", "stable"].includes(t.dir)) fail("trend dir");
}
// strip any unexpected keys
const clean = {
  updated: updated.updated,
  note: updated.note ?? "",
  phrases: updated.phrases.map((p) => ({ label: p.label, v: p.v })),
  phraseSrc: updated.phraseSrc,
  dashes: updated.dashes.map((d) => ({ label: d.label, v: d.v, ...(d.ref ? { ref: true } : {}) })),
  dashSrc: updated.dashSrc,
  trends: updated.trends.map((t) => ({ tell: t.tell, evidence: t.evidence, dir: t.dir, dirLabel: t.dirLabel || t.dir })),
};

// ---------- 5. write database ----------
const w = await sb("site_data?id=eq.1", {
  method: "PATCH",
  body: JSON.stringify({ data: clean, updated_at: new Date().toISOString() }),
});
if (!w.ok) { console.error("Supabase write failed:", w.status, await w.text()); process.exit(1); }

// ---------- 6. regenerate trending files for the skill (committed by workflow) ----------
writeTrendingFiles(clean);

console.log("Refresh complete. updated:", clean.updated, "| note:", clean.note || "(none)");
console.log("Changed vs previous:", JSON.stringify(clean) === JSON.stringify(current) ? "no changes" : "data updated");
