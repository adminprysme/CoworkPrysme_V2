import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogApiFallback } from "@/components/catalog/CatalogApiFallback";
import { CatalogSpacesPageContent } from "@/components/catalog/CatalogSpacesPageContent";
import { PRIVATE_OFFICES_CATALOG } from "@/config/catalog-pages";
import { createPageMetadata } from "@/lib/metadata";
import { getCatalogBuildings, getPrivateOfficesCatalog } from "@/lib/get-catalog-content";

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
  const content = await getPrivateOfficesCatalog(buildingSlug);
  if (!content) {
    return createPageMetadata({
      title: "Bureaux privatifs | Cowork Prysme",
      description: PRIVATE_OFFICES_CATALOG.descriptionTemplate("Cowork Prysme", "Lyon"),
      path: `/bureaux-privatifs/${buildingSlug}`,
    });
  }

  const { building } = content;
  return createPageMetadata({
    title: PRIVATE_OFFICES_CATALOG.titleTemplate(building.name),
    description: PRIVATE_OFFICES_CATALOG.descriptionTemplate(building.name, building.city),
    path: `/bureaux-privatifs/${building.slug}`,
    ogImage: building.primaryPhotoUrl ?? undefined,
  });
}

export default async function BureauxPrivatifsBuildingPage({ params }: PageProps) {
  const { buildingSlug } = await params;
  const content = await getPrivateOfficesCatalog(buildingSlug);

  if (!content) {
    return <CatalogApiFallback />;
  }

  if (content.building.slug !== buildingSlug) {
    notFound();
  }

  return (
    <CatalogSpacesPageContent
      config={PRIVATE_OFFICES_CATALOG}
      building={content.building}
      spaces={content.spaces}
      visibleBuildings={content.visibleBuildings}
    />
  );
}
