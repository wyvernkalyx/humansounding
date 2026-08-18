// Reads .env from the repository root into process.env.
//
// Deliberately does not override variables that are already set, so GitHub
// Actions secrets always win over a stale local file. Resolved against this
// file rather than the shell's cwd, so scripts work from any directory.
//
// Not a dotenv replacement. It handles KEY=value, comments and quotes, which
// is all this repository needs and one less dependency to audit.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname. On Windows .pathname yields "/D:/repo/.env",
// which is not a path any Windows API accepts and which join() then glues onto
// the cwd. This bit us on 2026-08-18 and it will bit us again if anyone
// "simplifies" it back.
export const ENV_PATH = fileURLToPath(new URL("../.env", import.meta.url));

export function loadEnv() {
  if (!existsSync(ENV_PATH)) return false;
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v !== "" && process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
  return true;
}
