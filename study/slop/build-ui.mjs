#!/usr/bin/env node
// Builds label.html, the blind labelling UI, from SLOP-KEY.tsv + the corpora.
// Order and passage numbers come from the key, so the UI and SLOP-READ-THIS.txt
// can never disagree. The UI is given n, word count and text -- never the arm.
//
//   node study/slop/build-ui.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const CORPUS = join(here, "..", "corpus");

const rows = readFileSync(join(here, "SLOP-KEY.tsv"), "utf8").trim().split(/\r?\n/).slice(1)
  .map((l) => { const [n, file, arm, authorship, words] = l.split("\t"); return { n, file, arm, words }; });

const passages = rows.map((r) => ({
  n: Number(r.n),
  words: Number(r.words),
  text: readFileSync(join(CORPUS, r.arm, r.file), "utf8").trim(),
}));

const json = JSON.stringify(passages)
  .replace(/</g, "\\u003c")               // cannot close the host <script>
  .replace(/[\u2028\u2029]/g, (m) => m === "\u2028" ? "\\u2028" : "\\u2029");

const html = readFileSync(join(here, "label-template.html"), "utf8")
  .replace("/*__PASSAGES__*/", json);

writeFileSync(join(here, "label.html"), html);
console.log(`label.html built: ${passages.length} passages, ${(html.length / 1024).toFixed(0)} KB`);
console.log(`no arm or authorship is present in the file:`,
  !/\bai-gemini\b|\bai-openai\b|authorship/.test(html) ? "confirmed" : "!! CHECK IT");
