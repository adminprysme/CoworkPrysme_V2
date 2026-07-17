import { Injectable, NotFoundException } from "@nestjs/common";
import type { Building, Space } from "@coworkprysme/db";
import {
  CatalogBuildingPageContentSchema,
  CatalogBuildingsListSchema,
  CatalogTariffsContentSchema,
  DURATION_CLASS_LABELS,
  computeStartingPriceHTCents,
  pickPrimaryPhotoStorageKey,
  pickStartingPriceVatRate,
  type CatalogBuildingDetail,
  type CatalogBuildingSummary,
  type CatalogSpaceCard,
  type SpaceType,
} from "@coworkprysme/shared";
import { connectMongo, getBuildingModel, getSpaceModel } from "@coworkprysme/db";
import type { Types } from "mongoose";

import { buildPublicImageUrl } from "../home-content/home-content.controller.js";

type BuildingLean = Building & { _id: Types.ObjectId };
type SpaceLean = Space & { _id: Types.ObjectId };

export function sortCatalogSpaces(spaces: SpaceLean[]): SpaceLean[] {
  return [...spaces].sort((left, right) => {
    if (left.featuredOnVitrine !== right.featuredOnVitrine) {
      return left.featuredOnVitrine ? -1 : 1;
    }

    const leftOrder = left.vitrineOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.vitrineOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name, "fr");
  });
}

function buildTagline(description: string | undefined): string | null {
  const trimmed = description?.trim();
  if (!trimmed) {
    return null;
  }

  const firstSentence = trimmed.split(/(?<=[.!?])\s+/)[0]?.trim() ?? trimmed;
  return firstSentence.length > 160 ? `${firstSentence.slice(0, 157)}…` : firstSentence;
}

@Injectable()
export class CatalogContentService {
  private getApiOrigin(): string {
    const port = Number(process.env.PORT ?? 8002);
    return process.env.VITRINE_API_PUBLIC_ORIGIN?.replace(/\/$/, "") ?? `http://localhost:${port}`;
  }

  private buildPhotoUrl(storageKey: string | null, apiOrigin: string): string | null {
    if (!storageKey) {
      return null;
    }
    return buildPublicImageUrl(storageKey, "", apiOrigin);
  }

  private mapBuildingSummary(building: BuildingLean, apiOrigin: string): CatalogBuildingSummary {
    const primaryPhotoKey = pickPrimaryPhotoStorageKey(building.photos);
    return {
      id: building._id.toString(),
      slug: building.seo.slug,
      name: building.name,
      city: building.address.city,
      tagline: buildTagline(building.description),
      primaryPhotoUrl: this.buildPhotoUrl(primaryPhotoKey, apiOrigin),
      isDefault: building.isDefaultVitrineBuilding,
    };
  }

  private mapBuildingDetail(building: BuildingLean, apiOrigin: string): CatalogBuildingDetail {
    return {
      ...this.mapBuildingSummary(building, apiOrigin),
      description: building.description?.trim() ?? null,
      street: building.address.street,
      postalCode: building.address.zip,
      coordinates: {
        lat: building.coordinates.lat,
        lng: building.coordinates.lng,
      },
    };
  }

  private mapSpaceCard(space: SpaceLean, apiOrigin: string): CatalogSpaceCard {
    const startingPriceHTCents = computeStartingPriceHTCents(space.tariffs);
    const primaryPhotoKey = pickPrimaryPhotoStorageKey(space.photos);

    return {
      id: space._id.toString(),
      slug: space.seo.slug,
      name: space.name,
      capacity: space.capacity,
      equipments: space.equipments.slice(0, 3).map((equipment) => equipment.label),
      primaryPhotoUrl: this.buildPhotoUrl(primaryPhotoKey, apiOrigin),
      startingPriceHTCents,
      startingPriceVatRate: pickStartingPriceVatRate(space.tariffs, startingPriceHTCents),
      featuredOnVitrine: space.featuredOnVitrine ?? false,
      vitrineOrder: space.vitrineOrder,
    };
  }

  private async getVisibleBuildingsLean(): Promise<BuildingLean[]> {
    await connectMongo();
    const Building = await getBuildingModel();
    const docs = await Building.find({ visibleOnVitrine: true, status: "active" })
      .sort({ isDefaultVitrineBuilding: -1, name: 1 })
      .lean()
      .exec();

    return docs as BuildingLean[];
  }

  private async getVisibleBuildingBySlug(slug: string): Promise<BuildingLean> {
    await connectMongo();
    const Building = await getBuildingModel();
    const building = await Building.findOne({
      "seo.slug": slug,
      visibleOnVitrine: true,
      status: "active",
    })
      .lean()
      .exec();

    if (!building) {
      throw new NotFoundException();
    }

    return building as BuildingLean;
  }

  async listBuildings() {
    const apiOrigin = this.getApiOrigin();
    const buildings = await this.getVisibleBuildingsLean();
    const summaries = buildings.map((building) => this.mapBuildingSummary(building, apiOrigin));
    const defaultBuilding =
      summaries.find((building) => building.isDefault) ?? summaries[0] ?? null;

    return CatalogBuildingsListSchema.parse({
      buildings: summaries,
      defaultBuildingSlug: defaultBuilding?.slug ?? null,
    });
  }

  async getBuildingSpacesPage(slug: string, type: SpaceType) {
    const apiOrigin = this.getApiOrigin();
    const building = await this.getVisibleBuildingBySlug(slug);
    const visibleBuildings = await this.getVisibleBuildingsLean();

    await connectMongo();
    const Space = await getSpaceModel();
    const spaces = await Space.find({
      buildingId: building._id,
      type,
      status: "active",
    })
      .lean()
      .exec();

    const sortedSpaces = sortCatalogSpaces(spaces as SpaceLean[]);

    return CatalogBuildingPageContentSchema.parse({
      building: this.mapBuildingDetail(building, apiOrigin),
      spaces: sortedSpaces.map((space) => this.mapSpaceCard(space, apiOrigin)),
      visibleBuildings: visibleBuildings.map((item) => this.mapBuildingSummary(item, apiOrigin)),
    });
  }

  async getTariffsPage(slug: string) {
    const apiOrigin = this.getApiOrigin();
    const building = await this.getVisibleBuildingBySlug(slug);
    const visibleBuildings = await this.getVisibleBuildingsLean();

    await connectMongo();
    const Space = await getSpaceModel();
    const spaces = await Space.find({
      buildingId: building._id,
      status: "active",
    })
      .sort({ type: 1, name: 1 })
      .lean()
      .exec();

    const groups = (spaces as SpaceLean[]).map((space) => ({
      spaceId: space._id.toString(),
      spaceName: space.name,
      capacity: space.capacity,
      type: space.type,
      lines: space.tariffs
        .filter((tariff) => tariff.enabled !== false)
        .map((tariff) => ({
          durationClass: tariff.durationClass,
          label: DURATION_CLASS_LABELS[tariff.durationClass],
          priceHTCents: tariff.priceHT,
          vatRate: tariff.vatRate,
        })),
    }));

    return CatalogTariffsContentSchema.parse({
      visibleBuildings: visibleBuildings.map((item) => this.mapBuildingSummary(item, apiOrigin)),
      building: this.mapBuildingDetail(building, apiOrigin),
      groups,
    });
  }
}
