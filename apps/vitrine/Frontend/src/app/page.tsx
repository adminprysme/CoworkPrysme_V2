import { AudienceSection } from "@/components/home/AudienceSection";
import { ConceptSection } from "@/components/home/ConceptSection";
import { HeroSection } from "@/components/home/HeroSection";
import { MarqueeBanner } from "@/components/home/MarqueeBanner";
import { SearchBar } from "@/components/home/SearchBar";
import { ServicesPreviewSection } from "@/components/home/ServicesPreviewSection";
import { getHomeContent } from "@/lib/get-home-content";
import { homeMetadata } from "@/lib/metadata";

export const metadata = homeMetadata;

export default async function HomePage() {
  const homeContent = await getHomeContent();

  return (
    <>
      <HeroSection heroImages={homeContent.heroImages} />
      <SearchBar />
      <MarqueeBanner enabled={homeContent.marquee.enabled} text={homeContent.marquee.text} />
      <ConceptSection conceptImage={homeContent.conceptImage ?? homeContent.heroImages[0]!} />
      <AudienceSection />
      <ServicesPreviewSection serviceImages={homeContent.serviceImages} />
    </>
  );
}
