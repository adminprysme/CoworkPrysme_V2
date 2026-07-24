import Image from "next/image";

import { PageIntro } from "@/components/pages/PageIntro";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import type { SeoLandingPageConfig } from "@/config/seo-landing-pages";

import { LocalBusinessJsonLd } from "./LocalBusinessJsonLd";
import { SeoLandingFooter } from "./SeoLandingFooter";
import layout from "./seo-landing-layouts.module.css";

const EQUIPMENT = [
  "Vidéoprojecteur",
  "Écran",
  "Visioconférence",
  "Wifi fibre",
  "Paperboard sur demande",
];

const IMAGE = "/images/seo/salle-reunion-reservation.webp";
const IMAGE_ALT = "Salle de réunion équipée — CoworkPrysme, Lyon 7";

interface Props {
  page: SeoLandingPageConfig;
}

export function SalleReunionHeurePageContent({ page }: Props) {
  const [booking, capacity] = page.sections;

  return (
    <>
      <LocalBusinessJsonLd />
      <PageIntro title={page.h1} subtitle={page.intro} />

      <Section>
        <Container>
          <div className={layout.splitGridReverse}>
            <ScrollReveal delay={80}>
              <div className={`${layout.imageWrap} ${layout.imageWrapWide}`}>
                <Image
                  src={IMAGE}
                  alt={IMAGE_ALT}
                  fill
                  sizes="(max-width: 900px) 100vw, 45vw"
                  className={layout.coverPhotoMeeting}
                />
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <SectionHeading title={booking.title} />
              <p className={layout.bodyText}>{booking.body}</p>
              <ul className={layout.chipGrid} aria-label="Équipements disponibles">
                {EQUIPMENT.map((item) => (
                  <li key={item} className={layout.chip}>
                    {item}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </Container>
      </Section>

      <Section muted>
        <Container>
          <ScrollReveal>
            <SectionHeading title={capacity.title} centered />
            <div className={layout.statBanner}>
              <span className={layout.statValue}>4 → 20</span>
              <span className={layout.statLabel}>{capacity.body}</span>
            </div>
          </ScrollReveal>
        </Container>
      </Section>

      <SeoLandingFooter cta={page.cta} relatedLinks={page.relatedLinks} />
    </>
  );
}
