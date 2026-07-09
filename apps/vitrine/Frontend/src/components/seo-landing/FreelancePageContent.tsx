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

export function FreelancePageContent({ page }: Props) {
  const [community, pricing] = page.sections;

  const pillars = community.body.split(", ").map((text) => text.trim());

  return (
    <>
      <LocalBusinessJsonLd />
      <PageIntro title={page.h1} subtitle={page.intro} />

      <Section>
        <Container>
          <ScrollReveal>
            <SectionHeading title={community.title} />
            <div className={layout.featureColumns}>
              {pillars.map((text) => (
                <article key={text} className={layout.featureCol}>
                  <p className={layout.bodyText}>{text}</p>
                </article>
              ))}
            </div>
          </ScrollReveal>
        </Container>
      </Section>

      <Section muted>
        <Container>
          <ScrollReveal>
            <SectionHeading title={pricing.title} />
            <div className={layout.pricingStrip}>
              <p className={layout.bodyText}>{pricing.body}</p>
            </div>
          </ScrollReveal>
        </Container>
      </Section>

      <SeoLandingFooter cta={page.cta} relatedLinks={page.relatedLinks} />
    </>
  );
}
