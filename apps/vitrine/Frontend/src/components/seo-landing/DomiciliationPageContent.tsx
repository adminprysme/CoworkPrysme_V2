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

export function DomiciliationPageContent({ page }: Props) {
  const [process, advantages] = page.sections;

  const processParts = process.body.split(". ").filter(Boolean);

  return (
    <>
      <LocalBusinessJsonLd />
      <PageIntro title={page.h1} subtitle={page.intro} />

      <Section>
        <Container>
          <ScrollReveal>
            <SectionHeading title={process.title} />
            <ul className={layout.processList}>
              {processParts.map((part, index) => (
                <li key={index} className={layout.processItem}>
                  <span className={layout.processIcon} aria-hidden="true">
                    {index + 1}
                  </span>
                  <p className={layout.bodyText}>{part.endsWith(".") ? part : `${part}.`}</p>
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </Container>
      </Section>

      <Section muted>
        <Container>
          <ScrollReveal>
            <SectionHeading title={advantages.title} />
            <div className={layout.addressCard}>
              <p className={layout.bodyText}>{advantages.body}</p>
              <p className={layout.addressLine}>39 rue Saint Jean de Dieu, Lyon 7</p>
            </div>
          </ScrollReveal>
        </Container>
      </Section>

      <SeoLandingFooter cta={page.cta} relatedLinks={page.relatedLinks} />
    </>
  );
}
