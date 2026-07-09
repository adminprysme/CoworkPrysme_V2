import Image from "next/image";

import { PageIntro } from "@/components/pages/PageIntro";
import { Container } from "@/components/ui/Container";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Section, SectionHeading } from "@/components/ui/SectionHeading";
import type { SeoLandingPageConfig } from "@/config/seo-landing-pages";

import { LocalBusinessJsonLd } from "./LocalBusinessJsonLd";
import { SeoLandingFooter } from "./SeoLandingFooter";
import layout from "./seo-landing-layouts.module.css";

const IMAGE =
  "https://images.unsplash.com/photo-1598257006458-087169a1f08d?auto=format&fit=crop&w=900&q=80";

interface Props {
  page: SeoLandingPageConfig;
}

export function TeletravailPageContent({ page }: Props) {
  const [changes, access] = page.sections;

  return (
    <>
      <LocalBusinessJsonLd />
      <PageIntro title={page.h1} subtitle={page.intro} />

      <Section>
        <Container>
          <div className={layout.splitGrid}>
            <ScrollReveal>
              <div className={layout.imageWrapTall}>
                <Image src={IMAGE} alt="" fill sizes="(max-width: 900px) 100vw, 45vw" />
              </div>
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <SectionHeading title={changes.title} />
              <div className={layout.contrastBlock}>
                <p className={layout.bodyText}>{changes.body}</p>
              </div>
            </ScrollReveal>
          </div>
        </Container>
      </Section>

      <Section muted>
        <Container>
          <ScrollReveal>
            <SectionHeading title={access.title} />
            <p className={layout.bodyText}>{access.body}</p>
          </ScrollReveal>
        </Container>
      </Section>

      <SeoLandingFooter cta={page.cta} relatedLinks={page.relatedLinks} />
    </>
  );
}
