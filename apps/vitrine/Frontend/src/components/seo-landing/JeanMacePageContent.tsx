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
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=80";

interface Props {
  page: SeoLandingPageConfig;
}

export function JeanMacePageContent({ page }: Props) {
  const [sectionA, sectionB] = page.sections;

  return (
    <>
      <LocalBusinessJsonLd />
      <PageIntro title={page.h1} subtitle={page.intro} />

      <Section muted>
        <Container>
          <ScrollReveal>
            <SectionHeading title={sectionA.title} />
            <p className={layout.bodyText}>{sectionA.body}</p>
          </ScrollReveal>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className={layout.splitGrid}>
            <ScrollReveal>
              <SectionHeading title={sectionB.title} />
              <p className={layout.bodyText}>{sectionB.body}</p>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <div className={layout.imageWrap}>
                <Image src={IMAGE} alt="" fill sizes="(max-width: 900px) 100vw, 45vw" />
              </div>
            </ScrollReveal>
          </div>
        </Container>
      </Section>

      <SeoLandingFooter cta={page.cta} relatedLinks={page.relatedLinks} />
    </>
  );
}
