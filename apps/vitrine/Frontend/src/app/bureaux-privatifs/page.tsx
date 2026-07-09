import { permanentRedirect } from "next/navigation";

import { getDefaultCatalogBuildingSlug } from "@/lib/get-catalog-content";

export default async function BureauxPrivatifsIndexPage() {
  const slug = await getDefaultCatalogBuildingSlug();
  if (!slug) {
    permanentRedirect("/contact");
  }
  permanentRedirect(`/bureaux-privatifs/${slug}`);
}
