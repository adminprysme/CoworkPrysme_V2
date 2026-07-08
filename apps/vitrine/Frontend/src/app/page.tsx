import { AudienceSection } from "@/components/home/AudienceSection";
import { ConceptSection } from "@/components/home/ConceptSection";
import { HeroSection } from "@/components/home/HeroSection";
import { MarqueeBanner } from "@/components/home/MarqueeBanner";
import { SearchBar } from "@/components/home/SearchBar";
import { ServicesPreviewSection } from "@/components/home/ServicesPreviewSection";
import { homeMetadata } from "@/lib/metadata";

export const metadata = homeMetadata;

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <SearchBar />
      <MarqueeBanner />
      <ConceptSection />
      <AudienceSection />
      <ServicesPreviewSection />
    </>
  );
}
