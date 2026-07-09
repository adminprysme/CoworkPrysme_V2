import { FreelancePageContent } from "@/components/seo-landing/FreelancePageContent";
import { getSeoLandingPage } from "@/config/seo-landing-pages";
import { createSeoLandingMetadata } from "@/lib/seo-landing-metadata";

const page = getSeoLandingPage("/coworking-freelance-lyon")!;

export const metadata = createSeoLandingMetadata(page);

export default function CoworkingFreelancePage() {
  return <FreelancePageContent page={page} />;
}
