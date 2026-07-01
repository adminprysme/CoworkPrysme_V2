import { Injectable } from "@nestjs/common";
import {
  ADMIN_BOOTSTRAP_USERNAME,
  ALL_STAFF_PERMISSIONS,
  hasGestionAccess,
  type CentraleValidatedUser,
} from "@coworkprysme/shared";
import { connectMongo, getStaffProfileModel, type StaffProfileDocument } from "@coworkprysme/db";

@Injectable()
export class StaffBootstrapService {
  async upsertFromCentraleUser(user: CentraleValidatedUser): Promise<StaffProfileDocument> {
    await connectMongo();
    const StaffProfile = await getStaffProfileModel();
    const displayName = `${user.first_name} ${user.last_name}`.trim() || user.username;
    const isBootstrapAdmin = user.username === ADMIN_BOOTSTRAP_USERNAME;

    const existing = await StaffProfile.findOne({ prysmAppUserId: user.id }).exec();
    if (existing?.status === "revoked") {
      throw new Error("STAFF_REVOKED");
    }
    if (existing && !hasGestionAccess(existing.role)) {
      throw new Error("STAFF_NO_ACCESS");
    }

    if (isBootstrapAdmin) {
      return StaffProfile.findOneAndUpdate(
        { prysmAppUserId: user.id },
        {
          $set: {
            displayName,
            email: user.email.toLowerCase(),
            role: "admin",
            permissions: ALL_STAFF_PERMISSIONS,
            scope: { buildingIds: [], spaceTypes: [] },
            status: "active",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).exec() as Promise<StaffProfileDocument>;
    }

    if (existing) {
      existing.displayName = displayName;
      existing.email = user.email.toLowerCase();
      await existing.save();
      return existing;
    }

    throw new Error("STAFF_NO_ACCESS");
  }
}
