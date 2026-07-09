import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogApiFallback } from "@/components/catalog/CatalogApiFallback";
import { CatalogTariffsPageContent } from "@/components/catalog/CatalogTariffsPageContent";
import { TARIFS_CATALOG } from "@/config/catalog-pages";
import { createPageMetadata } from "@/lib/metadata";
import {
  CATALOG_REVALIDATE_SECONDS,
  getCatalogBuildings,
  getCatalogTariffs,
} from "@/lib/get-catalog-content";

export const revalidate = CATALOG_REVALIDATE_SECONDS;

interface PageProps {
  params: Promise<{ buildingSlug: string }>;
}

export async function generateStaticParams() {
  const data = await getCatalogBuildings();
  return (data?.buildings ?? []).map((building) => ({ buildingSlug: building.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { buildingSlug } = await params;
  const content = await getCatalogTariffs(buildingSlug);
  if (!content) {
    return createPageMetadata({
      title: "Tarifs | Cowork Prysme",
      description: TARIFS_CATALOG.descriptionTemplate("Cowork Prysme", "Lyon"),
      path: `/tarifs/${buildingSlug}`,
    });
  }

  const { building } = content;
  return createPageMetadata({
    title: TARIFS_CATALOG.titleTemplate(building.name),
    description: TARIFS_CATALOG.descriptionTemplate(building.name, building.city),
    path: `/tarifs/${building.slug}`,
    ogImage: building.primaryPhotoUrl ?? undefined,
  });
}

export default async function TarifsBuildingPage({ params }: PageProps) {
  const { buildingSlug } = await params;
  const content = await getCatalogTariffs(buildingSlug);

  if (!content) {
    return <CatalogApiFallback />;
  }

  if (content.building.slug !== buildingSlug) {
    notFound();
  }

  return <CatalogTariffsPageContent config={TARIFS_CATALOG} content={content} />;
}
