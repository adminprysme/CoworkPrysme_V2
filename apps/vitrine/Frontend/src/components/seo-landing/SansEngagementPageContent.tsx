import { PageIntro } from "@/components/pages/PageIntro";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import type { SeoLandingPageConfig } from "@/config/seo-landing-pages";

import { LocalBusinessJsonLd } from "./LocalBusinessJsonLd";
import { SeoLandingFooter } from "./SeoLandingFooter";
import layout from "./seo-landing-layouts.module.css";

interface Props {
  page: SeoLandingPageConfig;
}

export function SansEngagementPageContent({ page }: Props) {
  const [how, audience] = page.sections;

  const audienceItems = audience.body.split(", ").map((item) => item.trim());

  return (
    <>
      <LocalBusinessJsonLd />
      <PageIntro title={page.h1} subtitle={page.intro} />

      <Section>
        <Container>
          <ScrollReveal>
            <SectionHeading title={how.title} />
            <ol className={layout.stepList}>
              <li className={layout.stepItem}>
                <p className={layout.bodyText}>
                  Réservez à l&apos;heure, à la journée, à la semaine ou au mois.
                </p>
              </li>
              <li className={layout.stepItem}>
                <p className={layout.bodyText}>
                  Pour un engagement plus long, un simple préavis de 30 jours suffit à résilier — le
                  mois entamé reste dû, rien de plus.
                </p>
              </li>
              <li className={layout.stepItem}>
                <p className={layout.bodyText}>
                  Aucune caution disproportionnée, aucune clause cachée.
                </p>
              </li>
            </ol>
          </ScrollReveal>
        </Container>
      </Section>

      <Section muted>
        <Container>
          <ScrollReveal>
            <SectionHeading title={audience.title} />
            <div className={layout.audienceGrid}>
              {audienceItems.map((item) => (
                <div key={item} className={layout.audienceCard}>
                  {item}
                </div>
              ))}
            </div>
          </ScrollReveal>
        </Container>
      </Section>

      <SeoLandingFooter cta={page.cta} relatedLinks={page.relatedLinks} />
    </>
  );
}
