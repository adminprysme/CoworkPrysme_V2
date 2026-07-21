/**
 * Proof: honest emailSent audit + emailDeliveryWarning on reservation detail.
 *
 * 1) Force SMTP fail (RFC 2606 address) via party-size manage → emailSent:false + badge field
 * 2) Restore real email + party-size again → emailSent:true, no warning
 *
 * Usage (from apps/gestion/Backend, API on :8003 with rebuilt dist):
 *   node --env-file=.env tmp/proof-email-delivery-audit.mjs
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  connectMongo,
  getAuditLogModel,
  getClientAccountModel,
  getReservationModel,
  getSpaceModel,
  getStaffProfileModel,
  getStaffSessionModel,
} from "@coworkprysme/db";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "email-delivery-audit-proof");
mkdirSync(OUT, { recursive: true });

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line || line.trim().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = v;
  }
}

loadEnv("/root/coworkprysme_v2/apps/gestion/Backend/.env");

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) throw new Error("SESSION_SECRET missing");
const API = "http://127.0.0.1:8003";
const SUCCESS_EMAIL = null; // use original mailbox for success path
const FAIL_EMAIL = `email-delivery-proof-${randomBytes(4).toString("hex")}@example.com`;

await connectMongo();

const StaffProfile = await getStaffProfileModel();
const StaffSession = await getStaffSessionModel();
const profile = await StaffProfile.findOne({
  email: "paul.thomas@local.coworkprysme.dev",
}).exec();
if (!profile) throw new Error("staff profile missing");

const token = randomBytes(32).toString("hex");
await StaffSession.create({
  sessionTokenHash: createHash("sha256").update(`${token}:${SECRET}`).digest("hex"),
  staffProfileId: profile._id,
  prysmAppUserId: profile.prysmAppUserId,
  authSource: "local",
  expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
});
const cookie = `gestion_sid=${token}`;

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      cookie,
      accept: "application/json",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const Reservation = await getReservationModel();
const Space = await getSpaceModel();
const ClientAccount = await getClientAccountModel();
const AuditLog = await getAuditLogModel();

const candidates = await Reservation.find({
  status: "confirmed",
  clientAccountId: { $exists: true },
  startAt: { $gt: new Date() },
})
  .sort({ startAt: 1 })
  .limit(80)
  .lean()
  .exec();

let picked = null;
for (const res of candidates) {
  const account = await ClientAccount.findById(res.clientAccountId).lean().exec();
  const email = account?.email?.trim().toLowerCase() ?? "";
  if (!email || email.endsWith("@example.com") || email.endsWith(".local") || email.includes("restored-")) {
    continue;
  }
  const space = await Space.findById(res.spaceId).select({ capacity: 1 }).lean().exec();
  const capacity = space?.capacity ?? 20;
  const current = Math.max(1, Math.trunc(res.partySize ?? 1));
  const next = current < capacity ? current + 1 : current > 1 ? current - 1 : null;
  if (next == null) continue;
  picked = { reservation: res, current, next, restore: current, accountId: account._id, email };
  break;
}
if (!picked) throw new Error("No suitable confirmed reservation for party-size proof");

const account = await ClientAccount.findById(picked.accountId).exec();
if (!account) throw new Error("client account missing");
const originalEmail = account.email;

async function setEmail(email) {
  account.email = email;
  await account.save();
}

async function latestEmailAudit(reservationId) {
  return AuditLog.findOne({
    "entity.type": "reservation",
    "entity.id": { $in: [reservationId, String(reservationId)] },
    action: "reservation.party_size_change",
    "diff.emailSent": { $exists: true },
  })
    .sort({ at: -1 })
    .lean()
    .exec();
}

const resId = String(picked.reservation._id);

console.log("picked", {
  id: resId,
  ref: picked.reservation.reference,
  current: picked.current,
  next: picked.next,
  originalEmail,
  failEmail: FAIL_EMAIL,
});

// —— FAIL path ——
await setEmail(FAIL_EMAIL);
const failPost = await api(`/planning/reservations/${resId}/manage/party-size`, {
  method: "POST",
  body: JSON.stringify({ newPartySize: picked.next, confirm: true }),
});
console.log("failPost", failPost.status, JSON.stringify(failPost.body)?.slice(0, 500));
const failDetail = await api(`/planning/reservations/${resId}`);
console.log(
  "failDetail warning",
  failDetail.status,
  failDetail.body?.emailDeliveryWarning,
);
const failAudit = await latestEmailAudit(picked.reservation._id);
console.log("failAudit", failAudit?.diff?.emailSent, failAudit?.diff?.emailError);

// —— SUCCESS path (original mailbox — must accept SMTP) ——
await setEmail(originalEmail);
const successPost = await api(`/planning/reservations/${resId}/manage/party-size`, {
  method: "POST",
  body: JSON.stringify({ newPartySize: picked.restore, confirm: true }),
});
console.log("successPost", successPost.status, JSON.stringify(successPost.body)?.slice(0, 500));
const successDetail = await api(`/planning/reservations/${resId}`);
console.log(
  "successDetail warning",
  successDetail.status,
  successDetail.body?.emailDeliveryWarning,
);
const successAudit = await latestEmailAudit(picked.reservation._id);
console.log("successAudit", successAudit?.diff?.emailSent, successAudit?.diff?.emailError);

const proof = {
  reservationId: resId,
  reference: picked.reservation.reference,
  fail: {
    http: failPost.status,
    auditEmailSent: failAudit?.diff?.emailSent?.after,
    auditEmailError: failAudit?.diff?.emailError?.after ?? null,
    detailWarning: failDetail.body?.emailDeliveryWarning ?? null,
  },
  success: {
    http: successPost.status,
    auditEmailSent: successAudit?.diff?.emailSent?.after,
    auditEmailError: successAudit?.diff?.emailError?.after ?? null,
    detailWarning: successDetail.body?.emailDeliveryWarning ?? null,
  },
  assert: {
    failHttpOk: failPost.status === 200 || failPost.status === 201,
    failAuditFalse: failAudit?.diff?.emailSent?.after === false,
    failWarningPresent: Boolean(failDetail.body?.emailDeliveryWarning),
    successHttpOk: successPost.status === 200 || successPost.status === 201,
    successAuditTrue: successAudit?.diff?.emailSent?.after === true,
    successNoWarning: successDetail.body?.emailDeliveryWarning == null,
  },
};

proof.verdict = Object.values(proof.assert).every(Boolean) ? "PASS" : "FAIL";
writeFileSync(join(OUT, "proof.json"), JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof, null, 2));
if (proof.verdict !== "PASS") process.exit(1);
