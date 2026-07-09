import { permanentRedirect } from "next/navigation";

import { getDefaultCatalogBuildingSlug } from "@/lib/get-catalog-content";

export default async function TarifsIndexPage() {
  const slug = await getDefaultCatalogBuildingSlug();
  if (!slug) {
    permanentRedirect("/contact");
  }
  permanentRedirect(`/tarifs/${slug}`);
}
