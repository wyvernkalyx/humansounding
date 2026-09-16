// study/perceived/load.mjs — put the passage packet into the database.
//
//   node study/perceived/load.mjs            # insert anything not already there
//   node study/perceived/load.mjs --dry      # say what it would do, write nothing
//
// The passages live in Postgres and not in this repo because packet.json embeds
// 60 third-party human passages verbatim — the same rule that keeps
// study/corpus/*/*.txt and study/slop/label.html off a public GitHub — and
// because it is the answer key.
//
// Rerunning is safe. packet_id is unique and this inserts with an ignore-on-
// conflict, so a second run against an unchanged packet writes nothing and a
// rebuilt packet adds only what is new. It never updates or deletes: a passage
// that has already been judged must not change underneath its judgments.
//
// Needs SUPABASE_SERVICE_ROLE_KEY in .env. That key bypasses row-level security
// and must never reach a browser; it is read here and nowhere else in the
// perceived-axis code.

import { readFileSync, existsSync } from "node:fs";

const PROJECT = "mrkvxxmzekasxtpscawj";
const REST = `https://${PROJECT}.supabase.co/rest/v1/perceived_passages`;
const DRY = process.argv.includes("--dry");
const src = process.argv.includes("--in") ? process.argv[process.argv.indexOf("--in") + 1]
                                          : "study/perceived/packet.json";

// .env is a flat KEY=VALUE file; no dependency needed to read one line out of it.
function envKey(name) {
  if (process.env[name]) return process.env[name];
  if (!existsSync(".env")) return "";
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && m[1] === name) return m[2].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const KEY = envKey("SUPABASE_SERVICE_ROLE_KEY");
if (!KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set in .env or the environment.");
  console.error("Supabase dashboard -> Project Settings -> API -> service_role. It is a secret; .env is gitignored.");
  process.exit(1);
}
if (!existsSync(src)) {
  console.error(`${src} not found. Run: node study/perceived/packet.mjs`);
  process.exit(1);
}

const packet = JSON.parse(readFileSync(src, "utf8"));
const rows = packet.passages.map((p) => ({
  packet_id: p.id, arm: p.arm, stratum: p.stratum, genre: p.genre, words: p.words, body: p.text,
}));

const byStratum = {};
for (const r of rows) byStratum[r.stratum] = (byStratum[r.stratum] || 0) + 1;
console.log(`${src}: ${rows.length} passages, seed ${packet.seed}, built ${packet.built}`);
for (const [k, v] of Object.entries(byStratum)) console.log(`  ${k}: ${v}`);
if (DRY) { console.log("\n--dry: nothing written.\n"); process.exit(0); }

// Chunked so one oversized request cannot fail the whole load. Prefer=ignore-
// duplicates makes each chunk idempotent on packet_id.
let sent = 0;
for (let i = 0; i < rows.length; i += 25) {
  const chunk = rows.slice(i, i + 25);
  const res = await fetch(REST, {
    method: "POST",
    headers: {
      apikey: KEY,
      authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
      prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify(chunk),
  });
  if (!res.ok) {
    console.error(`chunk at ${i} failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  sent += (await res.json()).length;
}
console.log(`\ninserted ${sent} new passage${sent === 1 ? "" : "s"} (${rows.length - sent} already present).\n`);
