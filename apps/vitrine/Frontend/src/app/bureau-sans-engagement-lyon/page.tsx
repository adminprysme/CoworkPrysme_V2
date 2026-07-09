import { SansEngagementPageContent } from "@/components/seo-landing/SansEngagementPageContent";
import { getSeoLandingPage } from "@/config/seo-landing-pages";
import { createSeoLandingMetadata } from "@/lib/seo-landing-metadata";

const page = getSeoLandingPage("/bureau-sans-engagement-lyon")!;

export const metadata = createSeoLandingMetadata(page);

export default function BureauSansEngagementPage() {
  return <SansEngagementPageContent page={page} />;
}
