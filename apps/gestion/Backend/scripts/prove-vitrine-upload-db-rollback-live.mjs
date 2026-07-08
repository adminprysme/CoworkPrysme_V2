#!/usr/bin/env node
/**
 * Forces a real upload + DB failure after the file is written, then verifies rollback via ls.
 * Uses the same UploadsService/VitrineContentService code path as production (no HTTP).
 */
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const backendRoot = new URL("..", import.meta.url).pathname;
process.chdir(backendRoot);

const env = { ...process.env };
if (!env.SESSION_SECRET) {
  console.error("Load apps/gestion/Backend/.env first");
  process.exit(1);
}

const proveDir = await mkdtemp(join(tmpdir(), "vitrine-prove-rollback-"));
env.PROVE_UPLOADS_DIR = proveDir;

console.log("=== live service: upload then DB failure (real filesystem) ===");
console.log("prove uploads dir:", proveDir);

const testRun = spawnSync(
  "pnpm",
  [
    "exec",
    "vitest",
    "run",
    "src/vitrine-content/vitrine-content.service.test.ts",
    "-t",
    "rolls back the new hero file when findByIdAndUpdate fails",
  ],
  { encoding: "utf8", stdio: "inherit", env: { ...env, PROVE_UPLOADS_DIR: proveDir } },
);
if (testRun.status !== 0) {
  await rm(proveDir, { recursive: true, force: true });
  process.exit(testRun.status ?? 1);
}

const heroDir = join(proveDir, "vitrine", "hero");
let heroFiles = [];
try {
  heroFiles = await readdir(heroDir);
} catch {
  heroFiles = [];
}

console.log("ls after failed DB update:", heroFiles.length ? heroFiles : "(empty)");
if (heroFiles.some((name) => name.endsWith(".webp"))) {
  console.error("FAIL: webp file still on volume after rollback");
  process.exit(1);
}

try {
  await access(heroDir);
  console.log("hero directory exists but contains no uploaded webp — rollback OK");
} catch {
  console.log("hero directory absent — rollback OK");
}

await rm(proveDir, { recursive: true, force: true });
console.log("PASS: live filesystem rollback verified");
