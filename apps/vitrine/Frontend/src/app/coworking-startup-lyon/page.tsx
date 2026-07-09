import { StartupPageContent } from "@/components/seo-landing/StartupPageContent";
import { getSeoLandingPage } from "@/config/seo-landing-pages";
import { createSeoLandingMetadata } from "@/lib/seo-landing-metadata";

const page = getSeoLandingPage("/coworking-startup-lyon")!;

export const metadata = createSeoLandingMetadata(page);

export default function CoworkingStartupPage() {
  return <StartupPageContent page={page} />;
}
