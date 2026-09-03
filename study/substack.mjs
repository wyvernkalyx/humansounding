#!/usr/bin/env node
// Substack collection for the pre-ChatGPT newsletter arm. 2026-09-02.
//
// Runs on Gregg's machine, not in the cloud session -- corpus text must be raw
// HTML converted locally. Text that has been through a model cannot be measured
// for em dashes, contractions or cadence, because the model may have normalised
// exactly those things.
//
// THREE STEPS, run in order. Start with one publication.
//
//   1. node study/substack.mjs check <slug>
//        Does this publication have posts before 2022-12? One request.
//
//   2. node study/substack.mjs list <slug> <year>
//        Post URLs for that year, from Substack's own sitemap index.
//
//   3. node study/substack.mjs fetch <slug> <year> --n 3 --out <dir>
//        Fetch and convert. Writes .txt plus a MANIFEST.tsv row per post.
//
// Politeness: one request at a time, DELAY_MS between, real user agent, and it
// stops on the first 429 rather than hammering. Substack rate-limited the cloud
// session on the first request, so do not raise CONCURRENCY. There is none.

import { writeFileSync, mkdirSync, appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { measureDoc } from "./lib/substance-metrics.mjs";

const DELAY_MS = 2500;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const CUTOFF_YEAR = 2022;   // 2022 posts need a month check; <=2021 is unambiguous

// ONE manifest schema, defined once, because there used to be two. `fetch`
// created MANIFEST.tsv with a 5-column header and `harvest` appended 10-column
// rows to it, each guarded only by existsSync -- so whichever ran first set the
// header and the other one silently disagreed with it forever. The collected
// corpus ended up with 853 ten-column rows under a five-column header, and
// measure.mjs, which read the date by position, was reading a URL.
//
// Nothing detected it because nothing ever checked. openManifest checks.
const MANIFEST_COLS = ["file", "publication", "publication_name", "author", "genre",
  "tagline", "url", "year", "words", "why_known_human"];

function openManifest(dir) {
  const man = join(dir, "MANIFEST.tsv");
  if (!existsSync(man)) {
    writeFileSync(man, MANIFEST_COLS.join("\t") + "\n");
    return man;
  }
  const header = (readFileSync(man, "utf8").split(/\r?\n/)[0] || "").split("\t");
  const same = header.length === MANIFEST_COLS.length && header.every((h, i) => h.trim() === MANIFEST_COLS[i]);
  if (!same) {
    console.error(`\n${man} has a different header than this script writes.`);
    console.error(`  on disk: ${header.join(" | ")}`);
    console.error(`  expected: ${MANIFEST_COLS.join(" | ")}`);
    console.error(`\nAppending would put rows under headings that do not describe them.`);
    console.error(`Provenance is the whole argument in a human arm. Migrate the file first.`);
    process.exit(1);
  }
  return man;
}

// A row is built by name, so a column added in the middle can never shift the
// meaning of the ones after it.
const manifestRow = (v) => MANIFEST_COLS.map((k) => String(v[k] ?? "").replace(/[\t\r\n]+/g, " ")).join("\t") + "\n";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, "accept": "text/html" } });
  if (res.status === 429) { console.error(`\n429 rate limited on ${url}\nStop, wait, raise DELAY_MS.`); process.exit(3); }
  if (!res.ok) throw new Error(`${res.status} on ${url}`);
  await sleep(DELAY_MS);
  return res.text();
}

// Extraction. Three paths, in order of reliability.
//
// 1. window._preloads -- Substack embeds the whole post object, including
//    body_html, as escaped JSON in a script tag. This is the authoritative
//    copy and is what we want.
// 2. Tag harvest -- collect every <p>, heading, <li> and <blockquote> in the
//    document and drop the ones that are chrome. Used when 1 fails.
// 3. Nothing. Reported as a skip with a reason, never silently.
//
// Regex was used to match nested <div>s in the first version. It matched
// nothing, on every post, and reported "0w" as though the posts were empty.
// Balanced tags are not a regex problem.

const PAYWALL = /class="[^"]*paywall|subscribe to (?:read|continue)|this post is for (?:paid|paying)/i;

function entities(t) {
  return t.replace(/&nbsp;/g, " ").replace(/&#160;/g, " ")
    .replace(/&mdash;/g, "\u2014").replace(/&ndash;/g, "\u2013")
    .replace(/&rsquo;|&#8217;/g, "\u2019").replace(/&lsquo;|&#8216;/g, "\u2018")
    .replace(/&ldquo;|&#8220;/g, "\u201c").replace(/&rdquo;|&#8221;/g, "\u201d")
    .replace(/&hellip;/g, "\u2026").replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function htmlToText(html) {
  return entities(html
    .replace(/<(script|style|figure|figcaption)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|h[1-6]|li|blockquote|div)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

// Path 1
function fromPreloads(html) {
  const m = html.match(/window\._preloads\s*=\s*JSON\.parse\("((?:[^"\\]|\\.)*)"\)/);
  if (!m) return null;
  let obj;
  try { obj = JSON.parse(JSON.parse('"' + m[1] + '"')); } catch { return null; }
  const post = obj.post || obj.pub?.post || null;
  const body = post?.body_html;
  if (!body) return null;
  return { text: htmlToText(body), title: post.title || "", paywalled: !!post.audience && post.audience !== "everyone" };
}

// Path 2
const CHROME = /^(subscribe|share|comment|previous|next|home|archive|about|sign in|log in|get the app|continue reading|discussion about this post|no posts|ready for more|\u00a9 ?\d{4}|privacy|terms|collection notice|start writing|substack)/i;
function fromTags(html) {
  const main = html.split(/<footer/i)[0];
  const blocks = [...main.matchAll(/<(p|h[1-6]|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => htmlToText(m[2]))
    .filter((t) => t && t.length > 1 && !CHROME.test(t.trim()));
  if (!blocks.length) return null;
  return { text: blocks.join("\n\n"), title: "", paywalled: PAYWALL.test(html) };
}

function extract(html) {
  const r = fromPreloads(html) || fromTags(html);
  if (!r) return { text: null, reason: "no body found by either path" };
  if (r.paywalled) return { text: null, reason: "paywalled or subscriber-only" };
  return r;
}


// Publication metadata for the genre tag. Whatever Substack tells us about
// itself goes in the manifest verbatim -- name, author, tagline, and a
// category if the page carries one. We do NOT invent a category from the
// prose: a guessed label in a manifest becomes a fact nobody can trace.
// The genre column is left blank when the page offers nothing, and a blank
// is honest where a guess is not.
function pubMeta(html) {
  const m = html.match(/window\._preloads\s*=\s*JSON\.parse\("((?:[^"\\]|\\.)*)"\)/);
  if (!m) return {};
  let o; try { o = JSON.parse(JSON.parse('"' + m[1] + '"')); } catch { return {}; }
  const pub = o.pub || o.post?.publishedBounty?.publication || o.publication || {};
  const cat = pub.primary_category_name || pub.category_name
    || (Array.isArray(pub.categories) && pub.categories[0]?.name) || "";
  return {
    name: (pub.name || "").replace(/\s+/g, " ").trim(),
    author: (pub.author_name || o.post?.publishedBylines?.[0]?.name || "").replace(/\s+/g, " ").trim(),
    tagline: (pub.hero_text || pub.tagline || "").replace(/\s+/g, " ").trim().slice(0, 160),
    category: String(cat).replace(/\s+/g, " ").trim(),
  };
}

const [cmd, slug, yearArg] = process.argv.slice(2);
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i === -1 ? d : argv[i + 1]; };
const base = slug && slug.includes(".") ? `https://${slug}` : `https://${slug}.substack.com`;

if (cmd === "check") {
  const html = await get(`${base}/sitemap`);
  const years = [...new Set([...html.matchAll(/\/sitemap\/(\d{4})/g)].map((m) => +m[1]))].sort();
  if (!years.length) { console.log(`${slug}: no sitemap years found -- may be a custom domain or private`); process.exit(1); }
  const usable = years.filter((y) => y <= CUTOFF_YEAR - 1);
  console.log(`${slug}: years ${years.join(", ")}`);
  console.log(usable.length ? `  USABLE -- pre-ChatGPT years: ${usable.join(", ")}` : `  SKIP -- nothing before ${CUTOFF_YEAR}`);
}

else if (cmd === "list") {
  const html = await get(`${base}/sitemap/${yearArg}`);
  const urls = [...new Set([...html.matchAll(/href="(https?:\/\/[^"]*\/p\/[^"?#]+)"/g)].map((m) => m[1]))];
  console.log(`${slug} ${yearArg}: ${urls.length} posts`);
  urls.forEach((u) => console.log("  " + u));
}

else if (cmd === "fetch") {
  const n = +opt("--n", 3);
  const out = opt("--out", join("study", "corpus", "substack"));
  mkdirSync(out, { recursive: true });
  const man = openManifest(out);

  const idx = await get(`${base}/sitemap/${yearArg}`);
  const urls = [...new Set([...idx.matchAll(/href="(https?:\/\/[^"]*\/p\/[^"?#]+)"/g)].map((m) => m[1]))].slice(0, n);
  console.log(`${slug} ${yearArg}: taking ${urls.length} of ${n} requested`);

  let i = 0;
  for (const url of urls) {
    const got = extract(await get(url));
    const text = got.text;
    const words = text ? (text.match(/\S+/g) || []).length : 0;
    if (!text) { console.log(`  skip -- ${got.reason}: ${url}`); continue; }
    if (words < 300) { console.log(`  skip -- only ${words} words: ${url}`); continue; }
    i++;
    const name = `${slug.replace(/\W+/g, "")}__${yearArg}__${String(i).padStart(3, "0")}`;
    writeFileSync(join(out, name + ".txt"), text + "\n");
    appendFileSync(man, manifestRow({
      file: name + ".txt", publication: slug, url, year: yearArg, words,
      why_known_human: `Substack post indexed by the publication's own /sitemap/${yearArg}, before ChatGPT public launch 2022-11-30`,
    }));
    console.log(`  ${name}  ${words}w`);
  }
  console.log(`\nwrote ${i} documents to ${out}`);
  console.log(`REVIEW BEFORE MEASURING: open two or three and check the extraction kept`);
  console.log(`em dashes, curly quotes and paragraph breaks, and dropped nav/footer text.`);
}

else if (cmd === "collect") {
  // Build the arm from the profiles table. Broad on purpose: Gregg's call,
  // 2026-09-02 -- collection is slow and one-way, filtering is free and
  // reversible, so collect widely and tag well rather than deciding the genre
  // question at collection time. Every subset is a grep afterwards.
  const CAP = +opt("--cap", 8);
  const MIN_YIELD = +opt("--min-yield", 50);
  const profiles = opt("--profiles", "study/substack-profiles.tsv");
  const out = opt("--out", join("study", "corpus", "substack"));
  mkdirSync(out, { recursive: true });
  const man = openManifest(out);

  const rows = readFileSync(profiles, "utf8").split(/\r?\n/).slice(1)
    .filter((l) => l.trim()).map((l) => l.split("\t"))
    .map((c) => ({ slug: c[0], verdict: c[1], year: +c[2], yield: +c[4] }))
    .filter((r) => r.slug && r.year >= 2000 && r.year <= CUTOFF_YEAR - 1 && r.yield >= MIN_YIELD);

  const done = new Set(readFileSync(man, "utf8").split(/\r?\n/).slice(1)
    .filter(Boolean).map((l) => l.split("\t")[1]));
  const todo = rows.filter((r) => !done.has(r.slug));

  console.log(`${rows.length} publications pass (pre-${CUTOFF_YEAR}, yield >= ${MIN_YIELD}%)`);
  console.log(`${done.size} already collected, ${todo.length} to go, cap ${CAP} posts each`);
  console.log(`estimated ${Math.round(todo.length * (CAP + 4) * DELAY_MS / 60000)} min. Resumable -- rerun after any stop.\n`);

  let total = 0;
  for (const r of todo) {
    const b = r.slug.includes(".") ? `https://${r.slug}` : `https://${r.slug}.substack.com`;
    let urls;
    try {
      const idx = await get(`${b}/sitemap/${r.year}`);
      urls = [...new Set([...idx.matchAll(/href="(https?:\/\/[^"]*\/p\/[^"?#]+)"/g)].map((m) => m[1]))];
    } catch (e) { console.log(`  ${r.slug}: ${String(e.message).slice(0, 40)}`); continue; }

    // Spread across the year rather than taking the newest N, which would
    // sample one season. Evenly spaced indices, deterministic, no seed needed.
    const attempts = Math.min(urls.length, CAP * 3);
    const step = urls.length > attempts ? urls.length / attempts : 1;
    const picks = Array.from({ length: attempts }, (_, i) => urls[Math.floor(i * step)]);

    let meta = null, kept = 0;
    for (const url of picks) {
      if (kept >= CAP) break;
      let html;
      try { html = await get(url); } catch { continue; }
      if (!meta) meta = pubMeta(html);
      const got = extract(html);
      if (!got.text) continue;
      const w = (got.text.match(/\S+/g) || []).length;
      if (w < 300) continue;
      kept++;
      const name = `${r.slug.replace(/[^a-z0-9]/gi, "")}__${r.year}__${String(kept).padStart(2, "0")}`;
      writeFileSync(join(out, name + ".txt"), got.text + "\n");
      appendFileSync(man, manifestRow({
        file: name + ".txt", publication: r.slug, publication_name: meta.name || "",
        author: meta.author || "", genre: meta.category || "", tagline: meta.tagline || "",
        url, year: r.year, words: w,
        why_known_human: `Substack post indexed by the publication's own /sitemap/${r.year}, before ChatGPT public launch 2022-11-30`,
      }));
    }
    total += kept;
    console.log(`  ${r.slug.padEnd(26)} ${String(kept).padStart(2)} kept  ${(meta?.category || "-").padEnd(14)} ${(meta?.name || "").slice(0, 34)}`);
  }

  console.log(`\n${total} documents this run -> ${out}`);
  const inMan = new Set(readFileSync(man, "utf8").split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split("\t")[0]));
  const orphans = readdirSync(out).filter((f) => f.endsWith(".txt") && !inMan.has(f));
  if (orphans.length) console.log(`\n! ${orphans.length} .txt file(s) not in the manifest, from an earlier test: ${orphans.slice(0,3).join(", ")}\n  Delete them -- a corpus file with no manifest row cannot be traced.`);
  console.log(`\nGenre: the manifest carries what each publication says about itself.`);
  console.log(`Blank category means the page offered none -- fill those by hand, do not guess from prose.`);
}

else if (cmd === "recommend") {
  // Snowball: pull who the seeds recommend, and who those recommend, to find
  // publications that existed before 2022. Today's leaderboards are dominated
  // by publications founded 2023+, so guessing slugs off them mostly returns
  // SKIP-too-new. Old publications recommend old publications.
  //
  // ON BIAS. The first version of this comment warned that a snowball sample
  // returns a cluster sharing a house style. Gregg's objection, 2026-09-02:
  // Substack recommendations are a growth product -- when someone subscribes
  // to A they are shown A's recommendations -- so writers trade them for reach.
  // That is a transaction over AUDIENCE, not an endorsement of prose.
  //
  // He is very likely right, and the claim is testable rather than arguable,
  // so this records the edge list and reports reciprocity. High mutual-edge
  // rate supports the trade-network reading. A one-directional pattern
  // pointing at large publications would look more like prestige, and would
  // put the original worry back.
  //
  // The residual risk either way is NICHE concentration, not style: a
  // reciprocal network clusters by overlapping readership, so this can still
  // return thirty health newsletters. That is visible in the category spread
  // and must be checked before the arm is described as genre-matched.
  const seedFile = slug || "study/substack-seeds.txt";
  const outFile = opt("--out", "study/substack-candidates-found.txt");
  const depth = +opt("--depth", 2);

  const seeds = readFileSync(seedFile, "utf8").split(/\r?\n/)
    .map((l) => l.split("#")[0].trim()).filter(Boolean);

  const seen = new Set(seeds);
  const found = new Map();          // slug -> who recommended it
  let frontier = [...seeds];
  const edges = [];
  const crawled = new Set();

  for (let d = 0; d < depth; d++) {
    console.log(`\n-- depth ${d + 1}: expanding ${frontier.length} publication(s) --`);
    const next = [];
    for (const sl of frontier) {
      const b = sl.includes(".") ? `https://${sl}` : `https://${sl}.substack.com`;
      let html;
      try { html = await get(`${b}/recommendations`); }
      catch (e) { console.log(`  ${sl}: ${String(e.message).slice(0, 40)}`); continue; }

      // Recommendation cards link to the recommended publication's home.
      const slugs = [...new Set([...html.matchAll(/https?:\/\/([a-z0-9-]+)\.substack\.com/gi)]
        .map((m) => m[1].toLowerCase()))]
        .filter((x) => !["www", "on", "substack", "open", "support", "team"].includes(x))
        .filter((x) => x !== sl);

      for (const x of slugs) edges.push([sl, x]);
      crawled.add(sl);
      let added = 0;
      for (const x of slugs) {
        if (seen.has(x)) continue;
        seen.add(x); found.set(x, sl); next.push(x); added++;
      }
      console.log(`  ${sl}: ${slugs.length} linked, ${added} new`);
    }
    frontier = next;
    if (!frontier.length) break;
  }

  const lines = ["# Found by snowball from " + seeds.join(", "),
                 "# Column after # is who recommended it. Feed this to profile-all.",
                 "# BIAS: mutually-recommending cluster. See substack.mjs 'recommend'.", ""];
  for (const [sl, from] of found) lines.push(`${sl}   # via ${from}`);
  writeFileSync(outFile, lines.join("\n") + "\n");
  writeFileSync(opt("--edges", "study/substack-edges.tsv"),
    "from\tto\n" + edges.map((e) => e.join("\t")).join("\n") + "\n");

  // Reciprocity is only meaningful between two publications we actually
  // fetched. Leaf nodes at the depth limit were never asked who they
  // recommend, so an edge to them cannot be mutual by construction.
  const set = new Set(edges.map((e) => e.join(">")));
  const testable = edges.filter((e) => crawled.has(e[0]) && crawled.has(e[1]));
  const mutual = testable.filter((e) => set.has(e[1] + ">" + e[0]));
  console.log(`\n${found.size} new publications -> ${outFile}`);
  console.log(`${edges.length} edges -> study/substack-edges.tsv`);
  if (testable.length) {
    const pct = Math.round(mutual.length / testable.length * 100);
    console.log(`\nRECIPROCITY: ${mutual.length} of ${testable.length} testable edges are mutual (${pct}%)`);
    console.log(pct >= 50
      ? `  Supports the trade-network reading: recommendations are being exchanged.`
      : `  Mostly one-directional. Worth looking at whether the targets are the`);
    if (pct < 50) console.log(`  large publications, which would look more like prestige than trade.`);
  } else {
    console.log(`\nRECIPROCITY: no testable edges yet -- both ends of an edge must be crawled.`);
    console.log(`  Raise --depth to get a measurable answer.`);
  }
  console.log(`\nnext: node study/substack.mjs profile-all ${outFile}`);
}

else if (cmd === "profile-all") {
  // One command, a list of slugs, a resumable table. Each publication costs
  // ~7 requests at DELAY_MS apart, so this is slow on purpose -- run it and
  // walk away. Results append as they land, so a 429 loses nothing already done.
  const listFile = slug || "study/substack-candidates.txt";
  const outFile = opt("--out", "study/substack-profiles.tsv");
  const sample = +opt("--n", 4);
  const slugs = readFileSync(listFile, "utf8").split(/\r?\n/)
    .map((l) => l.split("#")[0].trim()).filter(Boolean);

  const done = existsSync(outFile)
    ? new Set(readFileSync(outFile, "utf8").split(/\r?\n/).slice(1).map((l) => l.split("\t")[0]))
    : new Set();
  if (!existsSync(outFile)) writeFileSync(outFile,
    "slug\tverdict\tyear\tposts_that_year\tyield_pct\tok\tgated\tshort\tmedian_words\tclaim_sentences\tspecificity\n");

  console.log(`${slugs.length} slugs, ${done.size} already done, ~${Math.round(slugs.length*sample*DELAY_MS*1.5/60000)} min remaining\n`);

  for (const sl of slugs) {
    if (done.has(sl)) { console.log(`  - ${sl} (already done)`); continue; }
    const b = sl.includes(".") ? `https://${sl}` : `https://${sl}.substack.com`;
    let row;
    try {
      const sm = await get(`${b}/sitemap`);
      const years = [...new Set([...sm.matchAll(/\/sitemap\/(\d{4})/g)].map((m) => +m[1]))].sort();
      const usable = years.filter((y) => y <= CUTOFF_YEAR - 1);
      if (!usable.length) {
        row = [sl, "SKIP-too-new", years.join(",") || "none", "", "", "", "", "", "", "", ""];
      } else {
        const year = usable[usable.length - 1];
        const idx = await get(`${b}/sitemap/${year}`);
        const all = [...new Set([...idx.matchAll(/href="(https?:\/\/[^"]*\/p\/[^"?#]+)"/g)].map((m) => m[1]))];
        let ok = 0, gated = 0, short = 0;
        const w = [], c = [], sp = [];
        for (const url of all.slice(0, sample)) {
          const got = extract(await get(url));
          if (!got.text) { /paywall|subscriber/.test(got.reason) ? gated++ : short++; continue; }
          const m = measureDoc(got.text);
          if (m.words < 300) { short++; continue; }
          ok++; w.push(m.words); c.push(m.counts.claim_sentences);
          sp.push((m.counts.numerals + m.counts.proper_nouns) / m.words * 1000);
        }
        const med = (a) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0;
        const tried = Math.min(sample, all.length);
        const y = tried ? Math.round(ok / tried * 100) : 0;
        const claimy = med(c);
        const verdict = y < 60 ? "SKIP-too-gated" : claimy < 1 ? "WEAK-no-claims" : "CANDIDATE";
        row = [sl, verdict, year, all.length, y, ok, gated, short, med(w), claimy, med(sp).toFixed(0)];
      }
    } catch (e) {
      row = [sl, "ERROR", String(e.message).slice(0, 60), "", "", "", "", "", "", "", ""];
    }
    appendFileSync(outFile, row.join("\t") + "\n");
    console.log("  " + row.slice(0, 6).join("\t"));
  }
  console.log(`\nwrote ${outFile}`);
  console.log(`sort it: CANDIDATE rows first, then look at claim_sentences.`);
}

else if (cmd === "profile") {
  // Triage a candidate publication in one run: is it old enough, how much of
  // it is actually readable, and does it make claims?
  //
  // Yield matters because newsletters gate their best work, and what is left
  // free may be systematically the least claim-making writing they do. Genre
  // matters because a recipe archive and a lyric-essay archive will both pass
  // a date check and neither is a comparison arm for explanatory prose.
  const sample = +opt("--n", 5);
  const sm = await get(`${base}/sitemap`);
  const years = [...new Set([...sm.matchAll(/\/sitemap\/(\d{4})/g)].map((m) => +m[1]))].sort();
  const usableYears = years.filter((y) => y <= CUTOFF_YEAR - 1);
  if (!usableYears.length) { console.log(`${slug}\tSKIP\tno pre-${CUTOFF_YEAR} years (${years.join(",") || "none"})`); process.exit(0); }

  const year = usableYears[usableYears.length - 1];
  const idx = await get(`${base}/sitemap/${year}`);
  const all = [...new Set([...idx.matchAll(/href="(https?:\/\/[^"]*\/p\/[^"?#]+)"/g)].map((m) => m[1]))];
  const urls = all.slice(0, sample);

  let ok = 0, gated = 0, empty = 0;
  const words = [], claims = [], spec = [];
  for (const url of urls) {
    const got = extract(await get(url));
    if (!got.text) { /paywall|subscriber/.test(got.reason) ? gated++ : empty++; continue; }
    const m = measureDoc(got.text);
    if (m.words < 300) { empty++; continue; }
    ok++;
    words.push(m.words);
    claims.push(m.counts.claim_sentences);
    spec.push((m.counts.numerals + m.counts.proper_nouns) / m.words * 1000);
  }
  const med = (a) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0;
  const yield_ = urls.length ? Math.round(ok / urls.length * 100) : 0;
  const claimy = med(claims);
  const verdict = yield_ < 60 ? "SKIP -- too gated"
                : claimy < 1 ? "WEAK -- makes no evidence claims"
                : "CANDIDATE";
  console.log([slug, verdict, `${year}`, `${all.length} posts that year`,
    `yield ${yield_}% (${ok} ok / ${gated} gated / ${empty} short)`,
    `median ${med(words)}w`, `claim sentences ${claimy}`, `specificity ${med(spec).toFixed(0)}`].join("\t"));
}

else if (cmd === "debug") {
  // Saves raw HTML so the markup can be inspected without guessing at it.
  const url = yearArg && yearArg.startsWith("http") ? yearArg
    : (await (async () => { const idx = await get(`${base}/sitemap/${yearArg || 2021}`);
        return [...idx.matchAll(/href="(https?:\/\/[^"]*\/p\/[^"?#]+)"/g)][0]?.[1]; })());
  if (!url) { console.log("no post url found"); process.exit(1); }
  const html = await get(url);
  const out = `study/substack-debug.html`;
  writeFileSync(out, html);
  console.log(`saved ${(html.length/1024).toFixed(0)} KB of raw HTML from ${url}`);
  console.log(`  -> ${out}`);
  console.log(`  has window._preloads: ${/window\._preloads/.test(html)}`);
  console.log(`  has available-content: ${/available-content/.test(html)}`);
  const got = extract(html);
  console.log(`  extractor says: ${got.text ? (got.text.match(/\S+/g)||[]).length + " words" : got.reason}`);
  if (got.text) console.log(`\n--- first 300 chars ---\n${got.text.slice(0,300)}`);
}

else {
  console.log(`usage:
  node study/substack.mjs check <slug>
  node study/substack.mjs list  <slug> <year>
  node study/substack.mjs fetch <slug> <year> --n 3 --out study/corpus/substack\n  node study/substack.mjs profile <slug> [--n 5]   (triage one)\n  node study/substack.mjs profile-all [list.txt]   (triage many, resumable)\n  node study/substack.mjs collect [--cap 8] [--min-yield 50]   (build the arm, resumable)\n  node study/substack.mjs recommend [seeds.txt] [--depth 2]  (snowball for candidates)\n  node study/substack.mjs debug <slug> <year|url>   (saves raw HTML to inspect)

A per-PUBLICATION cap is not built in yet, deliberately. Decide the number of
posts per publication (--n) by hand until the arm is designed. The cap in
collect-human.mjs is per FILE and would do nothing here.`);
}
