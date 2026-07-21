#!/usr/bin/env node
/**
 * Load Backend/.env with a proper parser (supports spaces / UTF-8) then exec argv.
 * Avoids `set -a && . ./.env` which truncates unquoted values containing spaces
 * (e.g. INVOICE_ISSUER_LEGAL_NAME=CG Développement → LEGAL_NAME lost).
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

function loadEnvFile(path) {
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    if (!raw || raw.trimStart().startsWith("#")) continue;
    const eq = raw.indexOf("=");
    if (eq <= 0) continue;
    const key = raw.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = raw.slice(eq + 1);
    if (!val.trimStart().startsWith('"') && !val.trimStart().startsWith("'")) {
      const hash = val.indexOf(" #");
      if (hash >= 0) val = val.slice(0, hash);
    }
    val = val.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile(envPath);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-with-env.mjs <command> [...args]");
  process.exit(1);
}

const child = spawn(args[0], args.slice(1), {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
