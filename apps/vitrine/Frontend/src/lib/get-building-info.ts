import { MOCK_BUILDING_INFO, type BuildingInfo } from "@/config/building-info";

/** Returns building location data. Swap implementation for a real API call later. */
export async function getBuildingInfo(): Promise<BuildingInfo> {
  return MOCK_BUILDING_INFO;
}
