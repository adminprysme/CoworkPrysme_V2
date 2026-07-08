#!/usr/bin/env node
/**
 * Live proof: PATCH heroImages removes orphaned files from disk after Mongo succeeds.
 */
import { access, mkdtemp, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import sharp from "sharp";

const backendRoot = new URL("..", import.meta.url).pathname;
process.chdir(backendRoot);

const env = { ...process.env };
if (!env.SESSION_SECRET) {
  console.error("Load apps/gestion/Backend/.env first (SESSION_SECRET required)");
  process.exit(1);
}

const uploadsDir = env.UPLOADS_DIR?.trim() || join(backendRoot, "../../../uploads");

console.log("=== vitest: PATCH heroImages orphan cleanup ===");
const testRun = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "src/vitrine-content/vitrine-content.service.test.ts", "-t", "PATCH heroImages"],
  { encoding: "utf8", stdio: "inherit", env },
);
if (testRun.status !== 0) {
  process.exit(testRun.status ?? 1);
}

const tokenResult = spawnSync("node", ["scripts/demo-session.mjs"], {
  encoding: "utf8",
  env,
});
if (tokenResult.status !== 0) {
  console.error(tokenResult.stderr || tokenResult.stdout);
  process.exit(1);
}
const token = tokenResult.stdout.trim();

const tmp = await mkdtemp(join(tmpdir(), "vitrine-patch-live-"));
const imagePath = join(tmp, "probe.webp");
await sharp({
  create: { width: 8, height: 8, channels: 3, background: "#884422" },
})
  .webp()
  .toFile(imagePath);

async function curlJson(args) {
  const result = spawnSync("curl", args, { encoding: "utf8", env });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result.stdout;
}

console.log("\n=== live curl: PATCH heroImages removes file from volume ===");
const getBefore = JSON.parse(
  await curlJson(["-sS", "-b", `gestion_sid=${token}`, "http://127.0.0.1:8003/admin/vitrine-content"]),
);

const orphanKey = "vitrine/hero/aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee.webp";
const orphanAbsolute = join(uploadsDir, orphanKey);
await mkdir(dirname(orphanAbsolute), { recursive: true });
await writeFile(orphanAbsolute, "orphan-probe");

const heroImagesWithOrphan = [...getBefore.heroImages, orphanKey];
const patchBody = JSON.stringify({ heroImages: heroImagesWithOrphan });

await curlJson([
  "-sS",
  "-b",
  `gestion_sid=${token}`,
  "-X",
  "PATCH",
  "-H",
  "Content-Type: application/json",
  "-d",
  patchBody,
  "http://127.0.0.1:8003/admin/vitrine-content",
]);

console.log("seeded orphan on volume:", orphanKey);
await expectFile(orphanAbsolute, true);

const keptOnly = getBefore.heroImages;
const removeOrphanBody = JSON.stringify({ heroImages: keptOnly });
const patchResult = spawnSync(
  "curl",
  [
    "-sS",
    "-b",
    `gestion_sid=${token}`,
    "-X",
    "PATCH",
    "-H",
    "Content-Type: application/json",
    "-d",
    removeOrphanBody,
    "-w",
    "\nHTTP %{http_code}\n",
    "http://127.0.0.1:8003/admin/vitrine-content",
  ],
  { encoding: "utf8", env },
);
console.log(patchResult.stdout);
if (!/HTTP 20\d/.test(patchResult.stdout)) {
  process.exit(1);
}

await expectFile(orphanAbsolute, false);
const heroFiles = await readdir(join(uploadsDir, "vitrine", "hero"));
console.log("hero files after PATCH:", heroFiles);
console.log("orphan filename absent:", !heroFiles.includes("aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee.webp"));

await rm(tmp, { recursive: true, force: true });
console.log("\nPASS: PATCH heroImages orphan cleanup verified (vitest + live ls)");

async function expectFile(absolutePath, shouldExist) {
  try {
    await access(absolutePath);
    if (!shouldExist) {
      console.error("FAIL: file still exists:", absolutePath);
      process.exit(1);
    }
  } catch {
    if (shouldExist) {
      console.error("FAIL: expected file missing:", absolutePath);
      process.exit(1);
    }
  }
}
