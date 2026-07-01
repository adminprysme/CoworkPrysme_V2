import { createHash, randomBytes } from "node:crypto";

import { connectMongo, getStaffProfileModel, getStaffSessionModel } from "@coworkprysme/db";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-local-session-secret-32chars-min!!";

function hashToken(token) {
  return createHash("sha256").update(`${token}:${SESSION_SECRET}`).digest("hex");
}

const token = randomBytes(32).toString("hex");
const mongoose = await connectMongo();
const StaffProfile = await getStaffProfileModel();

let profile = await StaffProfile.findOne({ email: "demo-no-spaces@local.coworkprysme.dev" }).exec();
if (!profile) {
  profile = await StaffProfile.create({
    prysmAppUserId: "local:demo-no-spaces",
    displayName: "Demo No Spaces",
    email: "demo-no-spaces@local.coworkprysme.dev",
    role: "manager",
    permissions: {
      planning: true,
      billing: false,
      clients: false,
      stats: false,
      spaces: false,
      promo: false,
    },
    scope: { buildingIds: [], spaceTypes: [] },
    status: "active",
  });
} else {
  profile.permissions.spaces = false;
  await profile.save();
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
