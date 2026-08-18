// Reads .env from the repository root into process.env.
//
// Deliberately does not override variables that are already set, so GitHub
// Actions secrets always win over a stale local file. Resolved against this
// file rather than the shell's cwd, so scripts work from any directory.
//
// Not a dotenv replacement. It handles KEY=value, comments and quotes, which
// is all this repository needs and one less dependency to audit.

import { readFileSync, existsSync } from "node:fs";

export function loadEnv() {
  const path = new URL("../.env", import.meta.url).pathname;
  if (!existsSync(path)) return false;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v !== "" && process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
  return true;
}
