import {
  DEFAULT_PUBLIC_BUILDING_INFO,
  PublicBuildingInfoSchema,
  SiteContactSchema,
  type PublicBuildingInfo,
  type SiteContact,
} from "@coworkprysme/shared";

import { getPublicBuildingInfoUrl } from "./public-building-info-api";

export async function fetchPublicBuildingInfo(): Promise<PublicBuildingInfo> {
  try {
    const response = await fetch(getPublicBuildingInfoUrl(), {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return DEFAULT_PUBLIC_BUILDING_INFO;
    }

    const json: unknown = await response.json();
    return PublicBuildingInfoSchema.parse(json);
  } catch {
    return DEFAULT_PUBLIC_BUILDING_INFO;
  }
}

export async function getBuildingInfo(): Promise<PublicBuildingInfo> {
  return fetchPublicBuildingInfo();
}

export async function getSiteContact(): Promise<SiteContact> {
  const building = await fetchPublicBuildingInfo();

  return SiteContactSchema.parse({
    email: building.email,
    phone: building.phone,
    phoneHref: building.phoneHref,
  });
}
