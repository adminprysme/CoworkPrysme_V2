import { permanentRedirect } from "next/navigation";

import { getDefaultCatalogBuildingSlug } from "@/lib/get-catalog-content";

export default async function SalleDeReunionIndexPage() {
  const slug = await getDefaultCatalogBuildingSlug();
  if (!slug) {
    permanentRedirect("/contact");
  }
  permanentRedirect(`/salle-de-reunion/${slug}`);
}
