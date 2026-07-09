import { EquipesPageContent } from "@/components/seo-landing/EquipesPageContent";
import { getSeoLandingPage } from "@/config/seo-landing-pages";
import { createSeoLandingMetadata } from "@/lib/seo-landing-metadata";

const page = getSeoLandingPage("/location-bureaux-equipes-lyon")!;

export const metadata = createSeoLandingMetadata(page);

export default function LocationBureauxEquipesPage() {
  return <EquipesPageContent page={page} />;
}
