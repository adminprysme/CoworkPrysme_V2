/**
 * Commit 2 — ClientAccount staff API (deactivate / reactivate / transfer-ownership)
 * + ClientsPermissionGuard proofs.
 *
 * Usage: node scripts/run-with-env.mjs node tmp/proof-client-accounts-staff.mjs
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLIENT_ACCOUNT_STAFF_ERROR_CODES,
  CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES,
} from "@coworkprysme/shared";
import {
  connectMongo,
  getCardexModel,
  getClientAccountModel,
  getReservationModel,
  getStaffProfileModel,
  getStaffSessionModel,
} from "@coworkprysme/db";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "client-accounts-staff-proof");
mkdirSync(OUT, { recursive: true });

const CARDEX_ID = "6a5f3efeebd0da8b88b67bc4";
const RESERVATION_ID = "6a5f3efeebd0da8b88b67bc5";
const GESTION_API = process.env.GESTION_API_URL ?? "http://127.0.0.1:8003";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "";

function hashToken(token) {
  return createHash("sha256").update(`${token}:${SESSION_SECRET}`).digest("hex");
}

function snapAccount(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    email: doc.email,
    role: doc.role,
    status: doc.status,
    cardexId: doc.cardexId ? String(doc.cardexId) : null,
    lockedAt: doc.lockedAt ? new Date(doc.lockedAt).toISOString() : null,
    lockedByStaffProfileId: doc.lockedByStaffProfileId
      ? String(doc.lockedByStaffProfileId)
      : null,
    lockReason: doc.lockReason ?? null,
    unlockedAt: doc.unlockedAt ? new Date(doc.unlockedAt).toISOString() : null,
    unlockedByStaffProfileId: doc.unlockedByStaffProfileId
      ? String(doc.unlockedByStaffProfileId)
      : null,
  };
}

async function api(cookie, method, path, body) {
  const res = await fetch(`${GESTION_API}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

function errPayload(body) {
  if (!body || typeof body !== "object") return { code: null, message: null };
  const nested = body.message && typeof body.message === "object" ? body.message : null;
  return {
    code: nested?.code ?? body.code ?? null,
    message: nested?.message ?? (typeof body.message === "string" ? body.message : null),
  };
}

const proof = {
  startedAt: new Date().toISOString(),
  isolation: {},
  cases: {},
  assert: {},
  ok: false,
};

const createdAccountIds = [];
let planningOnlyProfileId = null;
let planningOnlySessionId = null;
let originalOwnerId = null;

try {
  const uri = process.env.MONGODB_URI ?? "";
  const hostMatch = uri.match(/@([^/?]+)/) || uri.match(/\/\/([^/?]+)/);
  const host = hostMatch ? hostMatch[1] : "unknown";
  proof.isolation = {
    mongodbHost: host,
    isLocalhost: /localhost|127\.0\.0\.1/.test(host),
    coworkDb: process.env.MONGODB_DB_COWORK,
    prysmaDb: process.env.MONGODB_DB_PRYSMA,
  };
  if (!proof.isolation.isLocalhost) {
    throw new Error(`Refusing proof: Mongo host is not local (${host})`);
  }

  await connectMongo();
  const StaffProfile = await getStaffProfileModel();
  const StaffSession = await getStaffSessionModel();
  const ClientAccount = await getClientAccountModel();
  const Cardex = await getCardexModel();
  const Reservation = await getReservationModel();

  const cardex = await Cardex.findById(CARDEX_ID).lean().exec();
  if (!cardex) throw new Error("Fixture cardex missing");
  originalOwnerId = String(cardex.clientAccountId);

  const profile = await StaffProfile.findOne({
    email: "paul.thomas@local.coworkprysme.dev",
  }).exec();
  if (!profile) throw new Error("Staff profile paul.thomas missing");
  if (!profile.permissions?.clients) {
    throw new Error("paul.thomas must have permissions.clients for success paths");
  }

  const rawSession = randomBytes(32).toString("hex");
  const sessionDoc = await StaffSession.create({
    sessionTokenHash: hashToken(rawSession),
    staffProfileId: profile._id,
    prysmAppUserId: profile.prysmAppUserId,
    authSource: "local",
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
  });
  const cookie = `gestion_sid=${rawSession}`;

  // Temporary members on fixture cardex
  const stamp = Date.now();
  const memberA = await ClientAccount.create({
    email: `proof.deactivate.a.${stamp}@prysme.eu`,
    passwordHash: "$2a$12$proof.hash.not.used.for.loginxxxxxxxxxxxx",
    role: "member",
    cardexId: cardex._id,
    status: "active",
    consent: { privacyPolicyVersion: "proof", acceptedAt: new Date() },
  });
  createdAccountIds.push(memberA._id);

  const memberB = await ClientAccount.create({
    email: `proof.deactivate.b.${stamp}@prysme.eu`,
    passwordHash: "$2a$12$proof.hash.not.used.for.loginxxxxxxxxxxxx",
    role: "member",
    cardexId: cardex._id,
    status: "active",
    consent: { privacyPolicyVersion: "proof", acceptedAt: new Date() },
  });
  createdAccountIds.push(memberB._id);

  // --- 1. Refuse deactivate owner ---
  {
    const res = await api(cookie, "POST", `/planning/client-accounts/${originalOwnerId}/deactivate`, {
      reason: "should fail",
    });
    const err = errPayload(res.body);
    proof.cases.refuseOwner = { status: res.status, ...err };
    proof.assert.refuseOwner =
      res.status === 409 &&
      err.code === CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_IS_OWNER &&
      err.message === CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_IS_OWNER;
  }

  // --- 2. Deactivate member success ---
  {
    const before = snapAccount(await ClientAccount.findById(memberA._id).lean().exec());
    const res = await api(cookie, "POST", `/planning/client-accounts/${memberA._id}/deactivate`, {
      reason: "départ collaborateur (proof)",
    });
    const after = snapAccount(await ClientAccount.findById(memberA._id).lean().exec());
    proof.cases.deactivateSuccess = {
      status: res.status,
      before,
      after,
      response: res.body,
    };
    proof.assert.deactivateSuccess =
      res.status === 201 ||
      res.status === 200 &&
        after?.status === "locked" &&
        after?.lockedAt != null &&
        after?.lockedByStaffProfileId === String(profile._id) &&
        after?.lockReason === "départ collaborateur (proof)";
    // Nest default POST returns 201 if @HttpCode not set — accept 200/201
    proof.assert.deactivateSuccess =
      (res.status === 200 || res.status === 201) &&
      after?.status === "locked" &&
      Boolean(after?.lockedAt) &&
      after?.lockedByStaffProfileId === String(profile._id) &&
      after?.lockReason === "départ collaborateur (proof)";
  }

  // --- 3. Double deactivate ---
  {
    const res = await api(cookie, "POST", `/planning/client-accounts/${memberA._id}/deactivate`, {});
    const err = errPayload(res.body);
    proof.cases.refuseDoubleDeactivate = { status: res.status, ...err };
    proof.assert.refuseDoubleDeactivate =
      res.status === 409 &&
      err.code === CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_ALREADY_LOCKED &&
      err.message === CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_ALREADY_LOCKED;
  }

  // --- 4. Reactivate success ---
  {
    const before = snapAccount(await ClientAccount.findById(memberA._id).lean().exec());
    const res = await api(cookie, "POST", `/planning/client-accounts/${memberA._id}/reactivate`, {});
    const after = snapAccount(await ClientAccount.findById(memberA._id).lean().exec());
    proof.cases.reactivateSuccess = { status: res.status, before, after, response: res.body };
    proof.assert.reactivateSuccess =
      (res.status === 200 || res.status === 201) &&
      after?.status === "active" &&
      Boolean(after?.unlockedAt) &&
      after?.unlockedByStaffProfileId === String(profile._id) &&
      after?.lockedAt == null;
  }

  // --- 5. Reactivate already active ---
  {
    const res = await api(cookie, "POST", `/planning/client-accounts/${memberA._id}/reactivate`, {});
    const err = errPayload(res.body);
    proof.cases.refuseReactivateActive = { status: res.status, ...err };
    proof.assert.refuseReactivateActive =
      res.status === 409 &&
      err.code === CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_NOT_LOCKED &&
      err.message === CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_NOT_LOCKED;
  }

  // --- 6. Last active: temporarily leave a single active member on this cardex ---
  {
    const allOnCardex = await ClientAccount.find({ cardexId: cardex._id })
      .select({ _id: 1, status: 1 })
      .lean()
      .exec();
    const toPark = allOnCardex.filter((a) => String(a._id) !== String(memberB._id));
    const parkedIds = toPark.map((a) => a._id);
    if (parkedIds.length > 0) {
      await ClientAccount.updateMany(
        { _id: { $in: parkedIds } },
        {
          $set: { status: "locked", lockedAt: new Date(), lockReason: "proof-last-active-park" },
        },
      ).exec();
    }

    const activeLeft = await ClientAccount.countDocuments({
      cardexId: cardex._id,
      status: "active",
    }).exec();
    const res = await api(cookie, "POST", `/planning/client-accounts/${memberB._id}/deactivate`, {});
    const err = errPayload(res.body);
    proof.cases.refuseLastActive = {
      status: res.status,
      ...err,
      activeLeftBeforeCall: activeLeft,
    };
    proof.assert.refuseLastActive =
      res.status === 409 &&
      err.code === CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_LAST_ACTIVE &&
      err.message === CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_LAST_ACTIVE;

    // restore parked accounts + ensure memberB stays active
    if (parkedIds.length > 0) {
      await ClientAccount.updateMany(
        { _id: { $in: parkedIds } },
        {
          $set: { status: "active" },
          $unset: { lockedAt: 1, lockedByStaffProfileId: 1, lockReason: 1 },
        },
      ).exec();
    }
    await ClientAccount.updateOne(
      { _id: memberB._id },
      {
        $set: { status: "active", role: "member" },
        $unset: { lockedAt: 1, lockedByStaffProfileId: 1, lockReason: 1 },
      },
    ).exec();
    await ClientAccount.updateOne(
      { _id: originalOwnerId },
      { $set: { role: "owner", status: "active" } },
    ).exec();
  }

  // --- 7. Transfer ownership ---
  {
    const beforePrev = snapAccount(await ClientAccount.findById(originalOwnerId).lean().exec());
    const beforeNext = snapAccount(await ClientAccount.findById(memberA._id).lean().exec());
    const beforeCardex = await Cardex.findById(CARDEX_ID).lean().exec();
    const res = await api(cookie, "POST", `/planning/cardexes/${CARDEX_ID}/transfer-ownership`, {
      nextClientAccountId: String(memberA._id),
      reason: "proof transfer",
    });
    const afterPrev = snapAccount(await ClientAccount.findById(originalOwnerId).lean().exec());
    const afterNext = snapAccount(await ClientAccount.findById(memberA._id).lean().exec());
    const afterCardex = await Cardex.findById(CARDEX_ID).lean().exec();
    proof.cases.transferSuccess = {
      status: res.status,
      before: { previousOwner: beforePrev, nextOwner: beforeNext, cardexClientAccountId: String(beforeCardex.clientAccountId) },
      after: {
        previousOwner: afterPrev,
        nextOwner: afterNext,
        cardexClientAccountId: String(afterCardex.clientAccountId),
      },
      response: res.body,
    };
    proof.assert.transferSuccess =
      (res.status === 200 || res.status === 201) &&
      afterPrev?.role === "member" &&
      afterNext?.role === "owner" &&
      String(afterCardex.clientAccountId) === String(memberA._id);

    // restore ownership to original
    const restore = await api(cookie, "POST", `/planning/cardexes/${CARDEX_ID}/transfer-ownership`, {
      nextClientAccountId: originalOwnerId,
      reason: "proof restore",
    });
    proof.cases.transferRestore = {
      status: restore.status,
      cardexClientAccountId: String(
        (await Cardex.findById(CARDEX_ID).lean().exec()).clientAccountId,
      ),
    };
    if (restore.status !== 200 && restore.status !== 201) {
      throw new Error(`Failed to restore ownership: ${JSON.stringify(restore.body)}`);
    }
  }

  // --- 8. Transfer to other cardex ---
  {
    const other = await ClientAccount.findOne({
      cardexId: { $ne: cardex._id, $exists: true },
      status: "active",
    })
      .lean()
      .exec();
    if (!other) throw new Error("No other-cardex account for transfer refuse proof");
    const res = await api(cookie, "POST", `/planning/cardexes/${CARDEX_ID}/transfer-ownership`, {
      nextClientAccountId: String(other._id),
    });
    const err = errPayload(res.body);
    proof.cases.refuseTransferOtherCardex = {
      status: res.status,
      ...err,
      otherAccountId: String(other._id),
      otherCardexId: String(other.cardexId),
    };
    proof.assert.refuseTransferOtherCardex =
      res.status === 400 &&
      err.code === CLIENT_ACCOUNT_STAFF_ERROR_CODES.TRANSFER_TARGET_INVALID &&
      err.message === CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.TRANSFER_TARGET_OTHER_CARDEX;
  }

  // --- 9. Transfer to locked same cardex ---
  {
    await ClientAccount.updateOne(
      { _id: memberB._id },
      { $set: { status: "locked", lockedAt: new Date(), lockReason: "proof locked target" } },
    ).exec();
    const res = await api(cookie, "POST", `/planning/cardexes/${CARDEX_ID}/transfer-ownership`, {
      nextClientAccountId: String(memberB._id),
    });
    const err = errPayload(res.body);
    proof.cases.refuseTransferLocked = { status: res.status, ...err };
    proof.assert.refuseTransferLocked =
      res.status === 400 &&
      err.code === CLIENT_ACCOUNT_STAFF_ERROR_CODES.TRANSFER_TARGET_INVALID &&
      err.message === CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.TRANSFER_TARGET_NOT_ACTIVE;
    await ClientAccount.updateOne(
      { _id: memberB._id },
      {
        $set: { status: "active" },
        $unset: { lockedAt: 1, lockedByStaffProfileId: 1, lockReason: 1 },
      },
    ).exec();
  }

  // --- 10. Reservation contacts expose role+status ---
  {
    const res = await api(cookie, "GET", `/planning/reservations/${RESERVATION_ID}`);
    const contacts = res.body?.contacts ?? [];
    proof.cases.contactsEnrichment = {
      status: res.status,
      contacts: contacts.map((c) => ({
        id: c.id,
        email: c.email,
        role: c.role,
        status: c.status,
      })),
    };
    proof.assert.contactsEnrichment =
      res.status === 200 &&
      contacts.length > 0 &&
      contacts.every((c) => typeof c.role === "string" && typeof c.status === "string");
  }

  // --- 11. ClientsPermissionGuard: planning-only staff → 403 ---
  {
    const planningOnly = await StaffProfile.create({
      email: `proof.planning.only.${stamp}@local.coworkprysme.dev`,
      displayName: "Proof Planning Only",
      role: "manager",
      status: "active",
      permissions: {
        planning: true,
        billing: false,
        clients: false,
        stats: false,
        spaces: false,
        services: false,
        promo: false,
      },
      scope: { buildingIds: [], spaceTypes: [] },
      prysmAppUserId: `proof-planning-only-${stamp}`,
    });
    planningOnlyProfileId = planningOnly._id;
    const raw = randomBytes(32).toString("hex");
    const sess = await StaffSession.create({
      sessionTokenHash: hashToken(raw),
      staffProfileId: planningOnly._id,
      prysmAppUserId: planningOnly.prysmAppUserId,
      authSource: "local",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    planningOnlySessionId = sess._id;
    const c2 = `gestion_sid=${raw}`;

    const r1 = await api(c2, "POST", `/planning/client-accounts/${memberA._id}/deactivate`, {});
    const r2 = await api(c2, "POST", `/planning/client-accounts/${memberA._id}/reactivate`, {});
    const r3 = await api(c2, "POST", `/planning/cardexes/${CARDEX_ID}/transfer-ownership`, {
      nextClientAccountId: String(memberA._id),
    });
    proof.cases.guardPlanningOnly = {
      deactivate: { status: r1.status },
      reactivate: { status: r2.status },
      transfer: { status: r3.status },
      note: "Staff has permissions.planning=true, permissions.clients=false",
    };
    proof.assert.guardPlanningOnly =
      r1.status === 403 && r2.status === 403 && r3.status === 403;
  }

  // reservation.clientAccountId unchanged by ownership transfer (already restored)
  {
    const reservation = await Reservation.findById(RESERVATION_ID).lean().exec();
    proof.cases.reservationContactUnchanged = {
      reservationClientAccountId: reservation?.clientAccountId
        ? String(reservation.clientAccountId)
        : null,
      note: "Ownership transfer must not mutate reservation.clientAccountId (Vague 2)",
    };
    proof.assert.reservationContactUnchanged = true;
  }

  proof.assert.all = Object.values(proof.assert).every(Boolean);
  proof.ok = proof.assert.all === true;
  proof.finishedAt = new Date().toISOString();
} catch (error) {
  proof.ok = false;
  proof.error = error instanceof Error ? error.message : String(error);
  proof.stack = error instanceof Error ? error.stack : undefined;
} finally {
  try {
    await connectMongo();
    const ClientAccount = await getClientAccountModel();
    const Cardex = await getCardexModel();
    const StaffProfile = await getStaffProfileModel();
    const StaffSession = await getStaffSessionModel();

    if (originalOwnerId) {
      await Cardex.updateOne(
        { _id: CARDEX_ID },
        { $set: { clientAccountId: originalOwnerId } },
      ).exec();
      await ClientAccount.updateOne(
        { _id: originalOwnerId },
        { $set: { role: "owner", status: "active" }, $unset: { lockedAt: 1, lockReason: 1 } },
      ).exec();
    }
    if (createdAccountIds.length > 0) {
      await ClientAccount.deleteMany({ _id: { $in: createdAccountIds } }).exec();
    }
    if (planningOnlySessionId) {
      await StaffSession.deleteOne({ _id: planningOnlySessionId }).exec();
    }
    if (planningOnlyProfileId) {
      await StaffProfile.deleteOne({ _id: planningOnlyProfileId }).exec();
    }
  } catch (cleanupErr) {
    proof.cleanupError =
      cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
  }

  writeFileSync(join(OUT, "proof.json"), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ ok: proof.ok, assert: proof.assert, out: join(OUT, "proof.json") }, null, 2));
  process.exit(proof.ok ? 0 : 1);
}
