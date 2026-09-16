#!/usr/bin/env node
// study/perceived/fixture/stub.mjs — a fake PostgREST for testing perceived.mjs
// without touching the live project or needing a service-role key.
//
//   node study/perceived/fixture/gen.mjs            # writes the two json files
//   node study/perceived/fixture/stub.mjs &         # serves them on :8899
//   PERCEIVED_REST=http://127.0.0.1:8899 node study/perceived.mjs --force
//
// IT READS THE FIXTURE ONCE, AT STARTUP. Regenerating the json while it runs
// changes nothing and the analysis will quietly report the previous fixture's
// numbers. Restart it between cases. (Cost an hour on 2026-09-16.)
//
// Synthetic rows only. No third-party text goes anywhere near this.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const here = new URL(".", import.meta.url).pathname;
const passages  = JSON.parse(readFileSync(here + "passages.json", "utf8"));
const judgments = JSON.parse(readFileSync(here + "judgments.json", "utf8"));

createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const table = u.pathname.split("/").filter(Boolean).pop();
  const body = table === "perceived_passages" ? passages
             : table === "perceived_judgments" ? judgments : [];
  const off = Number(u.searchParams.get("offset") || 0);
  const lim = Number(u.searchParams.get("limit") || 1000);
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body.slice(off, off + lim)));
}).listen(8899, () => console.error("fixture stub on :8899"));
