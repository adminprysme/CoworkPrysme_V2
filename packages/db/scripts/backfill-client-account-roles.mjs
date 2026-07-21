#!/usr/bin/env node
/**
 * Backfill ClientAccount.role on cowork_bdd (idempotent).
 *
 * Rules (validated):
 * - role = "owner"  iff ClientAccount._id is referenced by some Cardex.clientAccountId
 * - role = "member" iff account has cardexId pointing to a cardex where they are NOT
 *   that cardex's clientAccountId
 *
 * Accounts matching neither rule are reported and left unchanged (should be 0 in prod).
 *
 * Usage (from packages/db or repo root with env loaded):
 *   node --input-type=module packages/db/scripts/backfill-client-account-roles.mjs
 *   DRY_RUN=1 …  → count only, no writes
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function loadEnv(path) {
  try {
    for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
      if (!raw || raw.trimStart().startsWith("#")) continue;
      const eq = raw.indexOf("=");
      if (eq <= 0) continue;
      const key = raw.slice(0, eq).trim();
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
  } catch {
    // optional path
  }
}

loadEnv(resolve(here, "../../../apps/gestion/Backend/.env"));
loadEnv(resolve(here, "../../../.env"));

const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const { connectMongo, getClientAccountModel, getCardexModel } = await import("../dist/index.js");

await connectMongo();
const ClientAccount = await getClientAccountModel();
const Cardex = await getCardexModel();

const ownerIds = await Cardex.distinct("clientAccountId");
const ownerIdSet = new Set(ownerIds.map((id) => String(id)));

const accounts = await ClientAccount.find({})
  .select({ _id: 1, cardexId: 1, role: 1, email: 1 })
  .lean()
  .exec();

const cardexById = new Map(
  (
    await Cardex.find({})
      .select({ _id: 1, clientAccountId: 1 })
      .lean()
      .exec()
  ).map((c) => [String(c._id), c]),
);

const toOwner = [];
const toMember = [];
const unclassified = [];
const alreadyCorrect = [];

for (const account of accounts) {
  const id = String(account._id);
  const isOwner = ownerIdSet.has(id);
  let target = null;
  if (isOwner) {
    target = "owner";
  } else if (account.cardexId) {
    const cardex = cardexById.get(String(account.cardexId));
    if (cardex && String(cardex.clientAccountId) !== id) {
      target = "member";
    }
  }

  if (!target) {
    unclassified.push({ id, email: account.email, cardexId: account.cardexId ?? null });
    continue;
  }

  if (account.role === target) {
    alreadyCorrect.push(id);
    continue;
  }

  if (target === "owner") toOwner.push(account._id);
  else toMember.push(account._id);
}

const summary = {
  dryRun,
  totalAccounts: accounts.length,
  cardexOwnerRefs: ownerIds.length,
  wouldSetOwner: toOwner.length,
  wouldSetMember: toMember.length,
  alreadyCorrect: alreadyCorrect.length,
  unclassified: unclassified.length,
  unclassifiedSample: unclassified.slice(0, 10),
};

console.log(JSON.stringify(summary, null, 2));

if (unclassified.length > 0) {
  console.error(
    `ABORT: ${unclassified.length} account(s) match neither owner nor member rule — fix data before backfill.`,
  );
  process.exit(2);
}

if (dryRun) {
  console.log("DRY_RUN=1 — no writes.");
  process.exit(0);
}

if (toOwner.length > 0) {
  const r = await ClientAccount.updateMany({ _id: { $in: toOwner } }, { $set: { role: "owner" } });
  console.log(`updated owner: matched=${r.matchedCount} modified=${r.modifiedCount}`);
}
if (toMember.length > 0) {
  const r = await ClientAccount.updateMany({ _id: { $in: toMember } }, { $set: { role: "member" } });
  console.log(`updated member: matched=${r.matchedCount} modified=${r.modifiedCount}`);
}

const after = await ClientAccount.aggregate([
  { $group: { _id: "$role", count: { $sum: 1 } } },
  { $sort: { _id: 1 } },
]);
const missingRole = await ClientAccount.countDocuments({
  $or: [{ role: { $exists: false } }, { role: null }],
});
console.log(JSON.stringify({ roleDistribution: after, missingRole }, null, 2));

if (missingRole > 0) {
  console.error("ABORT: some accounts still missing role after backfill");
  process.exit(3);
}

process.exit(0);
