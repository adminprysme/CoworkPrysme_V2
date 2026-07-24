import { Injectable } from "@nestjs/common";
import {
  DEFAULT_PUBLIC_BUILDING_INFO,
  PublicBuildingInfoSchema,
  VITRINE_CONTENT_SINGLETON_ID,
  mapDbBuildingToPublicInfo,
  resolveVitrineSiteContact,
} from "@coworkprysme/shared";
import { connectMongo, getBuildingModel, getVitrineContentModel } from "@coworkprysme/db";

@Injectable()
export class SiteContactService {
  async getPublicBuildingInfo() {
    await connectMongo();
    const Building = await getBuildingModel();
    const VitrineContent = await getVitrineContentModel();

    const vitrineContent = await VitrineContent.findById(VITRINE_CONTENT_SINGLETON_ID)
      .lean()
      .exec();
    const featuredBuildingIds = vitrineContent?.featuredBuildingIds ?? [];

    let building = null;

    if (featuredBuildingIds.length > 0) {
      const buildings = await Building.find({
        _id: { $in: featuredBuildingIds },
        status: "active",
      })
        .lean()
        .exec();

      const buildingById = new Map(buildings.map((item) => [item._id.toString(), item]));
      for (const buildingId of featuredBuildingIds) {
        const match = buildingById.get(buildingId);
        if (match) {
          building = match;
          break;
        }
      }
    }

    if (!building) {
      building = await Building.findOne({ status: "active" }).sort({ name: 1 }).lean().exec();
    }

    const base = building
      ? mapDbBuildingToPublicInfo(building)
      : PublicBuildingInfoSchema.parse(DEFAULT_PUBLIC_BUILDING_INFO);

    const siteContact = resolveVitrineSiteContact(vitrineContent?.siteContact);

    return PublicBuildingInfoSchema.parse({
      ...base,
      email: siteContact.email,
      phone: siteContact.phone,
      phoneHref: siteContact.phoneHref,
    });
  }
}
