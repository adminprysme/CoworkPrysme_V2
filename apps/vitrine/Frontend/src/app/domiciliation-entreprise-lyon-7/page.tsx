import { DomiciliationPageContent } from "@/components/seo-landing/DomiciliationPageContent";
import { getSeoLandingPage } from "@/config/seo-landing-pages";
import { createSeoLandingMetadata } from "@/lib/seo-landing-metadata";

const page = getSeoLandingPage("/domiciliation-entreprise-lyon-7")!;

export const metadata = createSeoLandingMetadata(page);

export default function DomiciliationEntreprisePage() {
  return <DomiciliationPageContent page={page} />;
}
