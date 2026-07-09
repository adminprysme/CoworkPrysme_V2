import { Injectable } from "@nestjs/common";
import type { Space } from "@coworkprysme/db";
import {
  DEFAULT_SERVICES_FEATURED_SPACES,
  VITRINE_CONTENT_SINGLETON_ID,
  mediaPathFromStorageKey,
  pickPrimaryPhotoStorageKey,
  spaceTypeToVitrineHref,
  type ServicesFeaturedSpace,
} from "@coworkprysme/shared";
import { connectMongo, getSpaceModel, getVitrineContentModel } from "@coworkprysme/db";
import type { Types } from "mongoose";

type SpaceLean = Space & { _id: Types.ObjectId };

@Injectable()
export class ServicesContentService {
  private getApiOrigin(): string {
    const port = Number(process.env.PORT ?? 8002);
    return process.env.VITRINE_API_PUBLIC_ORIGIN?.replace(/\/$/, "") ?? `http://localhost:${port}`;
  }

  async getPublicContent() {
    await connectMongo();
    const VitrineContent = await getVitrineContentModel();
    const doc = await VitrineContent.findById(VITRINE_CONTENT_SINGLETON_ID).lean().exec();
    const featuredSpaceIds = doc?.featuredSpaceIds ?? [];

    if (featuredSpaceIds.length === 0) {
      return { featuredSpaces: [] };
    }

    const Space = await getSpaceModel();
    const spaces = await Space.find({
      _id: { $in: featuredSpaceIds },
      status: { $ne: "archived" },
    })
      .lean()
      .exec();

    const spaceById = new Map(
      (spaces as SpaceLean[]).map((space) => [space._id.toString(), space]),
    );

    const apiOrigin = this.getApiOrigin();
    const featuredSpaces = featuredSpaceIds
      .map((spaceId, index) => {
        const space = spaceById.get(spaceId);
        if (!space) {
          return null;
        }
        return mapSpaceToFeaturedPreview(space, apiOrigin, index);
      })
      .filter((space): space is ServicesFeaturedSpace => space !== null);

    if (featuredSpaces.length === 0) {
      return { featuredSpaces: [] };
    }

    return { featuredSpaces };
  }
}

function buildPublicSpacePhotoUrl(
  storageKey: string | null,
  fallback: string,
  apiOrigin: string,
): string {
  if (!storageKey) {
    return fallback;
  }
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return storageKey;
  }
  return `${apiOrigin}${mediaPathFromStorageKey(storageKey)}`;
}

function mapSpaceToFeaturedPreview(
  space: SpaceLean,
  apiOrigin: string,
  index: number,
): ServicesFeaturedSpace {
  const fallbackImage =
    DEFAULT_SERVICES_FEATURED_SPACES[index]?.image ?? DEFAULT_SERVICES_FEATURED_SPACES[0]!.image;
  const primaryPhotoKey = pickPrimaryPhotoStorageKey(space.photos);

  return {
    id: space._id.toString(),
    name: space.name,
    type: space.type,
    capacity: space.capacity,
    description: space.description?.trim() ?? "",
    equipment: space.equipments.map((equipment) => equipment.label),
    href: spaceTypeToVitrineHref(space.type),
    image: buildPublicSpacePhotoUrl(primaryPhotoKey, fallbackImage, apiOrigin),
  };
}
