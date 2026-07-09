import { TeletravailPageContent } from "@/components/seo-landing/TeletravailPageContent";
import { getSeoLandingPage } from "@/config/seo-landing-pages";
import { createSeoLandingMetadata } from "@/lib/seo-landing-metadata";

const page = getSeoLandingPage("/bureau-teletravail-lyon")!;

export const metadata = createSeoLandingMetadata(page);

export default function BureauTeletravailPage() {
  return <TeletravailPageContent page={page} />;
}
