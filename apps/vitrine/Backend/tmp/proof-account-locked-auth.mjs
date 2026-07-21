/**
 * Commit 3 — ACCOUNT_LOCKED on booking verify + confirm existing.
 *
 * Usage: node scripts/run-with-env.mjs node tmp/proof-account-locked-auth.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NestFactory } from "@nestjs/core";
import {
  BOOKING_CONFIRM_ERROR_CODES,
  CLIENT_ACCOUNT_LOCKED_USER_MESSAGE,
} from "@coworkprysme/shared";
import {
  AccountLockedError,
  acquireLock,
  confirmBookingCheckout,
  connectMongo,
  getClientAccountModel,
  getSpaceModel,
  InvalidCredentialsError,
  verifyClientAccountCredentials,
} from "@coworkprysme/db";

import { AppModule } from "../dist/app.module.js";
import { BookingConfirmService } from "../dist/booking/booking-confirm.service.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "account-locked-auth-proof");
mkdirSync(OUT, { recursive: true });

const VITRINE_API = process.env.VITRINE_API_URL ?? "http://127.0.0.1:8002";
const PASSWORD = "ProofLocked1!";
/** bcrypt hash of PASSWORD (cost 12) — avoids importing bcryptjs from vitrine-api. */
const PASSWORD_HASH = "$2b$12$4RbOgTGiAX9DUt7x4yaGleABmLVm.jue4sGX2ZdFIa..ZbpSdCJku";

function errPayload(body) {
  if (!body || typeof body !== "object") return { code: null, message: null };
  const nested = body.message && typeof body.message === "object" ? body.message : null;
  return {
    code: nested?.code ?? body.code ?? null,
    message: nested?.message ?? (typeof body.message === "string" ? body.message : null),
  };
}

async function api(method, path, body) {
  const res = await fetch(`${VITRINE_API}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
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

function basePricing(spaceName) {
  return {
    durationClass: "hourly",
    units: 1,
    subtotalHT: 5000,
    discountTotal: 0,
    vatBreakdown: [{ rate: 20, baseHT: 5000, vat: 1000 }],
    totalTTC: 6000,
    lines: [
      {
        label: spaceName,
        kind: "space",
        qty: 1,
        unitPriceHT: 5000,
        vatRate: 20,
        discount: 0,
        totalHT: 5000,
        totalVAT: 1000,
        totalTTC: 6000,
      },
    ],
  };
}

async function expectThrow(fn, ErrorClass) {
  try {
    await fn();
    throw new Error(`Expected ${ErrorClass.name}`);
  } catch (e) {
    if (e instanceof ErrorClass) return;
    throw e;
  }
}

const proof = {
  startedAt: new Date().toISOString(),
  isolation: {},
  cases: {},
  assert: {},
  ok: false,
};

const createdIds = [];

try {
  const uri = process.env.MONGODB_URI ?? "";
  const hostMatch = uri.match(/@([^/?]+)/) || uri.match(/\/\/([^/?]+)/);
  const host = hostMatch ? hostMatch[1] : "unknown";
  proof.isolation = {
    mongodbHost: host,
    isLocalhost: /localhost|127\.0\.0\.1/.test(host),
    coworkDb: process.env.MONGODB_DB_COWORK,
  };
  if (!proof.isolation.isLocalhost) {
    throw new Error(`Refusing proof: Mongo host is not local (${host})`);
  }

  await connectMongo();
  const ClientAccount = await getClientAccountModel();
  const passwordHash = PASSWORD_HASH;
  const stamp = Date.now();

  const active = await ClientAccount.create({
    email: `proof.locked.active.${stamp}@prysme.eu`,
    passwordHash,
    role: "owner",
    status: "active",
    consent: { privacyPolicyVersion: "proof", acceptedAt: new Date() },
  });
  createdIds.push(active._id);

  const locked = await ClientAccount.create({
    email: `proof.locked.locked.${stamp}@prysme.eu`,
    passwordHash,
    role: "member",
    status: "locked",
    lockedAt: new Date(),
    lockReason: "proof commit3",
    consent: { privacyPolicyVersion: "proof", acceptedAt: new Date() },
  });
  createdIds.push(locked._id);

  const anonymized = await ClientAccount.create({
    email: `proof.locked.anon.${stamp}@prysme.eu`,
    passwordHash,
    role: "member",
    status: "anonymized",
    consent: { privacyPolicyVersion: "proof", acceptedAt: new Date() },
  });
  createdIds.push(anonymized._id);

  await expectThrow(
    () => verifyClientAccountCredentials(locked.email, PASSWORD),
    AccountLockedError,
  );
  proof.cases.dbVerifyLocked = { threw: "AccountLockedError" };
  proof.assert.dbVerifyLocked = true;

  {
    const ok = await verifyClientAccountCredentials(anonymized.email, PASSWORD);
    proof.cases.dbVerifyAnonymized = { result: ok };
    proof.assert.dbVerifyAnonymized = ok === false;
  }

  {
    const res = await api("POST", "/booking/account/verify", {
      email: locked.email,
      password: PASSWORD,
    });
    const err = errPayload(res.body);
    proof.cases.httpVerifyLocked = { status: res.status, ...err };
    proof.assert.httpVerifyLocked =
      res.status === 403 &&
      err.code === BOOKING_CONFIRM_ERROR_CODES.ACCOUNT_LOCKED &&
      err.message === CLIENT_ACCOUNT_LOCKED_USER_MESSAGE;
  }

  {
    const res = await api("POST", "/booking/account/verify", {
      email: active.email,
      password: PASSWORD,
    });
    proof.cases.httpVerifyActiveOk = { status: res.status, body: res.body };
    proof.assert.httpVerifyActiveOk =
      (res.status === 200 || res.status === 201) && res.body?.valid === true;
  }

  {
    const res = await api("POST", "/booking/account/verify", {
      email: active.email,
      password: "WrongPass9!",
    });
    const err = errPayload(res.body);
    proof.cases.httpVerifyActiveBadPassword = { status: res.status, ...err };
    proof.assert.httpVerifyActiveBadPassword =
      res.status === 401 &&
      err.code === BOOKING_CONFIRM_ERROR_CODES.INVALID_CREDENTIALS &&
      err.message === "Email ou mot de passe incorrect";
  }

  {
    const res = await api("POST", "/booking/account/verify", {
      email: `proof.locked.missing.${stamp}@prysme.eu`,
      password: PASSWORD,
    });
    const err = errPayload(res.body);
    proof.cases.httpVerifyUnknown = { status: res.status, ...err };
    proof.assert.httpVerifyUnknown =
      res.status === 401 &&
      err.code === BOOKING_CONFIRM_ERROR_CODES.INVALID_CREDENTIALS &&
      err.message === "Email ou mot de passe incorrect";
  }

  const Space = await getSpaceModel();
  const space = await Space.findOne({ status: "active" }).lean().exec();
  if (!space) throw new Error("No active space for confirm proof");

  {
    const startAt = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    const sessionId = `proof-locked-${stamp}`;
    const lock = await acquireLock({
      spaceId: space._id,
      startAt,
      endAt,
      sessionId,
    });

    let threw = null;
    try {
      await confirmBookingCheckout({
        lockId: lock._id,
        sessionId,
        spaceId: space._id,
        buildingId: space.buildingId,
        startAt,
        endAt,
        durationClass: "hourly",
        partySize: 2,
        reservationType: space.type,
        spaceSnapshot: { name: space.name, type: space.type },
        services: [],
        accountMode: "existing",
        email: locked.email,
        password: PASSWORD,
        cgvAcceptedAt: new Date(),
        withdrawalAcknowledgedAt: new Date(),
        paymentMethod: "card",
        pricing: basePricing(space.name),
      });
    } catch (e) {
      threw = e;
    }

    proof.cases.confirmExistingLockedDb = {
      errorName: threw?.name ?? null,
      isAccountLockedError: threw instanceof AccountLockedError,
    };
    proof.assert.confirmExistingLockedDb = threw instanceof AccountLockedError;
  }

  {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
    try {
      const confirm = app.get(BookingConfirmService);
      const mapFn = Object.getPrototypeOf(confirm).mapConfirmError;
      if (typeof mapFn !== "function") {
        throw new Error("BookingConfirmService.mapConfirmError not found");
      }
      let nestErr = null;
      try {
        mapFn.call(confirm, new AccountLockedError());
      } catch (e) {
        nestErr = e;
      }
      const status = nestErr?.getStatus?.() ?? null;
      const err = errPayload(nestErr?.getResponse?.() ?? null);
      proof.cases.confirmExistingLockedNest = {
        status,
        ...err,
        via: "mapConfirmError(AccountLockedError) — same mapper used by POST /booking/confirm",
      };
      proof.assert.confirmExistingLockedNest =
        status === 403 &&
        err.code === BOOKING_CONFIRM_ERROR_CODES.ACCOUNT_LOCKED &&
        err.message === CLIENT_ACCOUNT_LOCKED_USER_MESSAGE;
    } finally {
      await app.close();
    }
  }

  {
    const startAt = new Date(Date.now() + 41 * 24 * 60 * 60 * 1000);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    const sessionId = `proof-anon-${stamp}`;
    const lock = await acquireLock({
      spaceId: space._id,
      startAt,
      endAt,
      sessionId,
    });
    let threw = null;
    try {
      await confirmBookingCheckout({
        lockId: lock._id,
        sessionId,
        spaceId: space._id,
        buildingId: space.buildingId,
        startAt,
        endAt,
        durationClass: "hourly",
        partySize: 2,
        reservationType: space.type,
        spaceSnapshot: { name: space.name, type: space.type },
        services: [],
        accountMode: "existing",
        email: anonymized.email,
        password: PASSWORD,
        cgvAcceptedAt: new Date(),
        withdrawalAcknowledgedAt: new Date(),
        paymentMethod: "card",
        pricing: basePricing(space.name),
      });
    } catch (e) {
      threw = e;
    }
    proof.cases.confirmExistingAnonymized = {
      errorName: threw?.name ?? null,
      isInvalidCredentials: threw instanceof InvalidCredentialsError,
    };
    proof.assert.confirmExistingAnonymized = threw instanceof InvalidCredentialsError;
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
    if (createdIds.length > 0) {
      await ClientAccount.deleteMany({ _id: { $in: createdIds } }).exec();
    }
  } catch (cleanupErr) {
    proof.cleanupError =
      cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
  }
  writeFileSync(join(OUT, "proof.json"), JSON.stringify(proof, null, 2));
  console.log(
    JSON.stringify({ ok: proof.ok, assert: proof.assert, out: join(OUT, "proof.json") }, null, 2),
  );
  process.exit(proof.ok ? 0 : 1);
}
