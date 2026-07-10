import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogApiFallback } from "@/components/catalog/CatalogApiFallback";
import { CatalogSpacesPageContent } from "@/components/catalog/CatalogSpacesPageContent";
import { MEETING_ROOMS_CATALOG } from "@/config/catalog-pages";
import { createPageMetadata } from "@/lib/metadata";
import { getCatalogBuildings, getMeetingRoomsCatalog } from "@/lib/get-catalog-content";

/** Must be a literal — Next.js segment config does not accept imported values. */
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ buildingSlug: string }>;
}

export async function generateStaticParams() {
  const data = await getCatalogBuildings();
  return (data?.buildings ?? []).map((building) => ({ buildingSlug: building.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { buildingSlug } = await params;
  const content = await getMeetingRoomsCatalog(buildingSlug);
  if (!content) {
    return createPageMetadata({
      title: "Salles de réunion | Cowork Prysme",
      description: MEETING_ROOMS_CATALOG.descriptionTemplate("Cowork Prysme", "Lyon"),
      path: `/salle-de-reunion/${buildingSlug}`,
    });
  }

  const { building } = content;
  return createPageMetadata({
    title: MEETING_ROOMS_CATALOG.titleTemplate(building.name),
    description: MEETING_ROOMS_CATALOG.descriptionTemplate(building.name, building.city),
    path: `/salle-de-reunion/${building.slug}`,
    ogImage: building.primaryPhotoUrl ?? undefined,
  });
}

export default async function SalleDeReunionBuildingPage({ params }: PageProps) {
  const { buildingSlug } = await params;
  const content = await getMeetingRoomsCatalog(buildingSlug);

  if (!content) {
    return <CatalogApiFallback />;
  }

  if (content.building.slug !== buildingSlug) {
    notFound();
  }

  return (
    <CatalogSpacesPageContent
      config={MEETING_ROOMS_CATALOG}
      building={content.building}
      spaces={content.spaces}
      visibleBuildings={content.visibleBuildings}
    />
  );
}
