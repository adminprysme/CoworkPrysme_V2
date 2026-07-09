import { Injectable } from "@nestjs/common";
import {
  DEFAULT_PUBLIC_BUILDING_INFO,
  PublicBuildingInfoSchema,
  mapDbBuildingToPublicInfo,
} from "@coworkprysme/shared";
import { connectMongo, getBuildingModel } from "@coworkprysme/db";

@Injectable()
export class SiteContactService {
  async getPublicBuildingInfo() {
    await connectMongo();
    const Building = await getBuildingModel();
    const building = await Building.findOne({ status: "active" }).sort({ name: 1 }).lean().exec();

    if (!building) {
      return PublicBuildingInfoSchema.parse(DEFAULT_PUBLIC_BUILDING_INFO);
    }

    return mapDbBuildingToPublicInfo(building);
  }
}
