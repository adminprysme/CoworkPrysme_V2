/**
 * Phase 2 demo helper — creates a valid gestion session for API testing.
 * Usage: node scripts/demo-session.mjs
 */
import { createHash, randomBytes } from "node:crypto";

import { connectMongo, getStaffProfileModel, getStaffSessionModel } from "@coworkprysme/db";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-local-session-secret-32chars-min!!";

function hashToken(token) {
  return createHash("sha256").update(`${token}:${SESSION_SECRET}`).digest("hex");
}

const token = randomBytes(32).toString("hex");
const mongoose = await connectMongo();
const StaffProfile = await getStaffProfileModel();
const profile = await StaffProfile.findOne({ email: "paul.thomas@local.coworkprysme.dev" }).exec();
if (!profile) {
  throw new Error("Staff profile not found");
}

const StaffSession = await getStaffSessionModel();
await StaffSession.create({
  sessionTokenHash: hashToken(token),
  staffProfileId: profile._id,
  prysmAppUserId: profile.prysmAppUserId,
  authSource: "local",
  expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
});

console.log(token);
await mongoose.disconnect();
