import {
  CatalogBuildingPageContentSchema,
  CatalogBuildingsListSchema,
  CatalogTariffsContentSchema,
  type CatalogBuildingPageContent,
  type CatalogBuildingsList,
  type CatalogTariffsContent,
} from "@coworkprysme/shared";

const REVALIDATE_SECONDS = 3600;

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8002";
}

async function catalogFetch<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
): Promise<T | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      return null;
    }

    const json: unknown = await response.json();
    return schema.parse(json);
  } catch {
    return null;
  }
}

export async function getCatalogBuildings(): Promise<CatalogBuildingsList | null> {
  return catalogFetch("/catalog/buildings", CatalogBuildingsListSchema);
}

export async function getDefaultCatalogBuildingSlug(): Promise<string | null> {
  const data = await getCatalogBuildings();
  return data?.defaultBuildingSlug ?? null;
}

export async function getPrivateOfficesCatalog(
  buildingSlug: string,
): Promise<CatalogBuildingPageContent | null> {
  return catalogFetch(
    `/catalog/buildings/${encodeURIComponent(buildingSlug)}/private-offices`,
    CatalogBuildingPageContentSchema,
  );
}

export async function getMeetingRoomsCatalog(
  buildingSlug: string,
): Promise<CatalogBuildingPageContent | null> {
  return catalogFetch(
    `/catalog/buildings/${encodeURIComponent(buildingSlug)}/meeting-rooms`,
    CatalogBuildingPageContentSchema,
  );
}

export async function getCatalogTariffs(
  buildingSlug: string,
): Promise<CatalogTariffsContent | null> {
  return catalogFetch(
    `/catalog/tariffs/${encodeURIComponent(buildingSlug)}`,
    CatalogTariffsContentSchema,
  );
}

export { REVALIDATE_SECONDS as CATALOG_REVALIDATE_SECONDS };
