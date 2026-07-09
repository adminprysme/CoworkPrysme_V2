import { SalleReunionHeurePageContent } from "@/components/seo-landing/SalleReunionHeurePageContent";
import { getSeoLandingPage } from "@/config/seo-landing-pages";
import { createSeoLandingMetadata } from "@/lib/seo-landing-metadata";

const page = getSeoLandingPage("/salle-reunion-a-lheure-lyon")!;

export const metadata = createSeoLandingMetadata(page);

export default function SalleReunionHeurePage() {
  return <SalleReunionHeurePageContent page={page} />;
}
