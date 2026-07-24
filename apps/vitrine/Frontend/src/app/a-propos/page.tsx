import { AboutPageContent } from "@/components/about/AboutPageContent";
import { ABOUT_PAGE_SEO } from "@/config/about-page";
import { getAboutContent } from "@/lib/get-about-content";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(ABOUT_PAGE_SEO);

export default async function AboutPage() {
  const aboutContent = await getAboutContent();

  return <AboutPageContent placeImage={aboutContent.placeImage} />;
}
