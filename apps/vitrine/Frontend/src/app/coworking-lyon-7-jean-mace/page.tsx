import { JeanMacePageContent } from "@/components/seo-landing/JeanMacePageContent";
import { getSeoLandingPage } from "@/config/seo-landing-pages";
import { createSeoLandingMetadata } from "@/lib/seo-landing-metadata";

const page = getSeoLandingPage("/coworking-lyon-7-jean-mace")!;

export const metadata = createSeoLandingMetadata(page);

export default function CoworkingJeanMacePage() {
  return <JeanMacePageContent page={page} />;
}
