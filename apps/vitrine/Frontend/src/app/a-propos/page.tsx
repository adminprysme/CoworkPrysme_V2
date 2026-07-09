import { AboutPageContent } from "@/components/about/AboutPageContent";
import { ABOUT_PAGE_SEO } from "@/config/about-page";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(ABOUT_PAGE_SEO);

export default function AboutPage() {
  return <AboutPageContent />;
}
