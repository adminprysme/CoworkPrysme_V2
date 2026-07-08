#!/usr/bin/env node
/**
 * Live proof for upload rollback on DB failure:
 * 1) vitest with real sharp + temp volume (deleteVitrineImageFile + ls)
 * 2) service upload with simulated DB failure + ls on real temp volume
 * 3) API upload happy path persists file on volume
 */
import { readdir, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import sharp from "sharp";

const backendRoot = new URL("..", import.meta.url).pathname;
process.chdir(backendRoot);

const env = { ...process.env };
if (!env.SESSION_SECRET) {
  console.error("Load apps/gestion/Backend/.env first (SESSION_SECRET required)");
  process.exit(1);
}

const uploadsDir = env.UPLOADS_DIR?.trim() || join(backendRoot, "../../../uploads");
const heroDir = join(uploadsDir, "vitrine", "hero");

console.log("=== vitest: DB failure rollback (real volume in temp dir) ===");
const testRun = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "src/vitrine-content/vitrine-content.service.test.ts"],
  { encoding: "utf8", stdio: "inherit", env },
);
if (testRun.status !== 0) {
  process.exit(testRun.status ?? 1);
}

console.log("\n=== live service: upload + DB failure + ls (real filesystem) ===");
const liveRun = spawnSync("node", ["scripts/prove-vitrine-upload-db-rollback-live.mjs"], {
  encoding: "utf8",
  stdio: "inherit",
  env,
});
if (liveRun.status !== 0) {
  process.exit(liveRun.status ?? 1);
}

console.log("\n=== live curl: successful hero upload ===");
const tokenResult = spawnSync("node", ["scripts/demo-session.mjs"], {
  encoding: "utf8",
  env,
});
if (tokenResult.status !== 0) {
  console.error(tokenResult.stderr || tokenResult.stdout);
  process.exit(1);
}
const token = tokenResult.stdout.trim();

const tmp = await mkdtemp(join(tmpdir(), "vitrine-live-upload-"));
const imagePath = join(tmp, "probe.webp");
await sharp({
  create: { width: 8, height: 8, channels: 3, background: "#224488" },
})
  .webp()
  .toFile(imagePath);

const curlOk = spawnSync(
  "curl",
  [
    "-sS",
    "-b",
    `gestion_sid=${token}`,
    "-F",
    `file=@${imagePath}`,
    "-w",
    "\nHTTP %{http_code}\n",
    "http://127.0.0.1:8003/admin/vitrine-content/images/hero",
  ],
  { encoding: "utf8", env },
);
console.log(curlOk.stdout);
if (!/HTTP 20\d/.test(curlOk.stdout)) {
  console.error("Expected HTTP 2xx for successful upload");
  process.exit(1);
}

const heroFinal = await readdir(heroDir);
console.log("hero files on volume:", heroFinal.length);

await rm(tmp, { recursive: true, force: true });
console.log("\nPASS: rollback tests + live filesystem proof + API upload complete");
