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

export function StartupPageContent({ page }: Props) {
  const [ecosystem, budget] = page.sections;

  const ecoItems = ecosystem.body.split(", ").map((item) => item.trim());

  return (
    <>
      <LocalBusinessJsonLd />
      <PageIntro title={page.h1} subtitle={page.intro} />

      <Section>
        <Container>
          <ScrollReveal>
            <SectionHeading title={ecosystem.title} />
            <div className={layout.ecoGrid}>
              {ecoItems.map((item) => (
                <article key={item} className={layout.ecoCard}>
                  <p className={layout.bodyText}>{item}</p>
                </article>
              ))}
            </div>
          </ScrollReveal>
        </Container>
      </Section>

      <Section muted>
        <Container>
          <ScrollReveal>
            <SectionHeading title={budget.title} centered />
            <blockquote className={layout.quoteBlock}>
              <p>{budget.body}</p>
            </blockquote>
          </ScrollReveal>
        </Container>
      </Section>

      <SeoLandingFooter cta={page.cta} relatedLinks={page.relatedLinks} />
    </>
  );
}
